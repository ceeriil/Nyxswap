import type { TokenSymbol } from "../../app/_lib/tokens";

/**
 * Stand-in LP position, used only to drive Withdraw's ratio-linked amounts
 * and "available" display until the real ledger/LP-token decision lands
 * (see brief.md) and a useScaffoldReadContract call can replace it.
 */
const MOCK_USER_POSITION: Record<string, { amountA: number; amountB: number }> = {
  FXRP_FLR: { amountA: 1_200, amountB: 118_000 },
  FXRP_USDC: { amountA: 800, amountB: 1_976 },
  FLR_USDC: { amountA: 50_000, amountB: 1_226 },
};

export function getUserPosition(tokenA: TokenSymbol, tokenB: TokenSymbol) {
  const direct = MOCK_USER_POSITION[`${tokenA}_${tokenB}`];
  if (direct) return direct;

  const inverse = MOCK_USER_POSITION[`${tokenB}_${tokenA}`];
  if (inverse) return { amountA: inverse.amountB, amountB: inverse.amountA };

  throw new Error(`No mock LP position configured for ${tokenA}/${tokenB}`);
}

/** Current position ratio (no fee involved — this just splits an existing balance). */
export function getPositionRatio(tokenA: TokenSymbol, tokenB: TokenSymbol) {
  const position = getUserPosition(tokenA, tokenB);
  return { bPerA: position.amountB / position.amountA, aPerB: position.amountA / position.amountB };
}
