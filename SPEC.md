# Unpoison — Build Spec (ETHGlobal Mumbai 2026)

Unpoison is a smart-contract wallet on Arc Testnet that stops address-poisoning losses.
Scammers create lookalike addresses (same first/last characters as a real contact) and plant
them in a victim's history with dust, zero-value or fake-token transfers. Unpoison makes paying
a fake address impossible for paired contacts and reversible for everything else.

Tagline: "Wallets warn you. Unpoison stops the money."

## Network facts (Arc Testnet)
- Chain ID: 5042002
- RPC: https://rpc.testnet.arc.network  (WS: wss://rpc.testnet.arc.network)
- Explorer: https://testnet.arcscan.app
- Faucet: https://faucet.circle.com
- USDC is the gas token. USDC ERC-20 interface: 0x3600000000000000000000000000000000000000 (6 decimals).
  Native balance uses 18 decimals; both share one balance. Use the ERC-20 interface (6 decimals) in app code.
- Every native USDC movement also emits a standard ERC-20 Transfer log from
  0xfffffffffffffffffffffffffffffffffffffffe.

## Features (priority)
MUST: Verified Pairing, Pay by Name, Contract lookalike stop (3+3 hex chars), Undo window, Spam folder.
SHOULD: Handshake Pay (receiver claims with secret or auto-refund), Emoji fingerprint + red address diff,
Arkiv Poisoner Registry + pairing relay, backend-off proof.
COULD: Middle-Check override, Address Vault (24h), Rule timelock, live wallet scan (Etherscan, read-only).

---

## Phase A — Contracts (Solidity 0.8.x, Foundry, OpenZeppelin)
Use ReentrancyGuard, SafeERC20, EIP712, ECDSA. No upgradeability.
Add `receive() external payable {}` so native USDC sends are accepted.

UnpoisonFactory: `createWallet(uint256 escrowDelay)` deploys one UnpoisonWallet for msg.sender;
escrowDelay minimum 60 seconds (demo), recommended 3600. Emit WalletCreated(owner, wallet).
Mapping owner => wallet.

UnpoisonWallet (owner only unless stated):
1. Pairing (front-run safe):
   - `createInvite(bytes32 codeHash, uint64 expiresAt)`: single use, at most 24h ahead.
   - `pairWithSignature(address contact, string name, string code, uint256 deadline, bytes signature)`:
     keccak256(bytes(code)) must match an unused, unexpired invite; verify an EIP-712 signature by
     `contact` over `Pair(address wallet, bytes32 codeHash, uint256 deadline)` with domain
     name "Unpoison", version "1", chainId, verifyingContract = this wallet. Store contact + name,
     mark invite used, emit Paired.
   - `removeContact(address)`.
2. Lookalike check: internal pure + `looksLike(address) view returns (bool, address contact)`.
   Compare hex characters (nibbles), not bytes. A recipient looks like a contact if it shares at least
   3 leading AND at least 3 trailing hex characters with that contact but is a different address.
3. `send(address to, uint256 amount)`:
   - available = USDC balance - total locked.
   - contact or active vault address -> transfer now, emit Sent.
   - looks like a contact -> revert `LookalikeStopped(address contact)`.
   - otherwise -> escrow {to, amount, releaseAt = now + escrowDelay, kind Undo, status Pending},
     lock it, emit Escrowed(id).
4. `confirmWithMiddle(address to, uint256 amount, string middle)`: middle must equal the 6 lowercase hex
   characters of `to` at positions 17-22 after 0x; if correct ALWAYS create an Undo escrow.
