"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useSignTypedData, useSwitchChain } from "wagmi";
import { keccak256, toHex } from "viem";
import { arcTestnet } from "@/lib/chain";
import { isAddr, short } from "@/lib/addr";
import { explain } from "@/lib/hooks";
import { origin } from "@/lib/local";
import { ConnectButton, Fingerprint, Msg, Shell } from "@/components/ui";

export default function PairPage() {
  return (
    <Suspense>
      <Pair />
    </Suspense>
  );
}

function Pair() {
  const q = useSearchParams();
  const w = q.get("w") ?? "";
  const code = q.get("c") ?? "";
  const name = q.get("n") ?? "";
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync, isPending } = useSignTypedData();
  const [reply, setReply] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!isAddr(w) || !code)
    return (
      <Shell>
        <Msg kind="err">This pairing link is incomplete. Ask for a new one.</Msg>
      </Shell>
    );

  async function sign() {
    setErr(null);
    try {
      if (chainId !== arcTestnet.id) await switchChainAsync({ chainId: arcTestnet.id });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 23 * 3600);
      const signature = await signTypedDataAsync({
        domain: { name: "Unpoison", version: "1", chainId: arcTestnet.id, verifyingContract: w as `0x${string}` },
        types: { Pair: [{ name: "wallet", type: "address" }, { name: "codeHash", type: "bytes32" }, { name: "deadline", type: "uint256" }] },
        primaryType: "Pair",
        message: { wallet: w as `0x${string}`, codeHash: keccak256(toHex(code)), deadline },
      });
      setReply(`${origin()}/finish?w=${w}&c=${code}&n=${encodeURIComponent(name)}&a=${address}&d=${deadline}&s=${signature}`);
    } catch (e) {
      setErr(explain(e).text);
    }
  }

  return (
    <Shell>
      <section className="card caution pop">
        <h1>You&apos;re invited to pair.</h1>
        <p>
          A friend wants to save you as <strong>{name || "a contact"}</strong> so their payments to you can never go to a fake
          address. Signing is free and moves no money.
        </p>
        <p className="small">Their Unpoison wallet: <span className="mono">{short(w)}</span> <Fingerprint addr={w} /></p>
        {!isConnected ? (
          <ConnectButton />
        ) : (
          <button className="btn primary block" disabled={isPending} onClick={sign}>
            {isPending ? "Check your wallet" : `Sign as ${short(address!)}`}
          </button>
        )}
        {err && <Msg kind="err">{err}</Msg>}
      </section>

      {reply && (
        <section className="card antidote pop">
          <h2>Signed. Send this back.</h2>
          <p>Send this reply link to the person who invited you. They open it to finish pairing.</p>
          <p className="mono small" style={{ wordBreak: "break-all" }}>{reply}</p>
          <div className="grid2">
            <button className="btn" onClick={() => navigator.clipboard.writeText(reply)}>Copy link</button>
            <a className="btn primary" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent("I signed! Finish pairing: " + reply)}`}>WhatsApp</a>
          </div>
        </section>
      )}
    </Shell>
  );
}
