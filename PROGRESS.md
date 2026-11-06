# Unpoison — Progress

## NEEDS MANSI
1. **Private keys — `.env` was missing and I recreated it, but all key fields are EMPTY.** I cannot fill these.
   Paste the test keys yourself into `.env`: `DEPLOYER_PRIVATE_KEY`, `SCAMMER_PRIVATE_KEY`
   (and `AMIT_PRIVATE_KEY` only if a script must sign as Amit). Without `SCAMMER_PRIVATE_KEY`,
   `npm run poison` and `npm run raw-send` cannot run (STEP 4d).
2. **Which GitHub repo?** A remote already exists and points at `unpoison.git`, but the new instructions
   name `Ethglobal-project.git`. Waiting for Mansi to pick. See "Open problems".
3. **Faucet:** fund the scammer `0x75e9…2263` at https://faucet.circle.com so it has gas for the poison demo.
4. **Arkiv:** `ARKIV_PRIVATE_KEY` is empty — needed for STEP 7.

## Step log

### STEP 1 DONE: setup check
- Node **v22.19.0** (in the required 20–22 range), npm 10.9.3, git 2.52.0, forge 1.7.1 — all good.
- Arc Testnet RPC reachable: `eth_chainId` → `0x4cef52` = **5042002** ✓
- **Factory verified on chain, not redeployed.** `0xd062b660ddefceb7d753b2c6192d9f27e1024de4` has real bytecode,
  and its three function selectors match our local `UnpoisonFactory` exactly:
  `walletOf(address)`=`0x1982640c`, `usdc()`=`0x3e413bee`, `createWallet(uint256)`=`0x7a675bb6`.
  Live read `usdc()` → `0x3600000000000000000000000000000000000000` ✓
- Live read `walletOf(0xE3f8…eb4f)` → `0x0` — **wallet not created yet**, so STEP 4a is still to do.
- `.env` did not exist; recreated from `.env.example` with `FACTORY_ADDRESS` set. `web/.env.local` created with
  `NEXT_PUBLIC_FACTORY_ADDRESS`. Both confirmed gitignored (`git check-ignore`) and absent from `git status`.
- Empty `.env` keys: `DEPLOYER_PRIVATE_KEY`, `AMIT_PRIVATE_KEY`, `SCAMMER_PRIVATE_KEY`, `UNPOISON_WALLET`,
  `ARKIV_PRIVATE_KEY`, `ARKIV_ACCESS_KEY`.

### STEP 2 DONE: GitHub
Mansi chose to keep the existing repo: **https://github.com/Mansi2007275/unpoison.git**
(`Ethglobal-project.git` was not used). Branch was already `main`, so `git branch -M main` was a no-op.
No pull/merge was needed — the remote had no commits we did not already have. Pushed cleanly, `0 ahead / 0 behind`.
One transient DNS failure (`Could not resolve host: github.com`) hit mid-step; retried and it succeeded.

### Funding status (checked on chain)
| Account | Gas | USDC | Ready? |
| --- | --- | --- | --- |
| Owner `0xE3f8…eb4f` | 20.0 | 20.0 | ✅ |
| Amit `0x75E0…b263` | 20.0 | 20.0 | ✅ |
| Scammer `0x75e9…2263` | **0** | **0** | ❌ needs faucet before STEP 4d |

### STEP 3 DONE: install and build
- `npm install` → up to date, 496 packages, no errors.
- `npx next build` → **compiled successfully in 55s**, 11 routes, zero errors and zero type errors.
  Static: `/`, `/activity`, `/claim`, `/contacts`, `/finish`, `/pair`, `/send`, `/spam`. Dynamic: `/api/spam`.
- Dev server running at **http://localhost:3000** (Next confirms `Environments: .env.local`).
- Verified `NEXT_PUBLIC_FACTORY_ADDRESS` is compiled into the client bundle
  (`.next/static/chunks/app/page.js` and `layout.js` both contain the factory address).
