package matching

import (
	"context"
	"fmt"
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/auction"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
)

// chainCallTimeout bounds how long a pool-fallback attempt can hold e.mu
// before giving up. Called from the resolver tick, which holds e.mu for the
// whole pass (see resolver.go's lock-order comment), so an unbounded RPC
// call here would stall every other request for as long as the RPC hangs.
const chainCallTimeout = 5 * time.Second

// tryPoolFill attempts to fill order's entire remaining quantity from
// pair's pool, at a price no worse than order's CURRENT decayed price
// (evaluated at now) — same guarantee the auction itself gives, just
// sourced from AMM liquidity instead of a crossing counter-order. The
// quoting/signing itself is poolfallback's job; this function's only
// responsibilities are order-side unit conversion (Sell holds/gives base,
// Buy holds/gives quote — same conventions as calculateHold) and applying
// the result to the balance ledger.
//
// Returns (nil, nil) whenever the fallback simply isn't available or isn't
// currently favorable at order's current price — that's the normal "not
// there yet" outcome the resolver just tries again next tick, not a
// failure. A non-nil error means something that should have worked didn't.
//
// Caller must hold e.mu.Lock().
func (e *Engine) tryPoolFill(pair config.TradingPairConfig, order *auction.Order, now time.Time) (*types.PoolFillResponse, error) {
	if pair.PoolAddress == (common.Address{}) || e.poolFallback == nil {
		return nil, nil
	}

	limitPrice := order.CurrentPrice(now)

	var aToB bool
	var tokenIn, tokenOut common.Address
	var amountIn, minAmountOut uint64

	switch order.Side {
	case auction.Sell:
		// Giving base (A), wanting quote (B) — same direction as the base
		// token the Sell order already holds (see calculateHold).
		aToB = true
		tokenIn, tokenOut = pair.BaseToken, pair.QuoteToken
		amountIn = order.Remaining
		minAmountOut = mulPrice(order.Remaining, limitPrice)
	case auction.Buy:
		// Giving quote (B), wanting base (A) — same held amount
		// calculateHold computed for the Buy order's remainder, sized at
		// FloorPrice (the worst case); at any less-decayed current price
		// this spends less than what's held, never more.
		aToB = false
		tokenIn, tokenOut = pair.QuoteToken, pair.BaseToken
		amountIn = mulPrice(order.Remaining, limitPrice)
		minAmountOut = order.Remaining
	default:
		return nil, fmt.Errorf("invalid side: %s", order.Side)
	}

	if amountIn == 0 || minAmountOut == 0 {
		// Remainder too small to price at all under this pair's precision —
		// not worth a fallback attempt this tick.
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), chainCallTimeout)
	defer cancel()

	resp, err := e.poolFallback.Try(ctx, pair.PoolAddress, aToB, amountIn, minAmountOut, order.ID)
	if err != nil {
		return nil, err
	}
	if resp == nil {
		// Pool can't currently match order's current decayed price — leave
		// it live, exactly as if no fallback were configured at all.
		return nil, nil
	}

	// Only mutate the balance ledger once the signature is in hand — if
	// anything above failed, the order simply stays live and no balance
	// was ever touched.
	if err := e.balances.SpendHeld(order.Owner, tokenIn, resp.AmountIn); err != nil {
		return nil, fmt.Errorf("spending held balance for pool fill: %w", err)
	}
	if err := e.balances.Deposit(order.Owner, tokenOut, resp.AmountOut); err != nil {
		return nil, fmt.Errorf("crediting pool fill proceeds: %w", err)
	}

	return resp, nil
}
