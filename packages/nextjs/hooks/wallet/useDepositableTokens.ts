"use client";

// ─────────────────────────────────────────────────────────────
// useDepositableTokens — every SeedToken clone that's actually deployed on
// the target chain (present in ~~/contracts/deployedContracts), matched
// against TEST_TOKEN_META for display metadata. Shared by FaucetModal and
// the wallet page so the two can't drift into showing different lists.
// ─────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { contracts } from "~~/utils/scaffold-eth/contract";
import { TEST_TOKEN_META, type TestToken } from "~~/utils/testTokens";

const CHAIN_ID = 114;

export function useDepositableTokens(): { tokens: TestToken[]; isLoading: boolean } {
  const deployed = contracts?.[CHAIN_ID];

  const tokens = useMemo(() => {
    if (!deployed) return [];
    return TEST_TOKEN_META.flatMap(meta => {
      const address = deployed[meta.key]?.address;
      return address ? [{ ...meta, address: address as `0x${string}` }] : [];
    });
  }, [deployed]);

  return { tokens, isLoading: false };
}