- Note: a leftover `node` process from an earlier reaped dev server was still holding port 3000; it was stopped
  so the current server (with `.env.local` loaded) owns port 3000.

## Verification

### 1. Source matches the deployed contract
| Item | Result | Proof |
| --- | --- | --- |
| `MAX_DELAY` present in `UnpoisonWallet.sol` | **FAIL → FIXED** | It was **missing** from local source. Added `uint256 public constant MAX_DELAY = 30 days;` plus `\|\| > MAX_DELAY` → `revert BadDelay()` in the constructor, `tighten()` and `proposeChange()`. `BadDelay` reused, nothing else changed. |
| Test `test_delay_cappedAtMax` added | **PASS** | `contracts/test/UnpoisonWallet.t.sol`. Covers `tighten(2**64)` revert, `proposeChange(2**64,false)` revert, `tighten(30 days)` OK, `factory.createWallet(2**64)` revert (from a fresh owner, so `AlreadyHasWallet` cannot mask it). |
| `forge install` + `forge test` | **PASS 27/27** | `lib/` was missing; installed forge-std + openzeppelin-contracts v5.1.0 `--no-git`. `Suite result: ok. 27 passed; 0 failed; 0 skipped`. |
| Live: deployed code has the cap | **PASS** | `cast estimate createWallet(999999999999)` → `execution reverted, data: "0x0137f4a0"`, and `cast sig "BadDelay()"` = `0x0137f4a0`. |
| Live: cap is exactly 30 days | **PASS** | Boundary probe on the deployed factory: `59`→BadDelay, `60`→OK (gas 2948456), `2592000`→OK (gas 2948468), `2592001`→BadDelay, `2**64`→BadDelay. 2592000s = exactly 30 days. |
| `web/lib/abi.ts` regenerated | **PASS** | ABI did change (81 → 82 wallet entries; the new entry is `MAX_DELAY`). Regenerated from `contracts/out/`; 82 wallet + 6 factory entries. |

A note on what the live probe proves: our factory does **not** check the delay itself, so a `BadDelay` revert from
`createWallet` can only come from the `UnpoisonWallet` constructor. That is why the probe proves the *deployed
wallet* carries the cap. Before the patch, local source would have **accepted** 999999999999 — so the local source
and the deployed contract genuinely disagreed, and now they agree.

### 2. STEP 4 live tests (a–g)
**NOT RUN — blocked on Mansi.** `walletOf(owner)` is still `0x0`, so the wallet does not exist yet, and every
remaining sub-test depends on it. 4d additionally needs `SCAMMER_PRIVATE_KEY` (empty) and faucet funds for the
scammer (0 gas / 0 USDC on chain). Nothing here is reported as passing.

### 3. App checks
| Item | Result | Proof |
| --- | --- | --- |
| `npx next build` | **PASS** | `✓ Compiled successfully in 28.4s`, 11 routes, no type errors (re-run after the ABI + error-map edits). |
| Routes return 200 | **PASS** | `/`, `/send`, `/contacts`, `/activity`, `/spam`, `/pair`, `/finish`, `/claim` → all `200`. |
| `/api/spam` without `?wallet=` | **PASS** | Returns `400` (`"Pass ?wallet=0x…"`), not a crash. |
| `/api/spam?wallet=<my wallet>` with the poison tx + ≥2 reasons | **BLOCKED** | Needs the wallet from 4a and the poison tx from 4d. Probed with an EOA: the route handles it gracefully (`getContacts` returned no data) instead of crashing. |
| `/api/spam` finishes under 10s on serverless | **PASS (measured)** | The 50 000-block scan is **2.3s** over 6 sequential `getLogs` calls (10 000-block chunks) against the live RPC. No range reduction needed. Will re-measure with real data once the wallet exists. |
| Wrong network shows "Switch to Arc" | **PASS (code-verified, not clicked)** | `components/ui.tsx:59-62` — when `chainId !== arcTestnet.id` it renders a **Switch to Arc** button calling `switchChain`. `lib/hooks.ts:121` also auto-switches before any tx. Live click test belongs to STEP 4. |
| Contract errors in plain English | **PASS** | `lib/hooks.ts` `explain()` maps all four required: `LookalikeStopped` → "Stopped: this address looks like one of your contacts.", `InsufficientAvailable` → "Not enough free USDC in your Unpoison wallet.", `WrongMiddle` → "Those 6 characters don't match the address.", `TooEarly` → "Not yet. Wait for the timer to finish." Added `BadDelay` → "That undo delay is out of range. Pick between 1 minute and 30 days.", since the new cap makes it reachable. |

