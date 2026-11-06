"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { keccak256, parseEventLogs } from "viem";
import { walletAbi } from "@/lib/abi";
import { explorerTx } from "@/lib/chain";
import { fmtUsdc, isAddr, isLookalike, randomHex32, short, toUnits } from "@/lib/addr";
import { explain, useTx, useUnpoison } from "@/lib/hooks";
import { claims, origin } from "@/lib/local";
import { Avatar, Fingerprint, Msg, NeedWallet, Shell, Specimen } from "@/components/ui";

type Result = { kind: "instant" | "undo" | "handshake"; hash: string; link?: string; to: string; amount: string };

export default function Send() {
  const u = useUnpoison();
  const { run, busy } = useTx();
  const [picked, setPicked] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [middle, setMiddle] = useState("");
  const [overriding, setOverriding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [contractStop, setContractStop] = useState<string | null>(null);

  const target = manual ? to.trim() : picked ?? "";
  const contact = u.contacts.find((c) => c.addr.toLowerCase() === target.toLowerCase());
  const lookalikeOf = useMemo(() => {
    if (!isAddr(target) || contact) return undefined;
    const hit = u.contacts.find((c) => isLookalike(target, c.addr));
    if (hit) return hit;
    if (contractStop) return u.contacts.find((c) => c.addr.toLowerCase() === contractStop.toLowerCase());
    return undefined;
  }, [target, contact, u.contacts, contractStop]);

  if (!u.wallet) return <Shell><NeedWallet /></Shell>;

  const state: "none" | "go" | "stop" | "wait" = !isAddr(target) ? "none" : contact ? "go" : lookalikeOf ? "stop" : "wait";

  function reset() {
    setDone(null);
    setAmount("");
    setTo("");
    setPicked(null);
    setMiddle("");
    setOverriding(false);
    setContractStop(null);
  }

  async function pay(mode: "send" | "handshake" | "middle") {
    setErr(null);
    let v: bigint;
    try {
      v = toUnits(amount);
      if (v === 0n) throw new Error("Enter an amount above 0.");
    } catch (e) {
      return setErr((e as Error).message);
    }
    try {
      if (mode === "handshake") {
        const secret = randomHex32();
        const { hash, receipt } = await run({
          address: u.wallet!,
          abi: walletAbi,
          functionName: "sendHandshake",
          args: [target, v, keccak256(secret), 86400n],
        });
        const ev = parseEventLogs({ abi: walletAbi, logs: receipt.logs, eventName: "HandshakeCreated" })[0];
        const id = (ev?.args as { id: bigint }).id.toString();
        const link = `${origin()}/claim?w=${u.wallet}&id=${id}&s=${secret}`;
        claims.add({ wallet: u.wallet!, id, link, to: target });
        setDone({ kind: "handshake", hash, link, to: target, amount });
      } else if (mode === "middle") {
        const { hash } = await run({ address: u.wallet!, abi: walletAbi, functionName: "confirmWithMiddle", args: [target, v, middle.toLowerCase()] });
        setDone({ kind: "undo", hash, to: target, amount });
      } else {
        const { hash } = await run({ address: u.wallet!, abi: walletAbi, functionName: "send", args: [target, v] });
        setDone({ kind: contact ? "instant" : "undo", hash, to: target, amount });
      }
      u.refetch();
    } catch (e) {
      const x = explain(e);
      if (x.name === "LookalikeStopped" && x.args?.[0]) setContractStop(String(x.args[0]));
      else setErr(x.text);
    }
  }

  if (done) return <Shell><Done r={done} name={contact?.name} onAgain={reset} /></Shell>;

  return (
    <Shell>
      {state !== "stop" && (
        <section className="card">
          <h2>Who are you paying?</h2>
          {u.contacts.length === 0 && !manual && (
            <p className="muted">No verified contacts yet. <Link href="/contacts">Pair someone</Link> or pay a new address.</p>
          )}
          {!manual &&
            u.contacts.map((c) => (
              <button key={c.addr} className={`contact ${picked === c.addr ? "selected" : ""}`} onClick={() => setPicked(c.addr)}>
                <Avatar name={c.name} />
                <span className="meta">
                  <span className="name">{c.name}</span>
                  <br />
                  <Fingerprint addr={c.addr} />
                </span>
                <span className="badge go">Verified</span>
              </button>
            ))}
          {manual ? (
            <label className="field" style={{ marginTop: 4 }}>
              <span>New address</span>
              <input className="mono" value={to} onChange={(e) => { setTo(e.target.value); setContractStop(null); }} placeholder="0x…" spellCheck={false} />
            </label>
          ) : null}
          <button className="btn ghost small" style={{ marginTop: 12 }} onClick={() => { setManual(!manual); setPicked(null); setTo(""); }}>
            {manual ? "Pick a verified contact instead" : "Pay a new address"}
          </button>
        </section>
      )}

      {state === "stop" && lookalikeOf && (
        <section className="card hazard shake" aria-live="assertive">
          <div className="hazard-tape" aria-hidden />
          <h1>Stop. This is not {lookalikeOf.name}.</h1>
          <p style={{ fontWeight: 600 }}>
            It starts and ends like {lookalikeOf.name}&apos;s address, but the middle is different. This is how address poisoning steals money.
          </p>
          <Specimen addr={lookalikeOf.addr} title={`${lookalikeOf.name}, verified ✓`} tone="go" />
          <Specimen addr={target} against={lookalikeOf.addr} title="Pasted address ✕" tone="stop" />
          <div className="stack" style={{ marginTop: 14 }}>
            <button className="btn go block" onClick={() => { setManual(false); setPicked(lookalikeOf.addr); setTo(""); setContractStop(null); }}>
              Pay {lookalikeOf.name} instead
            </button>
            {!overriding ? (
              <button className="btn block" onClick={() => setOverriding(true)}>I&apos;m sure, check the middle</button>
            ) : (
              <div className="item">
                <p className="small" style={{ fontWeight: 700 }}>Type characters 17 to 22 of the address you want to pay. Even then, the money waits so you can undo.</p>
                <input className="mono" maxLength={6} value={middle} onChange={(e) => setMiddle(e.target.value)} placeholder="6 characters" />
                <label className="field" style={{ marginTop: 10 }}>
                  <span>Amount (USDC)</span>
                  <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10" />
                </label>
                <button className="btn wait block" disabled={busy || middle.length !== 6} onClick={() => pay("middle")}>Send with Undo</button>
                <p className="small muted" style={{ marginTop: 8 }}>Read them from where you got the address, like the receiver&apos;s screen or invoice, not from your history.</p>
              </div>
            )}
          </div>
          {err && <Msg kind="err">{err}</Msg>}
        </section>
      )}

      {(state === "go" || state === "wait") && (
        <section className={`card ${state === "go" ? "antidote" : "caution"} pop`}>
          <h2>{state === "go" ? `${contact!.name} is verified` : "New address"}</h2>
          <p>
            {state === "go"
              ? "This exact address signed your invite. The payment is instant."
              : "Not a contact, and it doesn't look like one. Choose how it should wait."}
          </p>
          {state === "wait" && <Specimen addr={target} title={short(target)} tone="wait" />}
          <label className="field" style={{ marginTop: 12 }}>
            <span>Amount (USDC) · {fmtUsdc(u.available)} free</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10" autoFocus />
          </label>
          {state === "go" ? (
            <button className="btn primary block" disabled={busy} onClick={() => pay("send")}>{busy ? "Sending" : `Pay ${contact!.name}`}</button>
          ) : (
            <div className="stack">
              <button className="btn block" disabled={busy} onClick={() => pay("send")}>
                Send with Undo · waits 2 min
              </button>
              <button className="btn primary block" disabled={busy} onClick={() => pay("handshake")}>
                Handshake Pay · they claim it
              </button>
              <p className="small">Handshake Pay: money moves only when the receiver claims it with your link. If nobody claims it in 24 hours, it comes back.</p>
            </div>
          )}
          {err && <Msg kind="err">{err}</Msg>}
        </section>
      )}
    </Shell>
  );
}

function Done({ r, name, onAgain }: { r: Result; name?: string; onAgain: () => void }) {
  const title =
    r.kind === "instant" ? `Paid ${name ?? short(r.to)}.` : r.kind === "undo" ? "Waiting. You can still undo." : "Locked until they claim it.";
  return (
    <section className={`card ${r.kind === "instant" ? "antidote" : r.kind === "undo" ? "caution" : "poison"} pop`}>
      <h1>{title}</h1>
      <p>{r.amount} USDC to <span className="mono">{short(r.to)}</span>.</p>
      {r.link && (
        <div className="item" style={{ color: "var(--ink)" }}>
          <p style={{ fontWeight: 700 }}>Send this claim link to the receiver, outside the blockchain:</p>
          <p className="mono small" style={{ wordBreak: "break-all" }}>{r.link}</p>
          <div className="grid2">
            <button className="btn" onClick={() => navigator.clipboard.writeText(r.link!)}>Copy link</button>
            <a className="btn go" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent("Claim your USDC: " + r.link)}`}>WhatsApp</a>
          </div>
        </div>
      )}
      <div className="grid2" style={{ marginTop: 14 }}>
        <a className="btn" href={explorerTx(r.hash)} target="_blank" rel="noreferrer">View on Arcscan</a>
        {r.kind === "instant" ? <button className="btn" onClick={onAgain}>Send again</button> : <Link className="btn" href="/activity">Open Activity</Link>}
      </div>
    </section>
  );
}
