import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem, type Log } from "viem";
import { walletAbi } from "@/lib/abi";
import { NATIVE_EMITTER, USDC, arcTestnet } from "@/lib/chain";
import { isAddr, isLookalike } from "@/lib/addr";

export const dynamic = "force-dynamic";

const client = createPublicClient({ chain: arcTestnet, transport: http() });
const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const LOOKBACK = 50_000n;
const CHUNK = 10_000n;
const cache = new Map<string, { at: number; items: unknown[] }>();

type TLog = Log<bigint, number, false, typeof TRANSFER>;

async function logs(args: { from?: `0x${string}`; to?: `0x${string}` }, fromBlock: bigint, toBlock: bigint) {
  const out: TLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    const end = start + CHUNK - 1n > toBlock ? toBlock : start + CHUNK - 1n;
    try {
      out.push(...((await client.getLogs({ event: TRANSFER, args, fromBlock: start, toBlock: end })) as TLog[]));
    } catch {
      /* one bad range should not hide the rest */
    }
  }
  return out;
}

const lc = (a: string) => a.toLowerCase();
const official = (token: string) => lc(token) === lc(USDC) || lc(token) === lc(NATIVE_EMITTER);
// Native emitter logs carry 18-decimal values; the ERC-20 interface and other tokens are read as 6.
const toUsdc = (token: string, v: bigint) => (lc(token) === lc(NATIVE_EMITTER) ? Number(v) / 1e18 : Number(v) / 1e6);

export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet") ?? "";
  if (!isAddr(wallet)) return NextResponse.json({ error: "Pass ?wallet=0x…" }, { status: 400 });
  const w = lc(wallet) as `0x${string}`;

  const hit = cache.get(w);
  if (hit && Date.now() - hit.at < 30_000) return NextResponse.json({ items: hit.items, cached: true });

  try {
    const latest = await client.getBlockNumber();
    const fromBlock = latest > LOOKBACK ? latest - LOOKBACK : 0n;

    const [owner, contactsRaw, incoming, outgoing] = await Promise.all([
      client.readContract({ address: w, abi: walletAbi, functionName: "owner" }) as Promise<`0x${string}`>,
      client.readContract({ address: w, abi: walletAbi, functionName: "getContacts" }) as Promise<readonly { addr: string }[]>,
      logs({ to: w }, fromBlock, latest),
      logs({ from: w }, fromBlock, latest),
    ]);
    const contacts = contactsRaw.map((c) => lc(c.addr));

    // Who sent each outgoing transfer? Real payments are sent by the owner; forged ones are not.
    const senders = new Map<string, string>();
    await Promise.all(
      [...new Set(outgoing.map((l) => l.transactionHash))].slice(0, 60).map(async (h) => {
        try {
          const tx = await client.getTransaction({ hash: h });
          senders.set(h, lc(tx.from));
        } catch {
          /* skip */
        }
      }),
    );

    const realOut = outgoing.filter((l) => official(l.address) && senders.get(l.transactionHash) === lc(owner));
    const recipients = [...new Set(realOut.map((l) => lc(l.args.to!)))];
    const known = [...new Set([...contacts, ...recipients])];
    const realOutBlocks = realOut.map((l) => l.blockNumber);

    const seen = new Set<string>();
    const items: unknown[] = [];
    for (const l of [...incoming, ...outgoing]) {
      const from = lc(l.args.from!), to = lc(l.args.to!);
      const isOut = from === w;
      const counterparty = isOut ? to : from;
      const key = `${l.transactionHash}:${counterparty}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isOut && official(l.address) && senders.get(l.transactionHash) === lc(owner)) continue; // a real payment
      if (known.includes(counterparty) && official(l.address)) continue; // a real contact or recipient

      const signals: string[] = [];
      const imitates = known.find((k) => isLookalike(counterparty, k));
      if (imitates) signals.push("lookalike");
      const value = toUsdc(l.address, l.args.value ?? 0n);
      if (value < 0.01) signals.push("dust");
      if (!official(l.address)) signals.push("fakeToken");
      if (isOut && senders.has(l.transactionHash) && senders.get(l.transactionHash) !== lc(owner)) signals.push("notSigned");
      // ~1 block per second on Arc; 15 minutes is roughly 900 blocks.
      if (realOutBlocks.some((b) => l.blockNumber >= b && l.blockNumber - b <= 900n)) signals.push("timing");

      if (signals.length >= 2) {
        items.push({
          txHash: l.transactionHash,
          token: official(l.address) ? "USDC" : "fake USDC",
          from,
          to,
          amount: value.toFixed(value < 0.01 ? 6 : 2),
          signals,
          imitates,
        });
      }
    }

    cache.set(w, { at: Date.now(), items });
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "scan failed", items: [] }, { status: 502 });
  }
}