### Notes from this round
- `next build` run while `next dev` was live corrupted `.next` and made 7 routes return 500. Not an app bug:
  killed the server, removed `.next`, restarted, and all routes returned 200. Worth avoiding during the demo.
- One stale `node` process from an earlier reaped dev server had to be stopped to free port 3000.

## Deployed
| What | Value |
| --- | --- |
| UnpoisonFactory | `0xd062b660ddefceb7d753b2c6192d9f27e1024de4` |
| Arc Studio project | https://studio.arc.io/app/380fbb01-79b9-4a68-aeb6-63d86a20b962 |
| Network | Arc Testnet, chain 5042002 |
| USDC | `0x3600000000000000000000000000000000000000` |

## Phases
| Phase | Status | Proof |
| --- | --- | --- |
| A Contracts | ✅ pairing (EIP-712), lookalike stop (3+3 nibbles), Undo escrow, Handshake Pay, middle-check, vault (24h), timelocked settings | `forge test`: 26/26 (re-run pending in STEP 8; `contracts/lib` needs `forge install`) |
| A Deploy | ✅ deployed via Arc Studio, verified on chain in STEP 1 | selectors + `usdc()` match |
| B Frontend | ✅ Home, Contacts, /pair, /finish, Send, Activity, /claim, Spam | all 8 routes returned 200 locally |
| C Spam + attack | ⚠️ code done, **cannot run live** — needs `SCAMMER_PRIVATE_KEY` | blocked |
| D Arkiv | ⏳ STEP 7, needs `ARKIV_PRIVATE_KEY` | blocked |
| E Polish | partly | mobile 375px check pending in STEP 8 |
| F Docs | README needs Deployed + Arc Studio link + CROPS section | STEP 5 |

## Demo addresses
- Owner (Rahul): `0xE3f8da887397706Ddca28a8D27284f3bcE42eb4f`
- Amit (contact): `0x75E04Ef6D49aA13Ea1B3F7c9C82BA0B6a7F2b263`
- Lookalike / scammer: `0x75e9e0F33d0fa1B6538c69a34Ba00b4a1D0a2263` (starts `75e`, ends `263`, like Amit)

## Live test

### 4a — ✅ PASS (created by script, correct owner)
MetaMask's Confirm button was dead, so the wallet was created with `cast send` using `DEPLOYER_PRIVATE_KEY`.
The key's address was derived and checked **first**: it resolved to `0xE3f8da887397706Ddca28a8D27284f3bcE42eb4f`,
matching Rahul exactly, so it was safe to proceed. The key itself was never printed.

| Field | Value |
| --- | --- |
| **Unpoison wallet** | `0x069EebDEb5528693C877aAc71389F7B60B64961d` |
| `owner()` | `0xE3f8da887397706Ddca28a8D27284f3bcE42eb4f` ✅ Rahul, correct this time |
| `escrowDelay()` | 120 s |
| `MAX_DELAY()` | 2 592 000 = 30 days ✅ |
| `protectionEnabled()` | `true` |
| Tx | https://testnet.arcscan.app/tx/0x2afd91c13c9b64a86783ec62d78ec1aadd018bfb92a661bde39a9596829828cd |