5. `cancel(uint256 id)`: Pending Undo escrow only; unlock; emit Cancelled.
6. `release(uint256 id)`: anyone, when block.timestamp >= releaseAt; pays `to`; emit Released.
7. Handshake Pay:
   - `sendHandshake(address to, uint256 amount, bytes32 secretHash, uint64 claimWindow)`:
     window 60s..7 days; lookalike recipients revert like send(); lock amount; emit HandshakeCreated(id).
   - `claim(uint256 id, bytes32 secret)`: only msg.sender == to, only while window open,
     keccak256(abi.encodePacked(secret)) == secretHash; pays `to`; emit Claimed.
   - `refund(uint256 id)`: anyone, after window; funds return to wallet balance; emit Refunded.
   - Secret = 32 random bytes (never a short PIN: the hash is public).
8. Vault: `proposeVault(address, string label)`, usable 24 hours later.
9. Timelocked settings: disabling protection or shortening escrowDelay applies 24h after proposeChange,
   cancellable; changes that make the wallet safer apply instantly.
10. `withdraw(address to, uint256 amount)` follows send() rules.
11. Views: getContacts(), getEscrows(), isContact(address).

Tests (all must pass): instant send to contact; escrow for unknown; cancel refunds + unlocks; release
before delay fails / after works; lookalike revert with exactly 3+3; no revert with 2+2; middle-check
right/wrong; invite expiry + reuse; wrong signer; signature replay on another wallet; locked funds not
double-spendable; handshake claim right address + right secret; other address fails; wrong secret fails;
refund after window; no claim after window; timelock delay; safer change instant; reentrancy.

Also: `script/Deploy.s.sol` (deploy factory, print address) and `scripts/e2e.ts` (Node + viem, keys from
.env: DEPLOYER_PRIVATE_KEY as Rahul, AMIT_PRIVATE_KEY, LOOKALIKE_ADDRESS): create wallet with 60s delay,
fund 5 USDC, pair Amit with real EIP-712 signature, pay Amit 1 USDC, send 1 USDC to fresh random address
and cancel, try lookalike and expect LookalikeStopped, Handshake 1 USDC to Amit and claim as Amit,
Handshake 1 USDC to random address and refund after 65s. Print OK/FAIL + Arcscan link per step.

DONE WHEN: all tests pass; factory deployed; e2e prints OK for every step.

---

## Phase B — Frontend (Next.js App Router, TypeScript, Tailwind, wagmi + viem, MetaMask)
Factory address from NEXT_PUBLIC_FACTORY_ADDRESS.

Design system:
- Calm consumer finance app (Phantom/Family style), plain words, one decision per screen,
  confirmations as bottom sheets. Red state has NO Send button (Rabby pattern).
- Colours light/dark: background #FFFFFF/#0B0F14, surface #F6F7F9/#151A21, text #0F172A/#E6EAF0,
  muted #64748B/#94A3B8, accent teal #0F766E/#2DD4BF, safe green #15803D/#4ADE80,
  wait amber #B45309/#FBBF24, stop red #B91C1C/#F87171.
- Type: Inter (text), JetBrains Mono (addresses), balance 40px. Cards 16px radius, buttons 12px,
  8px grid, tap targets >= 44px. Motion 150-200ms, ring countdown for undo, respect reduced motion.

Components: ContactRow (name, 8-emoji fingerprint, short address, Verified badge), SafetyBanner,
AddressDiff (4-char chunks; matching grey, different red), UndoCountdown, ConfirmSheet,
SpamItem (reason chips, no copy button).
Emoji fingerprint: map each of the 20 address bytes to a fixed list of 256 distinct emoji; show first 8.

Screens:
1. Onboarding: connect; if no wallet, factory.createWallet(120); deposit step.
2. Home: balance, "Protection ON", Send, Contacts, Activity, Spam (count badge).
3. Contacts: "Add contact" -> name, 32 random bytes code, createInvite(keccak256(code), now+24h),
   share link /pair?wallet=..&code=..&name=.. (WhatsApp share).
4. /pair: contact signs EIP-712 Pair (no gas), POST to /api/pairing; owner sees
   "Amit accepted, tap to finish" -> pairWithSignature.
