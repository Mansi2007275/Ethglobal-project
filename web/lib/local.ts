"use client";

/** Small per-browser notes (invite codes, claim links). Nothing here is needed for safety: the contract enforces the rules. */
export type InviteNote = { code: string; name: string; wallet: string; expiresAt: number };
export type ClaimNote = { wallet: string; id: string; link: string; to: string };

function read<T>(k: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(k) || "[]") as T[];
  } catch {
    return [];
  }
}
function write<T>(k: string, v: T[]) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage blocked: links still work */
  }
}

export const invites = {
  all: () => read<InviteNote>("unpoison.invites"),
  add: (n: InviteNote) => write("unpoison.invites", [n, ...read<InviteNote>("unpoison.invites")].slice(0, 20)),
  remove: (code: string) => write("unpoison.invites", read<InviteNote>("unpoison.invites").filter((x) => x.code !== code)),
};

export const claims = {
  all: () => read<ClaimNote>("unpoison.claims"),
  add: (n: ClaimNote) => write("unpoison.claims", [n, ...read<ClaimNote>("unpoison.claims")].slice(0, 50)),
  find: (wallet: string, id: string) => read<ClaimNote>("unpoison.claims").find((x) => x.wallet === wallet && x.id === id),
};

export const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
