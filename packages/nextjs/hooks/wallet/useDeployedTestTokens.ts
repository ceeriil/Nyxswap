"use client";

// ─────────────────────────────────────────────────────────────
// useDeployedTestTokens — the live, on-chain source of truth for every
// test token this app's faucet/swap/vault UI can show. Deliberately does
// NOT read from a generated/synced file: the candidate address list comes
// from ~~/contracts/deployedContracts (the deploy pipeline's own real
// output - see scripts-js/deployTestTokens.js), and each candidate's
// symbol/name are read live off the contract itself via symbol()/name(),
// batched into one call. Only the icon is static (see utils/tokenIcons.ts) -
// there's no on-chain source for that.
//
// A candidate whose contract doesn't answer symbol()/name() (torn deploy,
// wrong ABI) is silently dropped rather than shown with garbage data.
// ─────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { contracts } from "~~/utils/scaffold-eth/contract";
import { TOKEN_ICON_BY_SYMBOL } from "~~/utils/tokenIcons";

const CHAIN_ID = 114;

// Every SeedToken clone (and the original hand-deployed FlrTestToken/
// UsdtTestToken/BtcTestToken/EthTestToken) is named "<Key>TestToken" by the
// deploy scripts - see deployTestTokens.js's `entries[token.key] = ...`.
const CANDIDATES: { key: string; address: `0x${string}` }[] = Object.entries(contracts?.[CHAIN_ID] ?? {})
  .filter(([key]) => key.endsWith("TestToken"))
  .map(([key, entry]) => ({ key, address: entry.address as `0x${string}` }));

const ERC20_IDENTITY_ABI = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const READ_CONTRACTS = CANDIDATES.flatMap(c => [
  { address: c.address, abi: ERC20_IDENTITY_ABI, functionName: "symbol" as const },
  { address: c.address, abi: ERC20_IDENTITY_ABI, functionName: "name" as const },
]);

export interface DeployedTestToken {
  address: `0x${string}`;
  symbol: string;
  name: string;
  /** SeedToken clones are always 18dp (ERC20 default) regardless of any deploy-config metadata - see SeedToken.sol. */
  decimals: number;
  logoURI: string;
}

export function useDeployedTestTokens(): { tokens: DeployedTestToken[]; isLoading: boolean } {
  const { data, isLoading } = useReadContracts({
    contracts: READ_CONTRACTS,
    query: { enabled: READ_CONTRACTS.length > 0 },
  });

  const tokens = useMemo<DeployedTestToken[]>(() => {
    if (!data) return [];
    return CANDIDATES.flatMap((c, i) => {
      const symbolResult = data[i * 2];
      const nameResult = data[i * 2 + 1];
      if (symbolResult?.status !== "success" || nameResult?.status !== "success") return [];
      const symbol = symbolResult.result;
      return [
        {
          address: c.address,
          symbol,
          name: nameResult.result,
          decimals: 18,
          logoURI: TOKEN_ICON_BY_SYMBOL[symbol] ?? "",
        },
      ];
    });
  }, [data]);

  return { tokens, isLoading: CANDIDATES.length > 0 && isLoading };
}
