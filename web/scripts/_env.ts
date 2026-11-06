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

export function signer(keyVar: string) {
  const account = privateKeyToAccount(need(keyVar) as Hex);
  return { account, client: createWalletClient({ account, chain: arcTestnet, transport: http() }) };
}

export const link = (h: string) => `https://testnet.arcscan.app/tx/${h}`;
