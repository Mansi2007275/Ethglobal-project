"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import { walletAbi } from "@/lib/abi";
import { explorerTx } from "@/lib/chain";
import { fmtUsdc, isAddr, short } from "@/lib/addr";
import { explain, useTx } from "@/lib/hooks";
import { ConnectButton, Msg, Shell } from "@/components/ui";

export default function ClaimPage() {
  return (
    <Suspense>
      <Claim />
    </Suspense>
  );
}

function Claim() {
  const q = useSearchParams();
  const w = q.get("w") ?? "";
  const id = q.get("id") ?? "";
  const secret = q.get("s") ?? "";
  const { address, isConnected } = useAccount();
  const { run, busy } = useTx();
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const valid = isAddr(w) && /^\d+$/.test(id) && /^0x[0-9a-fA-F]{64}$/.test(secret);
  const escrows = useReadContract({ address: w as `0x${string}`, abi: walletAbi, functionName: "getEscrows", query: { enabled: valid } });
  const e = valid ? (escrows.data as readonly { to: string; amount: bigint; unlockAt: bigint; status: number }[] | undefined)?.[Number(id)] : undefined;

  if (!valid) return <Shell><Msg kind="err">This claim link is incomplete. Ask the sender to share it again.</Msg></Shell>;

  const isMine = e && address && e.to.toLowerCase() === address.toLowerCase();

  async function claim() {
    setErr(null);
    try {
      const r = await run({ address: w as `0x${string}`, abi: walletAbi, functionName: "claim", args: [BigInt(id), secret] });
      setHash(r.hash);
      escrows.refetch();
    } catch (x) {
      setErr(explain(x).text);
    }
  }

  return (
    <Shell>
      <section className={`card ${hash ? "antidote" : "poison"} pop`}>
        <h1>{hash ? "Claimed. It's yours." : "Someone sent you USDC."}</h1>
        {e ? (
          <p>
            <strong>{fmtUsdc(e.amount)} USDC</strong> for <span className="mono">{short(e.to)}</span>.{" "}
            {e.status === 0 ? `Claim before ${new Date(Number(e.unlockAt) * 1000).toLocaleString()}.` : "This payment is already settled."}
          </p>
        ) : (
          <p>Loading payment…</p>
        )}
        {hash ? (
          <a className="btn block" href={explorerTx(hash)} target="_blank" rel="noreferrer">View on Arcscan</a>
        ) : !isConnected ? (
          <ConnectButton />
        ) : e && e.status === 0 ? (
          isMine ? (
            <button className="btn go block" disabled={busy} onClick={claim}>{busy ? "Claiming" : "Claim USDC"}</button>
          ) : (
            <Msg kind="err">Connect the wallet this was sent to ({short(e.to)}). Only that address can claim.</Msg>
          )
        ) : null}
        {err && <Msg kind="err">{err}</Msg>}
      </section>
      <p className="small muted">If the address was a lookalike by mistake, nobody can claim it, and the money goes back to the sender.</p>
    </Shell>
  );
}
