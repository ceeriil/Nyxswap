import { quoteSwap } from "../../app/_lib/mockPool";
import type { TokenSymbol } from "../../app/_lib/tokens";
import type { Address } from "viem";

export type SwapRecord = {
  id: string;
  txHash: `0x${string}`;
  trader: Address;
  timestamp: number;
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  amountIn: number;
  amountOut: number;
};

// Clearly-synthetic addresses (not real accounts) standing in for other
// traders on the pool until real settled-swap events exist to read.
const MOCK_TRADERS: Address[] = [
  "0x1111111111111111111111111111111111aAAA",
  "0x2222222222222222222222222222222222bBBB",
  "0x3333333333333333333333333333333333cCCC",
  "0x4444444444444444444444444444444444dDDD",
  "0x5555555555555555555555555555555555eEEE",
];

const PAIRS: [TokenSymbol, TokenSymbol][] = [
  ["FXRP", "FLR"],
  ["FLR", "FXRP"],
  ["FXRP", "USDC"],
  ["USDC", "FXRP"],
  ["FLR", "USDC"],
  ["USDC", "FLR"],
];

const AMOUNT_IN_RANGE: Record<TokenSymbol, [number, number]> = {
  FXRP: [10, 500],
  FLR: [500, 20_000],
  USDC: [20, 2_000],
};

function randomHash(seed: number) {
  return `0x${seed.toString(16).padStart(64, "0")}` as `0x${string}`;
}

function randomAmountIn(token: TokenSymbol) {
  const [min, max] = AMOUNT_IN_RANGE[token];
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function buildRecord(seed: number, minutesAgo: number, idPrefix: string): SwapRecord {
  const [tokenIn, tokenOut] = PAIRS[seed % PAIRS.length];
  const amountIn = randomAmountIn(tokenIn);
  const amountOut = quoteSwap(tokenIn, tokenOut, amountIn).amountOut;

  return {
    id: `${idPrefix}-${seed}`,
    txHash: randomHash(seed),
    trader: MOCK_TRADERS[seed % MOCK_TRADERS.length],
    timestamp: Date.now() - minutesAgo * 60_000,
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
  };
}

/**
 * Stand-in settled-swap feed, shaped like what useScaffoldEventHistory would
 * return for a SwapExecuted event once the AMM contract exists (see
 * brief.md) — spread across the last ~36h so the 24h stats bar has real
 * (mock) data to aggregate instead of an invented number.
 */
export function buildSeedHistory(count = 18): SwapRecord[] {
  return Array.from({ length: count }, (_, i) => buildRecord(i + 1, i * 65 + Math.floor(Math.random() * 40), "seed"));
}

let liveSeedCounter = 100_000;

/** One freshly "settled" swap, for the live-append demo on Pool Activity. */
export function buildLiveRecord(): SwapRecord {
  liveSeedCounter += 1;
  return buildRecord(liveSeedCounter, 0, "live");
}
