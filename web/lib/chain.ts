import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"], webSocket: ["wss://rpc.testnet.arc.network"] },
  },
  blockExplorers: { default: { name: "Arcscan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

/** USDC ERC-20 interface on Arc. Use this (6 decimals) for every amount in the app. */
export const USDC = "0x3600000000000000000000000000000000000000" as const;
/** Native USDC movements emit a Transfer log from this system address. */
export const NATIVE_EMITTER = "0xfffffffffffffffffffffffffffffffffffffffe" as const;

export const FACTORY = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? "") as `0x${string}`;

export const explorerTx = (h: string) => `https://testnet.arcscan.app/tx/${h}`;
export const explorerAddr = (a: string) => `https://testnet.arcscan.app/address/${a}`;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;
