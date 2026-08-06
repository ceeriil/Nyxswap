import type { Address } from "viem";

export type TokenSymbol = "FLR" | "FXRP" | "USDC";

export type Token = {
  symbol: TokenSymbol;
  name: string;
  decimals: number;
  isNative?: boolean;
  /** ERC20 contract address. Undefined for native tokens, which have none. */
  address?: Address;
  /** Tailwind classes for the token's icon badge background/foreground. */
  avatarClassName: string;
};

// Zero address: no FXRP/USDC contract is deployed yet (see brief.md's open
// questions). Swap these for the real deployment/bridge addresses once they exist.
const PLACEHOLDER_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

export const TOKENS: Record<TokenSymbol, Token> = {
  FLR: {
    symbol: "FLR",
    name: "Flare",
    decimals: 18,
    isNative: true,
    avatarClassName: "bg-rose-500/15 text-rose-300",
  },
  FXRP: {
    symbol: "FXRP",
    name: "FAsset XRP",
    decimals: 6,
    address: PLACEHOLDER_ADDRESS,
    avatarClassName: "bg-sky-500/15 text-sky-300",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    address: PLACEHOLDER_ADDRESS,
    avatarClassName: "bg-emerald-500/15 text-emerald-300",
  },
};

// FXRP first: it's a listed pair from day one, not an afterthought (see brief.md).
export const TOKEN_LIST: Token[] = [TOKENS.FXRP, TOKENS.FLR, TOKENS.USDC];
