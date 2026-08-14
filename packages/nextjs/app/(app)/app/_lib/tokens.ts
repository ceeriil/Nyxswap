import type { DeployedTestToken } from "~~/hooks/wallet/useDeployedTestTokens";

export type TokenSymbol = string;

// Re-exported so call sites don't need to know the type actually lives with
// the live-fetching hook - see ~~/hooks/wallet/useDeployedTestTokens for
// where the data itself comes from (on-chain, not a static list).
export type Token = DeployedTestToken;
