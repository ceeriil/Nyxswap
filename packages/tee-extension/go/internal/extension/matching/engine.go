// Package matching is the dark-pool trading engine: price-time-priority
// order matching against pkg/orderbook, held-balance accounting, and the
// pool-fallback attempt for whatever a resting order's remainder can't
// match peer-to-peer. Everything about who's trading what lives only here,
// in TEE memory — see NyxSwapVault.sol's header for why that's the point.
package matching

import (
	"fmt"
	"sync"

	"extension-scaffold/internal/config"
	"extension-scaffold/internal/extension/poolfallback"
	"extension-scaffold/pkg/balance"
	"extension-scaffold/pkg/orderbook"

	"github.com/ethereum/go-ethereum/common"
)

// Engine owns one orderbook per configured trading pair, plus the
// bookkeeping needed to route a CANCEL_ORDER back to the right book and
// balances shared with the rest of the extension. Engine guards its own
// state; callers don't need to hold any lock of their own.
type Engine struct {
	mu sync.RWMutex

	orderbooks   map[string]*orderbook.OrderBook     // pair name -> orderbook
	pairs        map[string]config.TradingPairConfig // pair name -> token addresses
	orders       map[string]string                   // orderID -> pair (for cancel routing)
	userOrders   map[string][]string                 // user address -> list of orderIDs
	balances     *balance.Manager                    // shared with the rest of the extension
	poolFallback *poolfallback.Fallback              // optional; nil disables pool fallback
}

// New builds an Engine with one fresh orderbook per entry in pairs.
// poolFallback may be nil, which disables the pool-fallback attempt
// entirely — every order that isn't fully matched peer-to-peer just rests.
func New(pairs map[string]config.TradingPairConfig, balances *balance.Manager, poolFallback *poolfallback.Fallback) *Engine {
	orderbooks := make(map[string]*orderbook.OrderBook, len(pairs))
	for name := range pairs {
		orderbooks[name] = orderbook.NewOrderBook(name)
	}
	return &Engine{
		orderbooks:   orderbooks,
		pairs:        pairs,
		orders:       make(map[string]string),
		userOrders:   make(map[string][]string),
		balances:     balances,
		poolFallback: poolFallback,
	}
}

// PairCount returns how many trading pairs are configured.
func (e *Engine) PairCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.pairs)
}

// TrackedOrderCount returns how many orders are currently resting and
// tracked for cancellation. Exposed for tests; no handler needs it.
func (e *Engine) TrackedOrderCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.orders)
}

// removeUserOrder removes an orderID from the user's order list.
// Caller must hold e.mu.Lock().
func (e *Engine) removeUserOrder(user, orderID string) {
	ids := e.userOrders[user]
	for i, id := range ids {
		if id == orderID {
			e.userOrders[user] = append(ids[:i], ids[i+1:]...)
			return
		}
	}
}

// calculateHold determines what token and how much to hold for an order
// before it's placed. Every order is a limit order (see orderbook.Order's
// doc comment), so this is always computable up front from Price*Quantity —
// no "hold whatever's available" branch for a market order that doesn't exist.
func calculateHold(pair config.TradingPairConfig, order *orderbook.Order) (holdToken common.Address, holdAmount uint64, err error) {
	switch order.Side {
	case orderbook.Buy:
		holdToken = pair.QuoteToken
		var ok bool
		holdAmount, ok = safeMulDiv(order.Quantity, order.Price, pricePrecision)
		if !ok {
			return holdToken, 0, fmt.Errorf("overflow: quantity * price exceeds uint64")
		}
	case orderbook.Sell:
		holdToken = pair.BaseToken
		holdAmount = order.Quantity
	default:
		return holdToken, 0, fmt.Errorf("invalid side: %s", order.Side)
	}
	return holdToken, holdAmount, nil
}

// calculateRelease determines what token and how much to release for a
// cancelled order's unfilled remainder.
func calculateRelease(pair config.TradingPairConfig, order *orderbook.Order) (common.Address, uint64) {
	switch order.Side {
	case orderbook.Buy:
		return pair.QuoteToken, mulPrice(order.Remaining, order.Price)
	case orderbook.Sell:
		return pair.BaseToken, order.Remaining
	default:
		return common.Address{}, 0
	}
}
