"use client";

// ─────────────────────────────────────────────────────────────
// useFaucet — claims test tokens from the Faucet contract
// (packages/foundry/contracts/token/Faucet.sol) in a single claimMany()
// transaction. Faucet.sol has no post-deploy mint on the SeedToken clones
// it distributes - see that contract's header comment for why this exists
// instead of a simpler per-token mint() call.
// ─────────────────────────────────────────────────────────────

import { useCallback, useState } from "react";
import { parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { notification } from "~~/utils/scaffold-eth";
import { FAUCET_ABI, useFaucetContract } from "~~/utils/faucetContract";

export interface FaucetToken {
  address: `0x${string}`;
  symbol: string;
}

export interface FaucetClaimResult {
  claimed: string[];
  skipped: string[];
}

export function useFaucet() {
  const contract = useFaucetContract();
  const { address: account } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);

  const claimMany = useCallback(
    async (tokens: FaucetToken[]): Promise<FaucetClaimResult | undefined> => {
      if (!contract) throw new Error("Faucet not deployed on this chain yet");
      if (!account) throw new Error("Connect a wallet first");
      if (tokens.length === 0) return undefined;

      setIsPending(true);
      try {
        const hash = await writeContractAsync({
          address: contract.address,
          abi: contract.abi,
          functionName: "claimMany",
          args: [tokens.map(t => t.address)],
        });

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });

        const symbolFor = (tokenAddress: string) =>
          tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase())?.symbol.toUpperCase() ??
          tokenAddress;

        const claimedLogs = receipt
          ? parseEventLogs({ abi: FAUCET_ABI, eventName: "Claimed", logs: receipt.logs })
          : [];
        const skippedLogs = receipt
          ? parseEventLogs({ abi: FAUCET_ABI, eventName: "Skipped", logs: receipt.logs })
          : [];

        const claimed = claimedLogs.map(log => symbolFor(log.args.token));
        const skipped = skippedLogs.map(log => symbolFor(log.args.token));

        if (claimed.length > 0) {
          notification.success(
            `Claimed ${claimed.length}/${tokens.length} test token${tokens.length === 1 ? "" : "s"}${
              skipped.length > 0 ? ` (${skipped.join(", ")} on cooldown)` : ""
            }`,
          );
        }

        return { claimed, skipped };
      } catch (e) {
        notification.error(e instanceof Error ? e.message : "Claim failed");
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [contract, account, publicClient, writeContractAsync],
  );

  return { claimMany, ready: !!contract, connected: !!account, isPending };
}
