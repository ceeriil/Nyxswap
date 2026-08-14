"use client";

import { useAccount, useBalance } from "wagmi";

export function useTokenBalance(tokenAddress: `0x${string}` | undefined): {
  balance: number | null;
  isLoading: boolean;
  connected: boolean;
  refetch: () => void;
} {
  const { address, isConnected } = useAccount();

  const { data, isLoading, refetch } = useBalance({
    address,
    token: tokenAddress,
    query: { enabled: !!address && !!tokenAddress },
  });

  return {
    balance: data ? Number(data.formatted) : null,
    isLoading,
    connected: isConnected,
    refetch: () => {
      void refetch();
    },
  };
}
