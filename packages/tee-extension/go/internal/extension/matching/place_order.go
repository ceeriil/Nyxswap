package matching

import (
	"fmt"
	"math/bits"
	"strings"
	"sync/atomic"
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/orderbook"
	"extension-scaffold/pkg/types"

	"github.com/flare-foundation/go-flare-common/pkg/logger"
)

// pricePrecision is the multiplier applied to human-readable prices before
// they're stored in the TEE, giving 6 decimal places of price precision.
// price*quantity is divided back by this factor wherever a quote-token
// amount is computed. The frontend must use this same constant.
const pricePrecision = 1_000_000

// safeMulDiv returns (a*b)/c. ok=false if a*b overflows uint64 — callers
// must treat that as a hard failure, not silently wrap.
func safeMulDiv(a, b, c uint64) (uint64, bool) {
	hi, lo := bits.Mul64(a, b)
	if hi != 0 {
		return 0, false
	}
	if c == 0 {
		return 0, false
	}
	return lo / c, true
}

// mulPrice computes (quantity * price) / pricePrecision with overflow
// detection. Panics on overflow: every caller is downstream of
// calculateHold, which vets quantity*price at order-placement time via
// safeMulDiv, so reaching an overflow here means a resting order's Q*P
// wrapped after the fact — an invariant violation worth crashing on rather
// than silently producing a wrong quote amount.
func mulPrice(quantity, price uint64) uint64 {
	r, ok := safeMulDiv(quantity, price, pricePrecision)
	if !ok {
		panic(fmt.Sprintf("price math overflow: quantity=%d * price=%d / %d wraps uint64",
			quantity, price, pricePrecision))
	}
	return r
}

// nextOrderID generates a unique order ID. Concurrent-safe: the counter is
// incremented atomically and combined with a nanosecond timestamp.
var orderCounter atomic.Uint64

func nextOrderID() string {
	n := orderCounter.Add(1)
	return fmt.Sprintf("ORD-%d-%d", time.Now().UnixNano(), n)
}

// PlaceOrder handles a PLACE_ORDER request: matches against the book,
// settles any fills, attempts a pool-fallback fill for whatever's left, and
// rests the remainder if neither cleared it.
//
// Lock order: e.mu -> ob.mu (inside ob.* calls) -> balances.mu (inside
// e.balances.* calls). Nothing in pkg/orderbook or pkg/balance ever calls
// back into Engine, so this ordering cannot deadlock.
func (e *Engine) PlaceOrder(req types.PlaceOrderRequest) (*types.PlaceOrderResponse, error) {
	user := strings.ToLower(req.Sender)
	if user == "" {
		return nil, fmt.Errorf("sender address is required")
	}

	e.mu.RLock()
	pairConfig, ok := e.pairs[req.Pair]
	ob, obOK := e.orderbooks[req.Pair]
	e.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("unknown trading pair: %s", req.Pair)
	}
	if !obOK {
		return nil, fmt.Errorf("orderbook not found for pair: %s", req.Pair)
	}

	order := &orderbook.Order{
		ID:        nextOrderID(),
		Owner:     user,
		Pair:      req.Pair,
		Side:      req.Side,
		Price:     req.Price,
		Quantity:  req.Quantity,
		Timestamp: time.Now().UnixNano(),
	}

	holdToken, holdAmount, err := calculateHold(pairConfig, order)
	if err != nil {
		return nil, fmt.Errorf("calculating hold: %w", err)
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	if err := e.balances.Hold(user, holdToken, holdAmount); err != nil {
		return nil, fmt.Errorf("insufficient balance: %w", err)
	}

	matches, err := ob.PlaceOrder(order)
	if err != nil {
		_ = e.balances.Release(user, holdToken, holdAmount)
		return nil, fmt.Errorf("placing order: %w", err)
	}

	for _, m := range matches {
		e.processMatch(m, pairConfig)
	}

	// Buys: the hold was sized at the limit price, but fills happen at
	// resting (maker) prices, which are <= the limit. Release the
	// difference so it doesn't sit stuck in Held forever.
	if order.Side == orderbook.Buy && len(matches) > 0 {
		var totalTransferred uint64
		for _, m := range matches {
			totalTransferred += mulPrice(m.Quantity, m.Price)
		}
		filledQty := order.Quantity - order.Remaining
		heldForFilled := mulPrice(filledQty, order.Price)
		if heldForFilled > totalTransferred {
			_ = e.balances.Release(user, holdToken, heldForFilled-totalTransferred)
		}
	}

	var poolFill *types.PoolFillResponse
	if order.Remaining > 0 {
		poolFill, err = e.tryPoolFill(pairConfig, order)
		if err != nil {
			logger.Infof("pool fallback unavailable for order %s: %v", order.ID, err)
		}
		if poolFill != nil {
			// The pool fill covers the whole remainder — pull the resting
			// copy back off the book so it doesn't also wait for a P2P match.
			if _, cancelErr := ob.CancelOrder(order.ID, user); cancelErr != nil {
				logger.Infof("pool fallback: failed to un-rest order %s: %v", order.ID, cancelErr)
			}
			order.Remaining = 0
		}
	}

	status := "resting"
	if order.Remaining == 0 {
		status = "filled"
	} else if len(matches) > 0 {
		status = "partial"
	}

	if order.Remaining > 0 {
		e.orders[order.ID] = req.Pair
		e.userOrders[user] = append(e.userOrders[user], order.ID)
	}

	resp := &types.PlaceOrderResponse{
		OrderID:   order.ID,
		Status:    status,
		Matches:   matches,
		Remaining: order.Remaining,
		PoolFill:  poolFill,
	}

	logger.Infof("order placed: %s %s %s price=%d qty=%d matches=%d remaining=%d",
		order.ID, req.Pair, req.Side, req.Price, req.Quantity, len(matches), order.Remaining)

	return resp, nil
}

// processMatch settles a single match: transfers held funds between the two
// owners. Caller must hold e.mu.Lock().
func (e *Engine) processMatch(m orderbook.Match, pairConfig config.TradingPairConfig) {
	quoteAmount := mulPrice(m.Quantity, m.Price)
	_ = e.balances.Transfer(m.BuyOwner, m.SellOwner, pairConfig.QuoteToken, quoteAmount)
	_ = e.balances.Transfer(m.SellOwner, m.BuyOwner, pairConfig.BaseToken, m.Quantity)

	// A resting order that was fully filled is already gone from the
	// orderbook (dropped by fill()) — drop it from our own tracking too.
	e.cleanupIfFilled(m.BuyOrderID, m.BuyOwner, m.Pair)
	e.cleanupIfFilled(m.SellOrderID, m.SellOwner, m.Pair)
}

// cleanupIfFilled drops orderID from active tracking if it's no longer
// resting on the book. Caller must hold e.mu.Lock().
func (e *Engine) cleanupIfFilled(orderID, owner, pair string) {
	if _, tracked := e.orders[orderID]; !tracked {
		return
	}
	ob, ok := e.orderbooks[pair]
	if !ok || ob.GetOrder(orderID) == nil {
		delete(e.orders, orderID)
		if owner != "" {
			e.removeUserOrder(owner, orderID)
		}
	}
}
