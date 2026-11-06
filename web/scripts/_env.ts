import { config } from "dotenv";
import { resolve } from "node:path";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "../lib/chain";

// Reads ../.env (repo root) and web/.env.local
config({ path: resolve(__dirname, "../../.env") });
config({ path: resolve(__dirname, "../.env.local") });

export function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
  return v;
}

export const pub = createPublicClient({ chain: arcTestnet, transport: http() });

/**
 * A key pasted from MetaMask often arrives without the `0x` prefix, and sometimes with stray
 * whitespace or quotes from an editor. viem needs a clean 0x-prefixed 32-byte hex string, so
 * normalise it here instead of making every script (and every user) get the format exactly right.
 * The key itself is never logged.
 */
function privateKey(keyVar: string): Hex {
  const raw = need(keyVar).trim().replace(/^["']|["']$/g, "");
  const hex = (raw.startsWith("0x") ? raw.slice(2) : raw).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    console.error(`${keyVar} is not a 32-byte hex private key (got ${hex.length} hex chars, expected 64).`);
    process.exit(1);
  }
  return `0x${hex}` as Hex;
}

export function signer(keyVar: string) {
  const account = privateKeyToAccount(privateKey(keyVar));
  return { account, client: createWalletClient({ account, chain: arcTestnet, transport: http() }) };
}

export const link = (h: string) => `https://testnet.arcscan.app/tx/${h}`;
