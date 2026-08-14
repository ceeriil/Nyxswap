"use client";

// ─────────────────────────────────────────────────────────────
// useDepositableTokens — thin alias over useDeployedTestTokens, kept as its
// own name since "depositable" is the meaningful concept at FaucetModal's
// call site (every deployed test token is claimable/depositable), while
// "deployed test tokens" is the meaningful concept at the hook's own
// definition site.
// ─────────────────────────────────────────────────────────────

import { useDeployedTestTokens, type DeployedTestToken } from "./useDeployedTestTokens";

export function useDepositableTokens(): { tokens: DeployedTestToken[]; isLoading: boolean } {
  return useDeployedTestTokens();
}