Written to `.env` as `UNPOISON_WALLET` with an in-place `sed`, so no key values were ever read into the session.

### 4b — ✅ PASS (wallet holds 3 USDC)
Mansi had already sent 1 USDC from the app, so 2 more were sent by script to reach the 3 that 4b calls for.

| Reading | Value |
| --- | --- |
| `balanceOf(wallet)` | 3 000 000 = **3.0 USDC** ✅ |
| `available()` | 2 000 000 = 2.0 USDC (1.0 is locked, see 4g below) |
| `totalLocked` | 1 000 000 = 1.0 USDC |
| Deposit tx (2 USDC, by script) | https://testnet.arcscan.app/tx/0xfe0e3329ec2eaafa1cc674e9600839bd59f65734470a4474375373ee37936550 |
| Deposit tx (1 USDC, by Mansi in the app) | https://testnet.arcscan.app/tx/0xd4e4ab9f5b884285455db654288759ee6f8450b2890e4d048318e58a15e54b33 |

Arc quirk confirmed: that single 1 USDC deposit shows up as **two** Transfer logs in the same tx — once from the
native emitter `0xffff…fffe` at 18 decimals and once from the ERC-20 interface `0x3600…0000` at 6 decimals.
Native and ERC-20 USDC really do share one balance, exactly as the contract comment says.

### The fee fix is confirmed working on real hardware
The wallet had an unexplained 1 USDC locked, so the wallet's own events were decoded rather than guessed at.
It turned out to be a **`HandshakeCreated`** event — Mansi had already pushed a Handshake Pay through MetaMask
**after** the gas/fee fix. That is live proof the fix works: a real transaction was signed and mined from the UI.

| Field | Value |
| --- | --- |
| Escrow id | 0 |
| To | `0x75E04Ef6D49aA13Ea1B3F7c9C82BA0B6a7F2b263` (Amit) |
| Amount | 1.0 USDC |
| Claim deadline | 2026-11-07 06:13:25 UTC (~24h window) |
| Tx | https://testnet.arcscan.app/tx/0x1dce3954d95a77bbedff74fbb4cd943e4a1f4126b13159a467758de60fb5aac0 |

This is most of 4g's setup already done — it only needs Amit to claim it.

### 4c — ❌ FAIL: paired the wrong address (now cleaned up, needs redoing)
The app showed "amit · Verified", but the chain disagreed. `isContact(Amit)` read **`false`**, and
`getContacts()` returned:

```
[(0xE3f8da887397706Ddca28a8D27284f3bcE42eb4f, "amit")]
```

The **label** is "amit" but the **address is Rahul's own**. So during `/pair`, MetaMask was still on the Rahul
account when the invite was signed, and the reply carried Rahul's address as the contact.

**The contract is not at fault — it behaved exactly as designed.** `pairWithSignature` enforces
`ECDSA.recover(digest, signature) != contact → revert InvalidSignature` (line 171). Rahul signed for Rahul's own
address, so signer and contact matched and the pairing was legitimately accepted. That is precisely the security
property Unpoison claims: **you can only add an address you can sign for.** The guard never fired because no
forgery was attempted — the wrong address was simply supplied honestly.

Cleaned up with `removeContact(0xE3f8…eb4f)`:
https://testnet.arcscan.app/tx/0x64304e9ca43af1d30c640e8285b90810aeb89eb5c367ec00d08bfbed26e38642
`getContacts()` is now `[]` and both `isContact` reads are `false`, so the slate is clean for a correct pairing.
Note the first invite was consumed (`inv.used = true`), so a **new invite** is needed.

