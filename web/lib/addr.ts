/** Address helpers that mirror the contract's rules exactly. */

export const MATCH = 3;

export const hex40 = (a: string) => a.toLowerCase().replace(/^0x/, "");

export const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a.trim());

/** Same rule as UnpoisonWallet.isLookalike: different, but >= 3 leading AND >= 3 trailing hex chars match. */
export function isLookalike(a: string, b: string): boolean {
  const x = hex40(a), y = hex40(b);
  if (x === y) return false;
  return x.slice(0, MATCH) === y.slice(0, MATCH) && x.slice(-MATCH) === y.slice(-MATCH);
}

/** The 6 characters (1-based positions 17-22) the contract asks for in confirmWithMiddle. */
export const middleSix = (a: string) => hex40(a).slice(16, 22);

export const short = (a: string) => `0x${hex40(a).slice(0, 4)}…${hex40(a).slice(-4)}`;

/** Per-character match against a reference address, for the specimen strip. */
export function diffChars(a: string, ref?: string) {
  const x = hex40(a);
  const y = ref ? hex40(ref) : x;
  return x.split("").map((c, i) => ({ c, same: c === y[i] }));
}

// 256 visually distinct emoji: one per byte value.
const EMOJI = Array.from(
  "🍎🍊🍋🍉🍇🍓🫐🍒🍑🥭🍍🥥🥝🍅🥑🍆🥔🥕🌽🌶🥒🥬🥦🧄🧅🍄🥜🌰🍞🥐🥖🥨🥯🥞🧇🧀🍖🍗🥩🥓🍔🍟🍕🌭🥪🌮🌯🥙🧆🥚🍳🥘🍲🥣🥗🍿🧈🧂🥫🍱🍘🍙🍚🍛🍜🍝🍠🍢🍣🍤🍥🥮🍡🥟🥠🥡🦀🦞🦐🦑🦪🍦🍧🍨🍩🍪🎂🍰🧁🥧🍫🍬🍭🍮🍯🍼🥛☕🍵🧃🥤🧋🍶🍺🍷🥂🥃🍸🍹🧉🍾🧊🥄🍴🥢🏺🌍🗺🗾🧭🏔⛰🌋🗻🏕🏖🏜🏝🏞🏟🏛🏗🧱🛖🏘🏚🏠🏡🏢🏣🏤🏥🏦🏨🏩🏪🏫🏬🏭🏯🏰💒🗼🗽⛪🕌🛕🕍⛩🕋⛲⛺🌁🌃🏙🌄🌅🌆🌇🌉🎠🎡🎢💈🎪🚂🚃🚄🚅🚆🚇🚈🚉🚊🚝🚞🚋🚌🚍🚎🚐🚑🚒🚓🚔🚕🚖🚗🚘🚙🛻🚚🚛🚜🏎🏍🛵🦽🦼🛺🚲🛴🛹🛼🚏🛣🛤🛢⛽🚨🚥🚦🛑🚧⚓⛵🛶🚤🛳⛴🛥🚢✈🛩🛫🛬🪂💺🚁🚟🚠🚡🛰🚀🛸🛎🧳⌛⏳⌚⏰⏱⏲🕰🌑🌒🌓🌔🌕🌖🌗🌘🌙🌚🌛🌜🌡☀🌝🌞🪐⭐🌟🌠🌌☁⛅🌀🌈🌂☂☔⚡❄☃⛄☄🔥💧🌊🎃🎄🎆🎇🧨✨🎈🎉🎊🎋🎍🎎🎏🎐🎑🧧🎀🎁🎗🎟🎫🎖🏆🏅🥇🥈🥉⚽⚾🥎🏀🏐🏈🏉🎾🥏🎳🏏🏑🏒🥍🏓🏸🥊🥋🥅⛳⛸🎣🤿🎽🎿🛷🥌🎯🪀🪁🎱🔮🪄🧿🎮🕹🎰🎲🧩🧸🪅🪆♠♥♦♣♟🃏🀄🎴🎭🖼🎨🧵🪡🧶🪢👓🕶🥽🥼🦺👔👕👖🧣🧤🧥🧦👗👘🥻🩱🩲🩳👙👚👛👜👝🛍🎒🩴👞👟🥾🥿👠👡🩰👢👑👒🎩🎓🧢🪖⛑📿💄💍💎",
).slice(0, 256);

/** 8-emoji fingerprint built from the address bytes; one changed byte gives a different emoji. */
export function fingerprint(a: string, n = 8): string[] {
  const h = hex40(a);
  const bytes: number[] = [];
  for (let i = 0; i < 40; i += 2) bytes.push(parseInt(h.slice(i, i + 2), 16));
  // Mix every byte into each emoji slot so a change anywhere in the address changes the picture.
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    let acc = (k * 131) & 0xff;
    for (let i = 0; i < 20; i++) acc = (acc * 31 + bytes[i] + k * 7 + i) & 0xff;
    out.push(EMOJI[acc % EMOJI.length]);
  }
  return out;
}

export const fmtUsdc = (v?: bigint) => {
  if (v === undefined) return "—";
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toLocaleString("en-IN")}.${frac}`;
};

export const toUnits = (s: string): bigint => {
  const [w, f = ""] = s.trim().split(".");
  if (!/^\d+$/.test(w || "0") || !/^\d*$/.test(f)) throw new Error("Enter an amount like 10 or 2.5");
  return BigInt(w || "0") * 1_000_000n + BigInt((f + "000000").slice(0, 6));
};

export const randomHex32 = (): `0x${string}` => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
};
