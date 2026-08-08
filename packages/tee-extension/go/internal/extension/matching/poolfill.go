package matching

import (
	"context"
	"fmt"
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/orderbook"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
)

// chainCallTimeout bounds how long a pool-reserve read can hold e.mu before
// giving up. PlaceOrder already holds e.mu for the whole pipeline (see its
// lock-order comment), so an unbounded RPC call here would stall every
// other order for as long as the RPC hangs.
const chainCallTimeout = 5 * time.Second

// tryPoolFill attempts to fill order's entire remaining quantity from
// pair's pool, at a price no worse than the order's own limit — same
// guarantee the orderbook itself gives, just sourced from AMM liquidity
// instead of a resting counter-order. The quoting/signing itself is
// internal/extension/poolfallback's job; this function's only
// responsibilities are order-side unit conversion (Sell holds/gives base,
// Buy holds/gives quote — same conventions as calculateHold) and applying
// the result to the balance ledger.
//
// Returns (nil, nil) whenever the fallback simply isn't available or isn't
// currently favorable — that's the normal "leave it resting" outcome, not a
// failure. A non-nil error means something that should have worked didn't
// (signing failed, or the TEE's own balance ledger rejected a spend it
// should never reject).
//
// Deliberately all-or-nothing: either the whole remainder clears the
// pool's current price at least as well as the order's limit, or none of
// it does. Partial pool fills would leave a smaller order resting and
// complicate the caller's bookkeeping for a case that isn't needed yet.
//
// Caller must hold e.mu.Lock().
func (e *Engine) tryPoolFill(pair config.TradingPairConfig, order *orderbook.Order) (*types.PoolFillResponse, error) {
	if pair.PoolAddress == (common.Address{}) || e.poolFallback == nil {
		return nil, nil
	}

	var aToB bool
	var tokenIn, tokenOut common.Address
	var amountIn, minAmountOut uint64

	switch order.Side {
	case orderbook.Sell:
		// Giving base (A), wanting quote (B) — same direction as the base
		// token the Sell order already holds (see calculateHold).
		aToB = true
		tokenIn, tokenOut = pair.BaseToken, pair.QuoteToken
		amountIn = order.Remaining
		minAmountOut = mulPrice(order.Remaining, order.Price)
	case orderbook.Buy:
		// Giving quote (B), wanting base (A) — same held amount calculateHold
		// computed for the Buy order's remainder.
		aToB = false
		tokenIn, tokenOut = pair.QuoteToken, pair.BaseToken
		amountIn = mulPrice(order.Remaining, order.Price)
		minAmountOut = order.Remaining
	default:
		return nil, fmt.Errorf("invalid side: %s", order.Side)
	}

	if amountIn == 0 || minAmountOut == 0 {
		// Remainder too small to price at all under this pair's precision —
		// not worth a fallback attempt, just rest it.
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), chainCallTimeout)
	defer cancel()

	resp, err := e.poolFallback.Try(ctx, pair.PoolAddress, aToB, amountIn, minAmountOut, order.ID)
	if err != nil {
		return nil, err
	}
	if resp == nil {
		// Pool can't currently match the order's own limit price — leave it
		// resting, exactly as if no fallback were configured at all.
		return nil, nil
	}

	// Only mutate the balance ledger once the signature is in hand — if
	// anything above failed, the order simply stays resting and no balance
	// was ever touched.
	if err := e.balances.SpendHeld(order.Owner, tokenIn, resp.AmountIn); err != nil {
		return nil, fmt.Errorf("spending held balance for pool fill: %w", err)
	}
	if err := e.balances.Deposit(order.Owner, tokenOut, resp.AmountOut); err != nil {
		return nil, fmt.Errorf("crediting pool fill proceeds: %w", err)
	}

	return resp, nil
}