### 4d — partial: poison ✅, raw-send ❌ (blocked by 4c)
| Sub-test | Result | Proof |
| --- | --- | --- |
| `npm run poison` | **PASS** | Scammer sent 0.0001 USDC dust to the wallet. https://testnet.arcscan.app/tx/0xe0dad89f60c1a3dda532895722d413f7cf8f80bea75c71d705b50f9e0ee83f68 |
| `npm run raw-send` | **FAIL** | Prints `FAIL: the contract allowed it (is the real contact paired?)`. Correct behaviour: the scammer is a lookalike of **Amit**, and Amit is not a contact, so there is nothing for the guard to compare against. |
| `/api/spam` shows the poison tx | **FAIL** | Returns `{"items":[]}` in 3.86s (HTTP 200, so the route is healthy). |

**Why the spam tab is empty — traced, not guessed.** `app/api/spam/route.ts` only lists an item when
`signals.length >= 2`. For the dust tx only **one** signal fires:

- `dust` ✅ (0.0001 < 0.01)
- `lookalike` ❌ — `known` held only Rahul's address, and the scammer looks nothing like it
- `fakeToken` ❌ (real USDC), `notSigned` ❌ (incoming), `timing` ❌ (no real outgoing payments yet)

Once Amit is properly paired, `isLookalike(0x75e9…2263, 0x75E0…b263)` is true (`75e` + `263` match), giving
`["lookalike","dust"]` = 2 signals, and the bait will appear. **All three 4d/spam failures share the single
root cause of 4c.**

### Script fix: private keys without `0x`
`npm run raw-send` first crashed with `invalid private key, expected hex or 32 bytes, got string`.
`DEPLOYER_PRIVATE_KEY` was saved without the `0x` prefix (the scammer key had it, which is why `poison` worked).
Rather than ask for the file to be re-edited, `web/scripts/_env.ts` now normalises the key: trims whitespace,
strips stray quotes, adds `0x` when missing, and validates it is 64 hex chars with a clear error otherwise.
The key is never logged.

### 4c — ✅ PASS on the retry (paired by script, correct address this time)
`AMIT_PRIVATE_KEY` was verified first: it derives to `0x75E04Ef6D49aA13Ea1B3F7c9C82BA0B6a7F2b263`, matching Amit
exactly. The key was never printed.

The app still showed "amit · Verified" from a stale page, but the chain said `getContacts()` was `[]` — the old
entry had been removed. So pairing genuinely had to be redone, and was, as three on-chain steps:

| Step | Tx |
| --- | --- |
| 1. owner `createInvite` | https://testnet.arcscan.app/tx/0x565345d881450e0e5c76d22ebd1afc04bf9b1c8680dce0eefa4950cda3533eeb |
| 2. **Amit signs EIP-712** with his own key (off-chain) | signer verified = `0x75E0…b263` |
| 3. owner `pairWithSignature` | https://testnet.arcscan.app/tx/0x3429a996454e9e43fb325ca69f82679bdccd6541b9eb0145b41a7cf2fca2129a |

Verified by **address**, not by label this time — that was the trap the first attempt fell into:

```
getContacts()      = [(0x75E04Ef6D49aA13Ea1B3F7c9C82BA0B6a7F2b263, "Amit")]
isContact(Amit)    = true
isContact(Scammer) = false
```

### 4d — ✅ PASS (all three parts, after 4c was fixed)
| Sub-test | Result | Proof |
| --- | --- | --- |
| `npm run poison` | **PASS** | https://testnet.arcscan.app/tx/0xe0dad89f60c1a3dda532895722d413f7cf8f80bea75c71d705b50f9e0ee83f68 |
| `npm run raw-send` → `LookalikeStopped` | **PASS** | `OK: contract reverted with LookalikeStopped(0x75E04Ef6D49aA13Ea1B3F7c9C82BA0B6a7F2b263). No server involved.` The contract not only refused, it **named the contact being imitated**. |
| `/api/spam` shows the poison tx with ≥2 reasons | **PASS** | `signals: ["lookalike","dust"]`, `imitates: 0x75e04ef6…b263`, amount `0.000100`, HTTP 200 in **4.29s**. |

