/**
 * Backend-off proof: call the contract directly (no frontend, no server) and try to pay the lookalike.
 * The contract itself stops it with LookalikeStopped.
 *   npm run raw-send
 */
import { BaseError, ContractFunctionRevertedError } from "viem";
import { walletAbi } from "../lib/abi";
import { need, pub, signer } from "./_env";

async function main() {
  const wallet = need("UNPOISON_WALLET") as `0x${string}`;
  const fake = need("LOOKALIKE_ADDRESS") as `0x${string}`;
  const { account } = signer("DEPLOYER_PRIVATE_KEY");
  console.log(`Owner ${account.address} tries wallet.send(${fake}, 1 USDC) directly…`);
  try {
    await pub.simulateContract({ address: wallet, abi: walletAbi, functionName: "send", args: [fake, 1_000_000n], account });
    console.log("FAIL: the contract allowed it (is the real contact paired?)");
    process.exit(1);
  } catch (e) {
    const r = e instanceof BaseError ? (e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null) : null;
    if (r?.data?.errorName === "LookalikeStopped") {
      console.log(`OK: contract reverted with LookalikeStopped(${r.data.args?.[0]}). No server involved.`);
    } else {
      console.log("Reverted for another reason:", (e as Error).message);
    }
  }
}
main();
