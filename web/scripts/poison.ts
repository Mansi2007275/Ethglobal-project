/**
 * Demo attack: the scammer (lookalike of Amit) sends dust USDC to the Unpoison wallet,
 * exactly like real address-poisoning bait. It should appear in the Spam tab.
 *   npm run poison
 */
import { USDC, erc20Abi } from "../lib/chain";
import { link, need, pub, signer } from "./_env";

async function main() {
  const wallet = need("UNPOISON_WALLET") as `0x${string}`;
  const { account, client } = signer("SCAMMER_PRIVATE_KEY");
  console.log(`Scammer ${account.address} poisoning ${wallet}`);
  const hash = await client.writeContract({ address: USDC, abi: erc20Abi, functionName: "transfer", args: [wallet, 100n] }); // 0.0001 USDC
  await pub.waitForTransactionReceipt({ hash });
  console.log("Dust sent:", link(hash));
}
main().catch((e) => {
  console.error(e.shortMessage ?? e.message);
  process.exit(1);
});