This is the headline demo result: with the web server irrelevant to the check, the **contract itself** stopped a
payment to a lookalike address and pointed at the real contact it was impersonating.

### 4g — ✅ PASS (Handshake Pay sent and claimed)
| Step | Detail | Tx |
| --- | --- | --- |
| owner `sendHandshake(Amit, 0.1 USDC, 1h)` → id **2** | success | https://testnet.arcscan.app/tx/0xce40a517bd2c32771fd0173da2ee03e97be4dc141d24ce8d84c205f48e877317 |
| **Amit** `claim(2, secret)` from his own account | success | https://testnet.arcscan.app/tx/0x16864554ee136ba40453dbdaa96f2dc9bda3e5c90729787d9d8d03040fb9aebe |

Final state `getEscrows()`:

```
id 0: Handshake 1.0 USDC -> Amit : Pending    (Mansi's own, from the app; she holds the link)
id 1: Handshake 0.1 USDC -> Amit : Pending    (orphaned, see below)
id 2: Handshake 0.1 USDC -> Amit : Claimed    <- 4g
```

Amit's USDC went **19.941518 → 20.039928** (+0.09841): the 0.1 arrived minus his gas, since gas on Arc is paid
in USDC. Escrow id 2 reads `Claimed`, exactly as 4g requires.

**One thing I got wrong, recorded honestly:** my first 4g attempt used a hand-written `escrows(uint256)` ABI, but
no such getter exists — the real one is `getEscrows()`. The read threw *after* the handshake had already been
created, and that script held the claim secret only in memory, so **escrow id 1 (0.1 USDC) can never be claimed**.
It is not lost: it becomes refundable once its 1-hour window passes, via `refund(1)`. The retry used the real
generated ABI from `lib/abi.ts` instead of a guess.

### Wallet state after 4a–4d + 4g
| Reading | Value |
| --- | --- |
| wallet USDC | 3.9001 |
| `totalLocked` | 1.1 (escrows 0 and 1, both Pending) |
| `available()` | 2.8001 |
| `escrowCount` | 3 |

Reconciled exactly against on-chain transfers: deposits 1 + 2 + 1 (Mansi, from the app, after the fee fix) +
0.0001 (scammer dust) − 0.1 (claimed by Amit) = **3.9001**. Nothing unexplained.

### Still to do — 4e and 4f (need Mansi in the app)
- **4e** red stop screen when the scammer address is pasted on Send.
- **4f** Undo: send 0.1 to a fresh address, then Undo it; escrow status must read `Cancelled`.
`isContact(0x75E0…b263)` reads **`false`**, so Amit is not a verified contact yet. This needs Amit's EIP-712
signature, and `AMIT_PRIVATE_KEY` is empty, so it cannot be scripted — Mansi must sign as Amit in MetaMask.
4d depends on this: `raw-send` can only show `LookalikeStopped` once Amit is an actual contact.

### Superseded: the earlier wrong-account wallet
A wallet **was** created, but with the **wrong owner**. Scanned the factory's `WalletCreated` events
(200 000 blocks): exactly one event exists.

| Field | Value |
| --- | --- |
| Owner recorded | `0x75E04Ef6D49aA13Ea1B3F7c9C82BA0B6a7F2b263` — **Amit**, not Rahul |
| Wallet created | `0x4b603902207A2439dFf7f95b12c81aE28D0e10cD` |
| escrowDelay | 120 s |
| Block | 70976847 |
| Tx | https://testnet.arcscan.app/tx/0x6e5b90abafb6064801679258d40d8899c5a5f392effa40cf5d7b9a479c2b30e7 |

So MetaMask was on the Amit account at "Create my wallet". Confirmed by reading state back:
`walletOf(0xE3f8…eb4f)` = `0x0` (Rahul still has **no** wallet) and `walletOf(0x75E0…b263)` = `0x4b60…10cD`.

