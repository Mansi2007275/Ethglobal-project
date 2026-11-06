"use client";

import { useAccount, useReadContract, usePublicClient, useWriteContract, useSwitchChain } from "wagmi";
import { BaseError, ContractFunctionRevertedError, type Abi } from "viem";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { factoryAbi, walletAbi } from "./abi";
import { FACTORY, USDC, erc20Abi, arcTestnet } from "./chain";

const ZERO = "0x0000000000000000000000000000000000000000";

/** The connected user's Unpoison wallet and its live state. */
export function useUnpoison() {
  const { address, isConnected, chainId } = useAccount();
  const wallet = useReadContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "walletOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!FACTORY },
  });
  const w = wallet.data && wallet.data !== ZERO ? (wallet.data as `0x${string}`) : undefined;

  const balance = useReadContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: w ? [w] : undefined, query: { enabled: !!w } });
  const available = useReadContract({ address: w, abi: walletAbi, functionName: "available", query: { enabled: !!w } });
  const contacts = useReadContract({ address: w, abi: walletAbi, functionName: "getContacts", query: { enabled: !!w } });
  const escrows = useReadContract({ address: w, abi: walletAbi, functionName: "getEscrows", query: { enabled: !!w } });
  const myBalance = useReadContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address } });

  return {
    address,
    isConnected,
    wrongChain: isConnected && chainId !== arcTestnet.id,
    wallet: w,
    loadingWallet: wallet.isLoading,
    balance: balance.data as bigint | undefined,
    available: available.data as bigint | undefined,
    myBalance: myBalance.data as bigint | undefined,
    contacts: (contacts.data ?? []) as readonly { addr: `0x${string}`; name: string }[],
    escrows: (escrows.data ?? []) as readonly {
      to: `0x${string}`;
      amount: bigint;
      unlockAt: bigint;
      kind: number;
      status: number;
      secretHash: `0x${string}`;
    }[],
    refetch: () => {
      wallet.refetch();
      balance.refetch();
      available.refetch();
      contacts.refetch();
      escrows.refetch();
      myBalance.refetch();
    },
  };
}

export type SpamItem = {
  txHash: string;
  token: string;
  from: string;
  to: string;
  amount: string;
  signals: string[];
  imitates?: string;
};

/** Transfers the server-side indexer flagged as poisoning bait. */
export function useSpam(wallet?: string) {
  return useQuery({
    queryKey: ["spam", wallet],
    enabled: !!wallet,
    refetchInterval: 20000,
    queryFn: async (): Promise<SpamItem[]> => {
      const r = await fetch(`/api/spam?wallet=${wallet}`);
      if (!r.ok) throw new Error("Spam scan failed");
      return (await r.json()).items as SpamItem[];
    },
  });
}

/** Turn any wallet/contract error into one plain sentence. */
export function explain(e: unknown): { text: string; name?: string; args?: readonly unknown[] } {
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName;
    const map: Record<string, string> = {
      LookalikeStopped: "Stopped: this address looks like one of your contacts.",
      InsufficientAvailable: "Not enough free USDC in your Unpoison wallet.",
      InvalidInvite: "This invite is used, expired or unknown. Create a new one.",
      InvalidSignature: "The signature doesn't match this contact. Ask them to sign again.",
      AlreadyContact: "Already a verified contact.",
      WrongMiddle: "Those 6 characters don't match the address.",
      NotReceiver: "Connect the wallet this payment was sent to.",
      WrongSecret: "This claim link is wrong or incomplete.",
      TooLate: "The claim window has closed. The sender can refund it now.",
      TooEarly: "Not yet. Wait for the timer to finish.",
      NotOwner: "Only the wallet owner can do this.",
      AlreadyHasWallet: "You already have an Unpoison wallet.",
    };
    if (name) return { text: map[name] ?? name, name, args: revert?.data?.args };
    if (/User rejected|denied/i.test(e.message)) return { text: "You cancelled in your wallet." };
    return { text: e.shortMessage };
  }
  return { text: e instanceof Error ? e.message : "Something went wrong." };
}

/** Simulate first (so reverts show before the wallet pops up), then send and wait for the receipt. */
export function useTx() {
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const { address, chainId } = useAccount();
  const [busy, setBusy] = useState(false);

  async function run(p: { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[] }) {
    if (!client || !address) throw new Error("Connect your wallet first.");
    setBusy(true);
    try {
      if (chainId !== arcTestnet.id) await switchChainAsync({ chainId: arcTestnet.id });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sim = await client.simulateContract({ ...(p as any), account: address });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hash = await writeContractAsync(sim.request as any);
      const receipt = await client.waitForTransactionReceipt({ hash });
      return { hash, receipt, result: sim.result };
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}
