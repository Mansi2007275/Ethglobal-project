"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { walletAbi } from "@/lib/abi";
import { isAddr } from "@/lib/addr";
import { explain, useTx, useUnpoison } from "@/lib/hooks";
import { invites } from "@/lib/local";
import { Msg, Shell, Specimen } from "@/components/ui";

export default function FinishPage() {
  return (
    <Suspense>
      <Finish />
    </Suspense>
  );
}

function Finish() {
  const q = useSearchParams();
  const w = q.get("w") ?? "";
  const code = q.get("c") ?? "";
  const name = q.get("n") ?? "";
  const contact = q.get("a") ?? "";
  const deadline = q.get("d") ?? "";
  const sig = q.get("s") ?? "";
  const u = useUnpoison();
  const { run, busy } = useTx();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = isAddr(w) && isAddr(contact) && code && /^\d+$/.test(deadline) && sig.startsWith("0x");
  if (!valid)
    return (
      <Shell>
        <Msg kind="err">This reply link is incomplete. Ask your contact to sign again.</Msg>
      </Shell>
    );

  const mine = u.wallet && u.wallet.toLowerCase() === w.toLowerCase();

  async function finish() {
    setErr(null);
    try {
      await run({
        address: w as `0x${string}`,
        abi: walletAbi,
        functionName: "pairWithSignature",
        args: [contact, name, code, BigInt(deadline), sig],
      });
      invites.remove(code);
      setDone(true);
      u.refetch();
    } catch (e) {
      setErr(explain(e).text);
    }
  }

  return (
    <Shell>
      <section className="card">
        <h1>{done ? `${name} is verified.` : `Finish pairing ${name}`}</h1>
        <p className="muted">
          {done
            ? "Payments to this exact address are now instant. Any lookalike will be stopped."
            : "The contract checks that this address really signed your invite. Check the emoji with them if you like."}
        </p>
        <Specimen addr={contact} title={`${name || "Contact"}${done ? ", verified ✓" : ""}`} tone={done ? "go" : "wait"} />
        <div style={{ marginTop: 14 }}>
          {done ? (
            <Link href="/send" className="btn go block">Pay {name}</Link>
          ) : !mine ? (
            <Msg kind="err">Connect the wallet that created this invite.</Msg>
          ) : (
            <button className="btn primary block" disabled={busy} onClick={finish}>{busy ? "Verifying" : "Verify and save contact"}</button>
          )}
        </div>
        {err && <Msg kind="err">{err}</Msg>}
      </section>
    </Shell>
  );
}
