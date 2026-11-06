# Unpoison — Progress

## NEEDS MANSI
1. **Faucet:** fund 3 wallets at https://faucet.circle.com — you `0xE3f8…eb4f`, Amit `0x75E0…b263`, scammer `0x75e9…2263`.
2. **Private keys:** paste your test wallet key into `.env` as `DEPLOYER_PRIVATE_KEY` (Amit's only if a script signs as him).
3. **Arc Studio (needed for the Arc prize):** this code was built outside Arc Studio. Open https://studio.arc.io, create
   project "Unpoison", give it SPEC.md Phase A (or import `contracts/src/*.sol`), let Studio review + deploy, and put the
   `studio.arc.io/app/…` link in README.md. Ask the Arc booth which is accepted: Studio-generated or imported code.
4. **Deploy:** `cd contracts && forge script script/Deploy.s.sol --rpc-url arc_testnet --private-key <key> --broadcast`,
   then paste the factory address into `web/.env.local` and `.env`.

## Done
| Phase | Status | Proof |
| --- | --- | --- |
| A Contracts | ✅ UnpoisonFactory + UnpoisonWallet: pairing (EIP-712), lookalike stop (3+3 nibbles), Undo escrow, Handshake Pay, middle-check, vault (24h), timelocked settings | `forge test`: **26/26 pass** |
| B Frontend | ✅ Home, Contacts (invite), /pair, /finish, Send (green/amber/red), Activity (undo ring), /claim, Spam | `next build` passes |
| C Spam + attack | ✅ `/api/spam` (5 signals), `npm run poison`, `npm run fake-token`, `npm run raw-send` | needs deployed wallet to run live |
| D Arkiv | ⏳ next | pairing relay works without Arkiv today (reply link) |
| E Polish | partly | mobile 375px, dark mode, reduced motion |
| F Docs | README written | add Arc Studio link + contract addresses |

## Demo addresses
- Owner (Rahul): `0xE3f8da887397706Ddca28a8D27284f3bcE42eb4f`
- Amit (contact): `0x75E04Ef6D49aA13Ea1B3F7c9C82BA0B6a7F2b263`
- Lookalike / scammer: `0x75e9e0F33d0fa1B6538c69a34Ba00b4a1D0a2263` (starts `75e`, ends `263`, like Amit)

## Next
Deploy → create wallet in app → pair Amit → `npm run poison` → paste lookalike on Send → record demo.
Then Phase D: move the pairing reply link and the poisoner list onto Arkiv.
