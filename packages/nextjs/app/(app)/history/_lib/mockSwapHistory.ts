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

const TRADER_COUNT = 40;

// Deterministic, always-valid (40 hex char) synthetic addresses standing in
// for other traders on the pool until real settled-swap events exist to read.
const MOCK_TRADERS: Address[] = Array.from(
  { length: TRADER_COUNT },
  (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}` as Address,
);

// The three real trading pairs configured in
// packages/tee-extension/config/pairs.json - mock history only spans these,
// not all 20 deployed test tokens, since most of those exist for the
// faucet/balance-testing surface, not as an actual matched pair.
const PAIRS: [TokenSymbol, TokenSymbol][] = [
  ["FXRP", "WFLR"],
  ["WFLR", "FXRP"],
  ["FXRP", "USDT"],
  ["USDT", "FXRP"],
  ["WFLR", "USDT"],
  ["USDT", "WFLR"],
];

const AMOUNT_IN_RANGE: Record<string, [number, number]> = {
  FXRP: [10, 500],
  WFLR: [500, 20_000],
  USDT: [20, 2_000],
};
const DEFAULT_AMOUNT_IN_RANGE: [number, number] = [10, 1_000];

function randomHash(seed: number) {
  return `0x${seed.toString(16).padStart(64, "0")}` as `0x${string}`;
}

function randomAmountIn(token: TokenSymbol) {
  const [min, max] = AMOUNT_IN_RANGE[token] ?? DEFAULT_AMOUNT_IN_RANGE;
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
 * brief.md). Spread across ~10 days (avg ~24min apart) so the table has
 * enough rows to exercise sorting/search/pagination/virtualization for real,
 * while the 24h stats bar still only captures a genuine recent slice.
 */
export function buildSeedHistory(count = 240): SwapRecord[] {
  return Array.from({ length: count }, (_, i) => buildRecord(i + 1, i * 24 + Math.floor(Math.random() * 18), "seed"));
}

let liveSeedCounter = 1_000_000;

/** One freshly "settled" swap, for the live-append demo on Pool Activity. */
export function buildLiveRecord(): SwapRecord {
  liveSeedCounter += 1;
  return buildRecord(liveSeedCounter, 0, "live");
}
