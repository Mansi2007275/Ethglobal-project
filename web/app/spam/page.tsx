"use client";

import { short } from "@/lib/addr";
import { useSpam, useUnpoison } from "@/lib/hooks";
import { Msg, NeedWallet, Shell, Specimen } from "@/components/ui";

const LABEL: Record<string, string> = {
  lookalike: "Looks like a contact",
  dust: "Dust or $0",
  fakeToken: "Fake token",
  notSigned: "Not signed by you",
  timing: "Right after your payment",
};

export default function Spam() {
  const u = useUnpoison();
  const spam = useSpam(u.wallet);
  if (!u.wallet) return <Shell><NeedWallet /></Shell>;

  const nameOf = (a?: string) => u.contacts.find((c) => c.addr.toLowerCase() === a?.toLowerCase())?.name;

  return (
    <Shell>
      <section className="card flat">
        <h2>Spam</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Bait transfers that try to plant a fake address in your history. They are hidden here, and you can&apos;t copy them.
        </p>
      </section>
      {spam.isLoading && <div className="card"><p style={{ margin: 0 }}>Scanning your history…</p></div>}
      {spam.error && <Msg kind="err">The spam scan couldn&apos;t reach Arc. It will retry in a few seconds.</Msg>}
      {spam.data?.length === 0 && <div className="card"><p className="muted" style={{ margin: 0 }}>Nothing suspicious. Bait transfers will show up here, never in your main history.</p></div>}
      {spam.data?.map((s) => {
        const bait = s.from.toLowerCase() === u.wallet!.toLowerCase() ? s.to : s.from;
        const who = nameOf(s.imitates);
        return (
          <article className="card" key={s.txHash + bait} style={{ userSelect: "none" }} onCopy={(e) => e.preventDefault()}>
            <div className="chips" style={{ marginBottom: 10 }}>
              {s.signals.map((x) => (
                <span key={x} className="badge stop">{LABEL[x] ?? x}</span>
              ))}
            </div>
            {s.imitates ? (
              <Specimen addr={bait} against={s.imitates} title={`Pretends to be ${who ?? short(s.imitates)}`} tone="stop" />
            ) : (
              <Specimen addr={bait} title="Suspicious sender" tone="stop" />
            )}
            <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
              {s.amount} {s.token} · this address can&apos;t be copied from here.
            </p>
          </article>
        );
      })}
    </Shell>
  );
}
