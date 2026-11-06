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

### STEP 2 — BLOCKED (waiting on Mansi)
A remote already exists: `origin` → `https://github.com/Mansi2007275/unpoison.git`, already holding all 7 commits
on `main`. The new instructions name a different repo, `Ethglobal-project.git`, but only "if no remote exists" —
and one does. Not guessing which repo should receive the submission. Nothing pushed this step.

### STEP 3 DONE: install and build
- `npm install` → up to date, 496 packages, no errors.
- `npx next build` → **compiled successfully in 55s**, 11 routes, zero errors and zero type errors.
  Static: `/`, `/activity`, `/claim`, `/contacts`, `/finish`, `/pair`, `/send`, `/spam`. Dynamic: `/api/spam`.
- Dev server running at **http://localhost:3000** (Next confirms `Environments: .env.local`).
- Verified `NEXT_PUBLIC_FACTORY_ADDRESS` is compiled into the client bundle
  (`.next/static/chunks/app/page.js` and `layout.js` both contain the factory address).
- Note: a leftover `node` process from an earlier reaped dev server was still holding port 3000; it was stopped
  so the current server (with `.env.local` loaded) owns port 3000.

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
_Tx hashes and Arcscan links go here once STEP 4 runs._

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
