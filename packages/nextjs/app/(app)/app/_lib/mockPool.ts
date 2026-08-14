import type { TokenSymbol } from "./tokens";

/**
 * MOCK — stand-in AMM pool state and FTSO reference prices. There is no pool
 * contract or price oracle wired up yet (see brief.md's unresolved LP-share
 * / on-chain-settlement questions) — this drives the swap form's math until
 * real useScaffoldReadContract calls can replace it. The token IDENTITIES
 * (symbols/addresses) this operates on are real, live-fetched data (see
 * ~~/hooks/wallet/useDeployedTestTokens) — only the USD prices and pool
 * reserves below are fabricated placeholders.
 */

// Placeholder USD reference prices, one per deployed test token symbol.
// Stablecoins pegged near $1, staked-FLR variants tracked close to FLR,
// ETH-wrapped variants tracked close to ETH - not real market data.
const MOCK_USD_PRICE: Record<string, number> = {
  WFLR: 0.0245,
  sFLR: 0.026,
  stFLR: 0.0265,
  SPRK: 0.05,
  flrETH: 3200,
  stXRP: 2.55,
  FXRP: 2.47,
  USDX: 1,
  cUSDX: 1,
  yUSDX: 1,
  USDT0: 1,
  "USDC.e": 1,
  USDT: 1,
  WETH: 3150,
  cyWETH: 3150,
  cysFLR: 0.0248,
  DINERO: 1,
  BUGO: 0.01,
  PiCO: 0.002,
  JOULE: 0.15,
};

// Any symbol with no explicit mock price above (a newly deployed test token
// this file hasn't been updated for) prices at $1 rather than throwing, so
// the swap form degrades to "flat" quotes instead of breaking.
function priceOf(token: TokenSymbol): number {
  return MOCK_USD_PRICE[token] ?? 1;
}

export const SWAP_FEE_BPS = 30; // 0.3% LP/protocol fee
export const FTSO_DEVIATION_WARN_PCT = 1;

// Every pair's reserves are derived from a fixed notional USD depth per
// side rather than a hand-tuned reserves table per pair - scales to any two
// of the deployed test tokens without an entry per combination.
const MOCK_POOL_USD_DEPTH = 1_000_000;

function getPool(tokenA: TokenSymbol, tokenB: TokenSymbol) {
  return {
    a: tokenA,
    b: tokenB,
    reserveA: MOCK_POOL_USD_DEPTH / priceOf(tokenA),
    reserveB: MOCK_POOL_USD_DEPTH / priceOf(tokenB),
  };
}

export type SwapQuote = {
  amountOut: number;
  spotPrice: number;
  executionPrice: number;
  priceImpactPct: number;
};

/** MOCK constant-product (x*y=k) quote, mirroring the real AMM's pricing rules. */
export function quoteSwap(tokenIn: TokenSymbol, tokenOut: TokenSymbol, amountIn: number): SwapQuote {
  if (!amountIn || amountIn <= 0 || tokenIn === tokenOut) {
    return { amountOut: 0, spotPrice: 0, executionPrice: 0, priceImpactPct: 0 };
  }

  const pool = getPool(tokenIn, tokenOut);
  const [reserveIn, reserveOut] = pool.a === tokenIn ? [pool.reserveA, pool.reserveB] : [pool.reserveB, pool.reserveA];

  const spotPrice = reserveOut / reserveIn;
  const amountInWithFee = amountIn * (1 - SWAP_FEE_BPS / 10_000);
  const amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
  const executionPrice = amountOut / amountIn;
  const priceImpactPct = ((spotPrice - executionPrice) / spotPrice) * 100;

  return { amountOut, spotPrice, executionPrice, priceImpactPct };
}

/** MOCK current pool ratio (no fee applied) — used for Vault deposit's ratio-linked amounts. */
export function getPoolRatio(tokenA: TokenSymbol, tokenB: TokenSymbol) {
  const pool = getPool(tokenA, tokenB);
  return { bPerA: pool.reserveB / pool.reserveA, aPerB: pool.reserveA / pool.reserveB };
}

export function getFtsoReferencePrice(tokenIn: TokenSymbol, tokenOut: TokenSymbol) {
  return priceOf(tokenIn) / priceOf(tokenOut);
}

export function getUsdPrice(token: TokenSymbol) {
  return priceOf(token);
}
