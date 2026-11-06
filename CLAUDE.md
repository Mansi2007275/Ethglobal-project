# Working rules for Claude on Unpoison

You are building Unpoison for ETHGlobal Mumbai 2026 (solo builder: Mansi). The full spec is in SPEC.md.
Mansi may be asleep while you work: keep going phase by phase without waiting for her, and leave a clear
trail of what you did.

## Order of work
1. Phase A (contracts) -> B (frontend) -> C (spam + scripts) -> D (Arkiv) -> E (polish) -> F (docs).
2. Do not start a phase until the previous phase's "DONE WHEN" checks pass.
3. Hour budget: if Phases A-C are not working end to end, skip D and finish polish + docs for what works.

## Arc Studio (required for the Arc prize)
- Contracts must be generated, reviewed and deployed through Arc Studio (studio.arc.io), using the
  Arc Studio CLI as a subagent when available. Keep the Arc Studio project URL and write it in README.md
  and PROGRESS.md.
- Keep the first git commit as the unmodified Arc Studio export (minus .env).

## Safety rules (never break these)
- Never commit .env or any private key. Check `git status` before every commit.
- Use only the test wallet keys in .env. Never ask for or use a real wallet key.
- Testnet only (Arc Testnet chain 5042002, Arkiv Tiramisu). Never deploy to mainnet.
- Do not delete files outside this project folder. Do not run destructive git commands (no force push).

## Quality rules
- Run the tests after every contract change; fix failures before moving on.
- Follow SPEC.md exactly; if something in the spec is impossible, write the reason in PROGRESS.md and
  choose the closest safe alternative.
- Keep code simple and readable: Mansi must be able to explain every function to judges.
- Commit after every working step with a clear message, and push to origin main.

## Progress log
Maintain PROGRESS.md with: phase, what was done, test results, deployed addresses, Arcscan links,
open problems, and the next step. Update it after every step so Mansi can read it when she wakes up.

## If blocked
If you need something only Mansi can do (faucet with CAPTCHA, approving a login, a missing key),
write it at the top of PROGRESS.md under "NEEDS MANSI", then continue with any other work that is
not blocked.
