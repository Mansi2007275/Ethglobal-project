"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import type { CSSProperties, ReactNode } from "react";
import { diffChars, fingerprint, hex40, short } from "@/lib/addr";
import { arcTestnet } from "@/lib/chain";
import { useSpam, useUnpoison } from "@/lib/hooks";

export function Shell({ children }: { children: ReactNode }) {
  const { wallet } = useUnpoison();
  const spam = useSpam(wallet);
  const spamCount = spam.data?.length;
  return (
    <div className="app">
      <TopBar />
      <main>{children}</main>
      <Nav spamCount={spamCount} />
    </div>
  );
}

/** Logo: a seal ring with a check, brass on night. */
function LogoMark() {
  return (
    <svg viewBox="0 0 34 34" width="34" height="34" aria-hidden>
      <circle cx="17" cy="17" r="15.5" fill="none" stroke="#e3bd78" strokeWidth="1.5" />
      <circle cx="17" cy="17" r="11" fill="none" stroke="#e3bd78" strokeWidth="1" strokeDasharray="1.5 2.5" />
      <path d="M11.5 17.5l3.6 3.6 7.4-7.6" fill="none" stroke="#f2ede4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TopBar() {
  return (
    <header className="top">
      <Link href="/" className="logo" aria-label="Unpoison home">
        <span className="logo-mark"><LogoMark /></span>
        Unpoison
      </Link>
      <ConnectButton />
    </header>
  );
}

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected)
    return (
      <button className="btn primary" disabled={isPending} onClick={() => connect({ connector: connectors[0] })}>
        {isPending ? "Connecting" : "Connect"}
      </button>
    );
  if (chainId !== arcTestnet.id)
    return (
      <button className="btn wait" onClick={() => switchChain({ chainId: arcTestnet.id })}>
        Switch to Arc
      </button>
    );
  return (
    <button className="btn ghost small" onClick={() => disconnect()} title="Disconnect">
      <span className="mono">{short(address!)}</span>
    </button>
  );
}

const I = {
  home: <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />,
  send: <path d="M5 12h13M13 6l6 6-6 6" />,
  contacts: <><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" /><path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.8c1.4.6 2.5 2 3 4.2" /></>,
  activity: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  spam: <><path d="M12 3.5l8 3v5.5c0 4.5-3.4 7.6-8 8.5-4.6-.9-8-4-8-8.5V6.5z" /><path d="M9 9l6 6M15 9l-6 6" /></>,
};

const TABS = [
  { href: "/", label: "Home", ico: I.home },
  { href: "/send", label: "Send", ico: I.send },
  { href: "/contacts", label: "Contacts", ico: I.contacts },
  { href: "/activity", label: "Activity", ico: I.activity },
  { href: "/spam", label: "Spam", ico: I.spam },
];

function Nav({ spamCount }: { spamCount?: number }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={path === t.href ? "on" : ""} aria-current={path === t.href ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {t.ico}
          </svg>
          <span>
            {t.label}
            {t.href === "/spam" && spamCount ? <span className="dot">{spamCount}</span> : null}
          </span>
        </Link>
      ))}
    </nav>
  );
}

export function Fingerprint({ addr }: { addr: string }) {
  return (
    <span className="fp" aria-label="Address fingerprint">
      {fingerprint(addr).join("")}
    </span>
  );
}

/** Address DNA: one bar per hex character. Height and hue come from the character's value,
 *  so two addresses that share only their ends look obviously different in the middle. */
export function Dna({ addr, against, reveal = true }: { addr: string; against?: string; reveal?: boolean }) {
  const chars = diffChars(addr, against);
  return (
    <div className={`dna ${against ? "compare" : ""} ${reveal ? "reveal" : ""}`} aria-hidden style={{ alignItems: "end" }}>
      {chars.map((x, i) => {
        const v = parseInt(x.c, 16);
        const style = {
          height: `${28 + (v / 15) * 72}%`,
          background: `oklch(0.78 0.11 ${(v * 22.5 + 30) % 360})`,
          "--i": i,
        } as CSSProperties;
        return <i key={i} style={style} className={against ? (x.same ? "same" : "diff") : ""} />;
      })}
    </div>
  );
}

/** The signature element: DNA ribbon + the address in 4-char groups; characters that differ from `against` light up coral. */
export function Specimen({
  addr,
  against,
  title,
  tone,
}: {
  addr: string;
  against?: string;
  title: ReactNode;
  tone: "go" | "stop" | "wait";
}) {
  const chars = diffChars(addr, against);
  const groups = Array.from({ length: 10 }, (_, i) => chars.slice(i * 4, i * 4 + 4));
  return (
    <div className="specimen">
      <div className={`specimen-head ${tone}`}>
        <span><span className="dotx" />{title}</span>
      </div>
      <Dna addr={addr} against={against} />
      <div className="hexline" aria-label={`0x${hex40(addr)}`}>
        <span className="ch same">0x</span>
        {groups.map((g, i) => (
          <span className="grp" key={i}>
            {g.map((x, j) => (
              <span key={j} className={`ch ${against ? (x.same ? "same" : "diff") : ""}`}>{x.c}</span>
            ))}
          </span>
        ))}
      </div>
      <div className="specimen-foot">
        <Fingerprint addr={addr} />
      </div>
    </div>
  );
}

export function Msg({ kind, children }: { kind: "err" | "ok"; children: ReactNode }) {
  return (
    <div className={`msg ${kind}`} role={kind === "err" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return <span className="avatar" aria-hidden>{(name || "?").slice(0, 1).toUpperCase()}</span>;
}

export function NeedWallet() {
  return (
    <div className="card">
      <h2>Set up your wallet first</h2>
      <p className="muted">Connect and create your Unpoison wallet on the Home tab.</p>
      <Link href="/" className="btn primary block">Go to Home</Link>
    </div>
  );
}
