import type { TokenSymbol } from "./tokens";

/**
 * Stand-in AMM pool state and FTSO reference prices. There is no pool
 * contract yet (see brief.md's unresolved LP-share / on-chain-settlement
 * questions) — this drives the swap form's math until real
 * useScaffoldReadContract calls can replace it.
 */
// Reserves are set close to the mock FTSO prices below (small trades should
// show only a small deviation — a real pool tracks the oracle; only enough
// price impact from a large trade should push the deviation warning).
const MOCK_RESERVES: Record<string, { a: TokenSymbol; b: TokenSymbol; reserveA: number; reserveB: number }> = {
  FXRP_FLR: { a: "FXRP", b: "FLR", reserveA: 500_000, reserveB: 50_200_000 },
  FXRP_USDC: { a: "FXRP", b: "USDC", reserveA: 1_000_000, reserveB: 2_472_000 },
  FLR_USDC: { a: "FLR", b: "USDC", reserveA: 40_000_000, reserveB: 981_000 },
};

/** Mock FTSO USD reference prices, used only to derive the deviation check. */
const MOCK_FTSO_USD_PRICE: Record<TokenSymbol, number> = {
  FLR: 0.0245,
  FXRP: 2.47,
  USDC: 1,
};

export const SWAP_FEE_BPS = 30; // 0.3% LP/protocol fee
export const FTSO_DEVIATION_WARN_PCT = 1;

function getPool(tokenA: TokenSymbol, tokenB: TokenSymbol) {
  const direct = MOCK_RESERVES[`${tokenA}_${tokenB}`];
  if (direct) return direct;

  const inverse = MOCK_RESERVES[`${tokenB}_${tokenA}`];
  if (inverse) return { a: tokenA, b: tokenB, reserveA: inverse.reserveB, reserveB: inverse.reserveA };

  throw new Error(`No mock pool configured for ${tokenA}/${tokenB}`);
}

export type SwapQuote = {
  amountOut: number;
  spotPrice: number;
  executionPrice: number;
  priceImpactPct: number;
};

/** Constant-product (x*y=k) quote, mirroring the real AMM's pricing rules. */
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

export function getFtsoReferencePrice(tokenIn: TokenSymbol, tokenOut: TokenSymbol) {
  return MOCK_FTSO_USD_PRICE[tokenIn] / MOCK_FTSO_USD_PRICE[tokenOut];
}

export function getUsdPrice(token: TokenSymbol) {
  return MOCK_FTSO_USD_PRICE[token];
}
