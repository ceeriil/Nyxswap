import type { TokenSymbol } from "../../app/_lib/tokens";

/**
 * MOCK — stand-in LP position, used only to drive Withdraw's ratio-linked
 * amounts and "available" display until the real ledger/LP-token decision
 * lands (see brief.md) and a useScaffoldReadContract call can replace it.
 */
const MOCK_USER_POSITION: Record<string, { amountA: number; amountB: number }> = {
  FXRP_WFLR: { amountA: 1_200, amountB: 118_000 },
  FXRP_USDT: { amountA: 800, amountB: 1_976 },
  WFLR_USDT: { amountA: 50_000, amountB: 1_226 },
};

// Any pair the user picks that isn't one of the three real trading pairs
// above (TokenSelect now offers all 20 deployed test tokens, not just
// those three) gets a small placeholder position instead of throwing, so
// picking an arbitrary combination degrades to "not much to withdraw"
// rather than crashing the form.
const FALLBACK_POSITION = { amountA: 0, amountB: 0 };

export function getUserPosition(tokenA: TokenSymbol, tokenB: TokenSymbol) {
  const direct = MOCK_USER_POSITION[`${tokenA}_${tokenB}`];
  if (direct) return direct;

  const inverse = MOCK_USER_POSITION[`${tokenB}_${tokenA}`];
  if (inverse) return { amountA: inverse.amountB, amountB: inverse.amountA };

  return FALLBACK_POSITION;
}

/** Current position ratio (no fee involved — this just splits an existing balance). */
export function getPositionRatio(tokenA: TokenSymbol, tokenB: TokenSymbol) {
  const position = getUserPosition(tokenA, tokenB);
  if (position.amountA === 0 || position.amountB === 0) return { bPerA: 0, aPerB: 0 };
  return { bPerA: position.amountB / position.amountA, aPerB: position.amountA / position.amountB };
}
