"use client";

import { useEffect, useState } from "react";
import { keccak256, toHex } from "viem";
import { walletAbi } from "@/lib/abi";
import { randomHex32, short } from "@/lib/addr";
import { explain, useTx, useUnpoison } from "@/lib/hooks";
import { invites, origin, type InviteNote } from "@/lib/local";
import { Avatar, Fingerprint, Msg, NeedWallet, Shell } from "@/components/ui";

export default function Contacts() {
  const u = useUnpoison();
  const { run, busy } = useTx();
  const [name, setName] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState<InviteNote[]>([]);
  const [reply, setReply] = useState("");
  const [msg, setMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null);

  useEffect(() => setPending(invites.all().filter((i) => i.wallet === u.wallet && i.expiresAt * 1000 > Date.now())), [u.wallet, link]);

  if (!u.wallet) return <Shell><NeedWallet /></Shell>;

  async function invite() {
    setMsg(null);
    if (!name.trim()) return setMsg({ k: "err", t: "Type the contact's name first." });
    try {
      const code = randomHex32();
      const expiresAt = Math.floor(Date.now() / 1000) + 23 * 3600;
      await run({ address: u.wallet!, abi: walletAbi, functionName: "createInvite", args: [keccak256(toHex(code)), BigInt(expiresAt)] });
      invites.add({ code, name: name.trim(), wallet: u.wallet!, expiresAt });
      const url = `${origin()}/pair?w=${u.wallet}&c=${code}&n=${encodeURIComponent(name.trim())}`;
      setLink(url);
      setName("");
    } catch (e) {
      setMsg({ k: "err", t: explain(e).text });
    }
  }

  function openReply() {
    try {
      const url = new URL(reply.trim());
      if (!url.pathname.startsWith("/finish")) throw new Error();
      window.location.href = `/finish${url.search}`;
    } catch {
      setMsg({ k: "err", t: "Paste the full reply link your contact sent back." });
    }
  }

  return (
    <Shell>
      <section className="card">
        <h2>Verified contacts</h2>
        {u.contacts.length === 0 ? (
          <p className="muted">No contacts yet. Pair the people you pay often, and paying them becomes instant.</p>
        ) : (
          u.contacts.map((c) => (
            <div className="contact" key={c.addr}>
              <Avatar name={c.name} />
              <div className="meta">
                <div className="row between">
                  <span className="name">{c.name}</span>
                  <span className="badge go">Verified</span>
                </div>
                <div className="mono small muted">{short(c.addr)}</div>
                <Fingerprint addr={c.addr} />
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card caution">
        <h2>Pair someone new</h2>
        <p>They open your link and sign it in their own wallet. No gas for them. A scammer never receives the link, so they can never be paired.</p>
        <label className="field">
          <span>Their name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amit" />
        </label>
        <button className="btn primary block" disabled={busy} onClick={invite}>{busy ? "Creating invite" : "Create invite link"}</button>
        {link && (
          <div className="item pop" style={{ marginTop: 14 }}>
            <p style={{ fontWeight: 700 }}>Send this link to them on WhatsApp or Telegram:</p>
            <p className="mono small" style={{ wordBreak: "break-all" }}>{link}</p>
            <div className="grid2">
              <button className="btn" onClick={() => navigator.clipboard.writeText(link)}>Copy link</button>
              <a className="btn go" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent("Pair with me on Unpoison: " + link)}`}>WhatsApp</a>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Finish a pairing</h2>
        <p className="muted small">When they sign, they get a reply link. Paste it here (or just open it).</p>
        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="https://…/finish?…" />
        <button className="btn go block" style={{ marginTop: 10 }} onClick={openReply}>Open reply link</button>
        {pending.length > 0 && (
          <p className="small muted" style={{ marginTop: 12 }}>
            Waiting for: {pending.map((p) => p.name).join(", ")}
          </p>
        )}
        {msg && <Msg kind={msg.k}>{msg.t}</Msg>}
      </section>
    </Shell>
  );
}
