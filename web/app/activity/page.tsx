"use client";

import { useEffect, useState } from "react";
import { walletAbi } from "@/lib/abi";
import { fmtUsdc, short } from "@/lib/addr";
import { explain, useTx, useUnpoison } from "@/lib/hooks";
import { claims } from "@/lib/local";
import { Msg, NeedWallet, Shell } from "@/components/ui";

const STATUS = ["Pending", "Sent", "Undone", "Claimed", "Refunded"];

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const mmss = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

export default function Activity() {
  const u = useUnpoison();
  const { run, busy } = useTx();
  const now = useNow();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!u.wallet) return <Shell><NeedWallet /></Shell>;

  const nameOf = (a: string) => u.contacts.find((c) => c.addr.toLowerCase() === a.toLowerCase())?.name;
  const list = u.escrows.map((e, id) => ({ ...e, id })).reverse();

  async function act(fn: "cancel" | "release" | "refund", id: number, done: string) {
    setErr(null);
    setOk(null);
    try {
      await run({ address: u.wallet!, abi: walletAbi, functionName: fn, args: [BigInt(id)] });
      setOk(done);
      u.refetch();
    } catch (e) {
      setErr(explain(e).text);
    }
  }

  return (
    <Shell>
      <section className="card flat">
        <h2>Activity</h2>
        <p className="muted small" style={{ margin: 0 }}>Payments to new addresses wait here. Undo them, or let them go when the timer ends.</p>
      </section>
      {err && <Msg kind="err">{err}</Msg>}
      {ok && <Msg kind="ok">{ok}</Msg>}
      {list.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Nothing waiting. Payments to verified contacts go straight through.</p></div>}
      {list.map((e) => {
        const left = Number(e.unlockAt) - now;
        const pending = e.status === 0;
        const isUndo = e.kind === 0;
        const total = isUndo ? 120 : 86400;
        const pct = pending ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;
        const link = !isUndo ? claims.find(u.wallet!, String(e.id))?.link : undefined;
        return (
          <article className="item" key={e.id}>
            <div className="row">
              {pending && left > 0 ? (
                <div className="ring" style={{ ["--p" as string]: pct }} aria-label={`${mmss(left)} left`}>
                  <span>{mmss(left)}</span>
                </div>
              ) : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between">
                  <strong>{fmtUsdc(e.amount)} USDC</strong>
                  <span className={`badge ${pending ? (isUndo ? "wait" : "poison") : e.status === 2 || e.status === 4 ? "" : "go"}`}>
                    {pending ? (isUndo ? "Undo window" : "Handshake") : STATUS[e.status]}
                  </span>
                </div>
                <div className="small muted">
                  to {nameOf(e.to) ?? <span className="mono">{short(e.to)}</span>}
                </div>
              </div>
            </div>
            {pending && isUndo && (
              <div className="grid2" style={{ marginTop: 10 }}>
                <button className="btn stop" disabled={busy} onClick={() => act("cancel", e.id, "Undone. The USDC is back in your wallet.")}>Undo</button>
                <button className="btn" disabled={busy || left > 0} onClick={() => act("release", e.id, "Sent.")}>{left > 0 ? "Send when ready" : "Send now"}</button>
              </div>
            )}
            {pending && !isUndo && (
              <div className="stack" style={{ marginTop: 10 }}>
                {left > 0 ? (
                  <>
                    <p className="small" style={{ margin: 0 }}>Waiting for the receiver to claim it with your link.</p>
                    {link && <button className="btn" onClick={() => navigator.clipboard.writeText(link)}>Copy claim link</button>}
                  </>
                ) : (
                  <button className="btn go block" disabled={busy} onClick={() => act("refund", e.id, "Refunded. Nobody claimed it, so the USDC is back.")}>Refund to my wallet</button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </Shell>
  );
}
