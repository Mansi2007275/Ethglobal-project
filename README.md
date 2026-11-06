# Unpoison

**Payments that can't be poisoned.** A USDC wallet on Arc that stops address-poisoning losses.

> Wallets warn you. Unpoison stops the money.

Address poisoning stole at least $76.1M from Ethereum users in the 12 months to July 2026
([Bitquery](https://bitquery.io/investigations/address-poisoning-ethereum)). Scammers create an address with the
same first and last characters as someone you pay, plant it in your history with a $0 or dust transfer, and wait
for you to copy it. Only 3 of 53 popular wallets even warn you ([arXiv 2508.12107](https://arxiv.org/abs/2508.12107v1)).

Submitting for: **Best Smart Contracts with Advanced Stablecoin Logic** (Arc).

## How it works (enforced in the contract)

| Layer | What happens |
| --- | --- |
| Prevent | **Verified pairing**: a contact is saved only after they sign an EIP-712 invite with their own key. A scammer never gets the invite, so a fake can never become a contact. **Pay by name.** |
| Recognize | **Lookalike stop**: any address sharing ≥3 leading AND ≥3 trailing hex chars with a contact is rejected (`LookalikeStopped`). **Spam folder** hides bait (dust, $0, fake tokens, forged "sent" entries). **Emoji fingerprint + specimen strip** show the difference. |
| Confirm | **Handshake Pay**: money waits until the receiver claims it from their own address with a secret link; unclaimed = refundable. A fake address can never claim. |
| Recover | **Undo window**: unknown addresses wait in escrow; tap Undo for a refund. Riskier settings changes have a 24h timelock. |

## Repo

```
contracts/   Foundry: UnpoisonFactory, UnpoisonWallet, 26 tests
web/         Next.js app (wagmi + viem), spam indexer API, demo scripts
SPEC.md      Full build spec  ·  CLAUDE.md  Rules for AI-assisted work
```

## Run it

**1. Contracts**
```bash
cd contracts
forge test                       # 26 tests
forge script script/Deploy.s.sol --rpc-url arc_testnet --private-key $DEPLOYER_PRIVATE_KEY --broadcast
```
Copy the printed `UnpoisonFactory` address into `web/.env.local` (`NEXT_PUBLIC_FACTORY_ADDRESS`) and `.env` (`FACTORY_ADDRESS`).

**2. App**
```bash
cd web
npm install
npm run dev                      # http://localhost:3000
```
Connect MetaMask on Arc Testnet → Create my wallet → Add USDC. Copy your Unpoison wallet address into `.env` (`UNPOISON_WALLET`).

**3. Demo attack**
```bash
npm run poison       # scammer sends dust from the lookalike -> shows in Spam
npm run fake-token   # forged "you paid the scammer" entry -> shows in Spam
npm run raw-send     # calls the contract directly, no server -> LookalikeStopped
```

## Demo flow
1. Rahul adds Amit → shares invite on WhatsApp → Amit signs on `/pair` → sends reply link → Rahul verifies on `/finish`.
2. Pay Amit by name: instant.
3. `npm run poison`: the bait lands in Spam, not history.
4. Paste the lookalike on Send: red stop screen, striped characters, no Send button.
5. Pay a new address with Undo: countdown, Undo returns the USDC.
6. Handshake Pay to a new address: only that address can claim; unclaimed comes back.
7. Stop the web server, run `npm run raw-send`: the contract still stops it.

## Network
Arc Testnet · chain 5042002 · RPC `https://rpc.testnet.arc.network` · [Arcscan](https://testnet.arcscan.app) ·
[Faucet](https://faucet.circle.com) · USDC ERC-20 interface `0x3600000000000000000000000000000000000000` (6 decimals).

## Limitations
Protects copy-paste and poisoning mistakes for funds sent from an Unpoison wallet. Does not stop stolen keys or
drainers. Contacts are public onchain (hashing is on the roadmap). Unaudited testnet prototype.

## Built with
Solidity, Foundry, OpenZeppelin, Next.js, wagmi, viem. AI assistance: Claude (spec, scaffolding, UI).
Arc Studio project: _add your studio.arc.io/app/… link here_.

MIT License
