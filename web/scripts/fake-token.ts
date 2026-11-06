/**
 * Demo attack #2: deploy a fake "USDC" token and emit a Transfer that makes it LOOK like
 * your wallet paid the lookalike. Real scammers do this so the fake shows in your "sent" history.
 * Needs `forge build` in ../contracts first.
 *   npm run fake-token
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Abi, Hex } from "viem";
import { link, need, pub, signer } from "./_env";

async function main() {
  const wallet = need("UNPOISON_WALLET") as `0x${string}`;
  const fake = need("LOOKALIKE_ADDRESS") as `0x${string}`;
  const art = JSON.parse(readFileSync(resolve(__dirname, "../../contracts/out/FakeUSDC.sol/FakeUSDC.json"), "utf8"));
  const abi = art.abi as Abi;
  const { client } = signer("SCAMMER_PRIVATE_KEY");

  const deploy = await client.deployContract({ abi, bytecode: art.bytecode.object as Hex });
  const r = await pub.waitForTransactionReceipt({ hash: deploy });
  console.log("Fake USDC deployed:", r.contractAddress, link(deploy));

  const hash = await client.writeContract({ address: r.contractAddress!, abi, functionName: "fakeTransfer", args: [wallet, fake, 1_000_000n] });
  await pub.waitForTransactionReceipt({ hash });
  console.log("Forged 'you paid the scammer' entry:", link(hash));
}
main().catch((e) => {
  console.error(e.shortMessage ?? e.message);
  process.exit(1);
});