**Why this matters for the demo:** Amit must stay the *contact*, because the scammer address is a lookalike of
Amit (`75e…263`). If Amit owns the wallet, the whole poisoning story breaks. Rahul must own the wallet.

**Fix:** Rahul creates his own wallet from `0xE3f8…eb4f`. The factory is one-wallet-per-owner, so Amit already
having one does not block Rahul. The stray Amit wallet is harmless and can simply be ignored — no redeploy, no
cleanup needed.

**Bonus proof from this wallet:** reading `MAX_DELAY()` on the live instance `0x4b60…10cD` returns
`2592000` = exactly 30 days. That confirms the deployed *wallet* carries the cap, from real deployed state and
not only from a gas estimate.

### MetaMask fee fix (done) — and why Confirm was greyed out
MetaMask's Confirm button was disabled on "Create my wallet" because the fee never loaded. Probing Arc Testnet
shows why:

| Reading | Value |
| --- | --- |
| `estimateFeesPerGas().maxFeePerGas` | 24 gwei |
| `estimateFeesPerGas().maxPriorityFeePerGas` | **0** |
| `getGasPrice()` | 20 gwei |
| block `baseFeePerGas` | 20 gwei |
| `estimateContractGas(createWallet(120))` | 2 948 456 (→ 3 538 147 with 20% head-room) |

Arc *does* support EIP-1559, but it reports a **zero** priority fee, which is what trips up MetaMask's fee UI.

Fix in `web/lib/hooks.ts` (`useTx`): after simulating, the app now estimates gas itself
(`estimateContractGas × 12 / 10`) and passes explicit fees — `maxFeePerGas` + `maxPriorityFeePerGas` from
`estimateFeesPerGas()`, falling back to `gasPrice` from `getGasPrice()`, never both. Both helpers degrade
gracefully: if an estimate fails the send still proceeds and the wallet prices it.

Worth noting: the zero-priority-fee check uses `!= null`, **not** truthiness. With a plain `if (value)` the
legitimate `0n` would look falsy and wrongly fall back to legacy pricing.

Every write in the app goes through `run()`, so the wallet creation **and** the USDC deposit are both covered by
this one change. `next build` passes and all 8 routes return 200 after the fix.

### `.env` keys — still empty on disk
Checked by name only (values never read or printed): `DEPLOYER_PRIVATE_KEY`, `AMIT_PRIVATE_KEY`,
`SCAMMER_PRIVATE_KEY`, `ARKIV_PRIVATE_KEY` and `UNPOISON_WALLET` are all **EMPTY**; only `FACTORY_ADDRESS` is set.
Searched the project for stray files (`*.env*`): only `.env`, `.env.example`, `web/.env.local` exist, so the keys
did not land in a misnamed file such as `.env.txt`. The scripts in 4d cannot run until these are filled.

### Funding — now good
Scammer `0x75e9…2263` is funded: **20 gas, 20 USDC** (faucet worked). Owner and Amit both 20/20.

## Open problems
- **History was already rewritten before these instructions arrived.** In the previous session the repo was
  reorganised into 7 commits on a new `main` branch and pushed to `https://github.com/Mansi2007275/unpoison.git`.
  The old 2-commit history is still intact locally on the `master` branch — nothing was lost, and no force push
  was used (the remote was empty). From here on: no further rewriting, as instructed.
- **Two candidate GitHub repos.** Existing remote `origin` → `unpoison.git` (already has all 7 commits).
  New instructions name `Ethglobal-project.git`. Need Mansi's choice before STEP 2 pushes anything.
- `contracts/lib/forge-std` is not vendored in git (correctly gitignored), so `forge install foundry-rs/forge-std`
  is required before `forge test` will run on this machine.

## Next
STEP 2 (blocked on repo choice) → STEP 3 build → STEP 4 live test with Mansi clicking MetaMask.
