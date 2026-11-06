"use client";

import Link from "next/link";
import { useState } from "react";
import { factoryAbi } from "@/lib/abi";
import { FACTORY, USDC, erc20Abi, explorerAddr } from "@/lib/chain";
import { fmtUsdc, toUnits } from "@/lib/addr";
import { explain, useTx, useUnpoison } from "@/lib/hooks";
import { ConnectButton, Fingerprint, Msg, Shell, Specimen } from "@/components/ui";

// A real-looking pair for the hero: same first 3 and last 3 characters, different middle.
const REAL = "0x7a3f91bc04e1d2a95c7be0d84f13a6e2c9b4e4d2";
const FAKE = "0x7a35d0ab71f3e6c80b2a9f4d1e57c08ab71f94d2";

export default function Home() {
  const u = useUnpoison();
  const { run, busy } = useTx();
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null);

  if (!u.isConnected) return <Shell><Hero /></Shell>;

  async function create() {
    setMsg(null);
    try {
      await run({ address: FACTORY, abi: factoryAbi, functionName: "createWallet", args: [120n] });
      setMsg({ k: "ok", t: "Wallet created. Add some USDC to start." });
      u.refetch();
    } catch (e) {
      setMsg({ k: "err", t: explain(e).text });
    }
  }

  async function deposit() {
    setMsg(null);
    try {
      const v = toUnits(amount);
      await run({ address: USDC, abi: erc20Abi, functionName: "transfer", args: [u.wallet!, v] });
      setMsg({ k: "ok", t: `Added ${amount} USDC.` });
      setAmount("");
      u.refetch();
    } catch (e) {
      setMsg({ k: "err", t: explain(e).text });
    }
  }

  if (!FACTORY)
    return (
      <Shell>
        <Msg kind="err">Set NEXT_PUBLIC_FACTORY_ADDRESS in web/.env.local after deploying the factory.</Msg>
      </Shell>
    );

  if (!u.wallet)
    return (
      <Shell>
        <div className="card poison pop">
          <h1>One wallet. Zero poison.</h1>
          <p>Create your Unpoison wallet on Arc. Payments to verified contacts are instant; everything else can be undone.</p>
          <button className="btn go block" disabled={busy || u.loadingWallet} onClick={create}>
            {busy ? "Creating" : "Create my wallet"}
          </button>
          <p className="small" style={{ marginTop: 10 }}>Demo setting: unknown payments wait 2 minutes.</p>
        </div>
        {msg && <Msg kind={msg.k}>{msg.t}</Msg>}
      </Shell>
    );

  return (
    <Shell>
      <section className="card poison">
        <div className="row between">
          <span className="badge go">🛡️ Protection on</span>
          <a className="small" href={explorerAddr(u.wallet)} target="_blank" rel="noreferrer">Arcscan</a>
        </div>
        <div className="balance" style={{ marginTop: 16 }}>
          {fmtUsdc(u.balance)}
          <small>USDC</small>
        </div>
        <p className="small" style={{ marginTop: 8 }}>
          {fmtUsdc(u.available)} free to send · {fmtUsdc(u.balance !== undefined && u.available !== undefined ? u.balance - u.available : undefined)} waiting
        </p>
        <div className="grid2" style={{ marginTop: 14 }}>
          <Link href="/send" className="btn go">Send</Link>
          <Link href="/contacts" className="btn">Add contact</Link>
        </div>
      </section>

      <section className="card">
        <h2>Add USDC</h2>
        <p className="muted small">From your connected wallet ({fmtUsdc(u.myBalance)} USDC available).</p>
        <div className="row">
          <input inputMode="decimal" placeholder="10" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount in USDC" />
          <button className="btn primary" disabled={busy || !amount} onClick={deposit}>Add</button>
        </div>
        {msg && <Msg kind={msg.k}>{msg.t}</Msg>}
      </section>

      <section className="card flat">
        <h3>Your Unpoison wallet</h3>
        <p className="mono small" style={{ wordBreak: "break-all" }}>{u.wallet}</p>
        <Fingerprint addr={u.wallet} />
        <p className="muted small" style={{ marginTop: 8 }}>Every address gets an emoji fingerprint. Same emoji, same address.</p>
      </section>

      <section className="card">
        <div className="row between">
          <div>
            <h3>{u.contacts.length} verified contact{u.contacts.length === 1 ? "" : "s"}</h3>
            <p className="muted small" style={{ margin: 0 }}>Paying them is instant and can't be poisoned.</p>
          </div>
          <Link className="btn" href="/contacts">Manage</Link>
        </div>
      </section>
    </Shell>
  );
}

function Hero() {
  return (
    <section className="hero">
      <span className="badge stop">$76M lost to address poisoning last year</span>
      <h1 style={{ marginTop: 16 }}>Two addresses.<br /><em style={{ color: "var(--brass)" }}>One</em> is your friend.</h1>
      <p className="muted">Scammers make an address that starts and ends like Amit&apos;s, then slip it into your history. Most wallets show both as <span className="mono">0x7a3f…e4d2</span>. Unpoison reads all 40 characters, and the contract refuses the fake.</p>
      <div className="card poison" style={{ marginTop: 18 }}>
        <Specimen addr={REAL} title="Amit · verified" tone="go" />
        <Specimen addr={FAKE} against={REAL} title="Lookalike · stopped" tone="stop" />
        <p className="small muted" style={{ margin: "12px 0 0" }}>Same ends, different DNA. The glowing bars are the part scammers hope you never read.</p>
      </div>
      <ConnectButton />
      <div style={{ marginTop: 28 }}>
        <h2>How it protects you</h2>
        <ol className="steps">
          <li><span className="n">1</span><div><strong>Pair once.</strong> <span className="muted">Your contact signs an invite with their own key. A scammer never gets it, so a fake can never become a contact.</span></div></li>
          <li><span className="n">2</span><div><strong>Pay by name.</strong> <span className="muted">No copying addresses from history, ever.</span></div></li>
          <li><span className="n">3</span><div><strong>Undo the rest.</strong> <span className="muted">New addresses wait in the contract. Tap Undo, or let the receiver claim it with your link.</span></div></li>
        </ol>
      </div>
    </section>
  );
}
