"use client";

// ─────────────────────────────────────────────────────────────
// useDepositableTokens — the deployed Faucet's test-token list, synced
// from packages/foundry/data/token.json via scripts-js/syncTestTokens.js
// (run it again after redeploying the faucet/test tokens). Shared by
// FaucetModal and the wallet page so the two can't drift into showing
// different lists.
// ─────────────────────────────────────────────────────────────

import { TEST_TOKENS, type TestToken } from "~~/utils/testTokens";

export function useDepositableTokens(): { tokens: TestToken[]; isLoading: boolean } {
  return { tokens: TEST_TOKENS, isLoading: false };
}