5. Send: contacts first; "Pay a new address" runs looksLike() on paste.
   contact -> green ConfirmSheet -> send(). lookalike -> red "This looks like Amit, but it is not Amit",
   AddressDiff, both fingerprints, "Pay Amit instead" / "I'm sure, check middle". unknown -> amber choice
   "Send with Undo" or "Handshake Pay" (32-byte secret, sendHandshake, share /claim?wallet=..&id=..&secret=..).
6. /claim: receiver claims; clear error if wrong wallet.
7. Activity: countdown + Undo, Release after delay; Handshake "Waiting for claim" then Refund.
8. Spam: from /api/spam, reason chips, no copy button.
Decode LookalikeStopped via viem. Never show a copy button for unverified addresses. Works at 375px.

DONE WHEN: pair a second wallet, pay by name, red stop screen, Undo refund, Handshake claim + refund all
work in the browser.

---

## Phase C — Spam indexer + attack scripts
GET /api/spam?wallet=0x.. (server-side): read last 50,000 blocks of transfers into/out of the wallet from
the USDC interface, the native emitter 0xfff...fffe, and any other token contract. Signals: lookalike
(3+ leading AND 3+ trailing match a contact/past recipient), dust (0 or < 0.01 USDC), fakeToken (not
official USDC), notSigned (wallet shown as `from` but tx not sent by owner), timing (within 15 min of a
real outgoing payment). Spam when >= 2 signals. Return {txHash, token, from, to, amount, signals[],
imitates}; cache 30s.
Scripts (viem, keys from .env): scripts/poison.ts (SCAMMER_PRIVATE_KEY = lookalike, send 0.0001 USDC),
scripts/fake-token.ts (deploy ERC-20 "USDC", emit Transfer wallet -> lookalike), scripts/raw-send.ts
(call send(LOOKALIKE_ADDRESS, 1 USDC) directly, print LookalikeStopped). Print Arcscan links.

DONE WHEN: poison + fake-token appear in Spam; raw-send prints LookalikeStopped.

---

## Phase D — Arkiv (@arkiv-network/sdk ^0.8.1, Tiramisu testnet, Node 20-22, server-side only)
Entity 1 pairing: attributes app="unpoison", type="pairing", wallet, contact, codeHash (lowercase);
payload {name, deadline, signature}; expires 24h. POST/GET /api/pairing.
Entity 2 poisoner: attributes app="unpoison", type="poisoner", address, imitates, reason, reporter;
expires 90 days. Written when spam is flagged or LookalikeStopped is caught. GET /api/registry?address=..
UI: 1 reporter = amber "Reported once", 2+ = red "Known poisoner". Log entity keys + tx hashes.
README: writer wallet + one runnable query.

---

## Phase E — Polish
Loading/empty/error states; ?demo=1 panel to run the 3 scripts; /proof page for backend-off proof;
375px + dark mode check; no analytics/trackers. Optional /scan (Etherscan API, read-only).

## Phase F — Docs
README (problem with sources, 4 layers, architecture diagram, contract addresses + Arcscan links,
Arc Studio project URL, setup, demo steps, limitations, AI tools used, MIT license,
"Submitting for: Best Smart Contracts with Advanced Stablecoin Logic"); CROPS section (Security lead:
rules live in the contract, work with backend off); /arkiv/schema.md, friction.md, reach.md,
why-arkiv.md, how-you-use-arkiv.md.

## Troubleshooting
- insufficient funds -> faucet.circle.com for every wallet.
- invalid chain id -> 5042002.
- amounts 10^12 off -> mixing 18-decimal native with 6-decimal ERC-20.
- signature rejected -> EIP-712 domain (name, version, chainId, verifyingContract) must match.
- red screen never opens -> decode LookalikeStopped with the ABI.
- lookalike missed -> compare lowercase nibbles, 3 chars != 3 bytes.
- Arkiv hangs -> Node 20-22, not 24.
- spam empty -> also read logs from 0xfff...fffe.
