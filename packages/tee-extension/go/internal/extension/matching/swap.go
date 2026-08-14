package matching

import (
	"context"
	"fmt"
	"strings"
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/auction"
	"extension-scaffold/pkg/types"

	"github.com/flare-foundation/go-flare-common/pkg/logger"
)

// swapQuoteTimeout bounds how long the initial pool-spot-price read (for
// sizing StartPrice) is allowed to take. This runs before Swap takes e.mu,
// so it doesn't block anything else — a slow/unreachable RPC just means the
// order falls back to MinAcceptablePrice as its StartPrice too (still
// correct, just without the favorable early margin).
const swapQuoteTimeout = 3 * time.Second

// Swap handles a SWAP request: validates it, holds the worst-case funds,
// and creates a live Dutch-auction order — it does NOT attempt to match or
// fill anything itself. Matching happens only in the background resolver
// (see resolver.go); this deliberately returns as soon as the order is
// accepted, never blocking on how long the order takes to resolve. See
// types.SwapRequest's doc comment for why: the extension's request cycle is
// fully synchronous and serialized, so a handler that waited here would
// freeze every other request for as long as it waited.
func (e *Engine) Swap(req types.SwapRequest) (*types.SwapResponse, error) {
	user := strings.ToLower(req.Sender)
	if user == "" {
		return nil, fmt.Errorf("sender address is required")
	}
	if req.Quantity == 0 {
		return nil, fmt.Errorf("quantity must be greater than zero")
	}
	if req.MinAcceptablePrice == 0 {
		return nil, fmt.Errorf("minAcceptablePrice must be greater than zero")
	}
	if req.Side != auction.Buy && req.Side != auction.Sell {
		return nil, fmt.Errorf("invalid side: %s", req.Side)
	}

	e.mu.RLock()
	pairConfig, ok := e.pairs[req.Pair]
	book, bookOK := e.books[req.Pair]
	e.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("unknown trading pair: %s", req.Pair)
	}
	if !bookOK {
		return nil, fmt.Errorf("book not found for pair: %s", req.Pair)
	}

	startPrice := e.startPriceFor(pairConfig, req.Side, req.MinAcceptablePrice)

	holdToken, holdAmount, err := calculateHold(pairConfig, req.Side, req.Quantity, req.MinAcceptablePrice)
	if err != nil {
		return nil, fmt.Errorf("calculating hold: %w", err)
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	if err := e.balances.Hold(user, holdToken, holdAmount); err != nil {
		return nil, fmt.Errorf("insufficient balance: %w", err)
	}

	order := &auction.Order{
		ID:          nextOrderID(),
		Owner:       user,
		Pair:        req.Pair,
		Side:        req.Side,
		Quantity:    req.Quantity,
		StartPrice:  startPrice,
		FloorPrice:  req.MinAcceptablePrice,
		SubmittedAt: time.Now(),
		Duration:    config.SwapAuctionDuration,
	}
	if err := book.Add(order); err != nil {
		_ = e.balances.Release(user, holdToken, holdAmount)
		return nil, fmt.Errorf("creating order: %w", err)
	}
	e.trackOrder(user, order.ID, req.Pair)

	logger.Infof("swap order created: %s %s %s qty=%d start=%d floor=%d expires=%s",
		order.ID, req.Pair, req.Side, req.Quantity, startPrice, req.MinAcceptablePrice,
		order.SubmittedAt.Add(order.Duration).Format(time.RFC3339))

	return &types.SwapResponse{
		OrderID:    order.ID,
		Pair:       req.Pair,
		Side:       req.Side,
		Quantity:   req.Quantity,
		StartPrice: startPrice,
		FloorPrice: req.MinAcceptablePrice,
		ExpiresAt:  order.SubmittedAt.Add(order.Duration).UnixNano(),
	}, nil
}

// startPriceFor picks StartPrice: startPriceMarginBps more favorable than
// the pool's current spot price if one's available, clamped to never be
// LESS favorable than the caller's own floor (that would mean starting the
// auction already worse than the caller is willing to accept, which makes
// no sense — floor is already the worst case). Falls back to floorPrice
// itself (no decay margin, but still correct) if no spot price is available.
func (e *Engine) startPriceFor(pair config.TradingPairConfig, side auction.Side, floorPrice uint64) uint64 {
	ctx, cancel := context.WithTimeout(context.Background(), swapQuoteTimeout)
	defer cancel()

	spot, ok := e.spotPrice(ctx, pair, side)
	if !ok {
		return floorPrice
	}

	var start uint64
	switch side {
	case auction.Buy:
		// Favorable to a buyer = lower. Start below spot by the margin.
		start = spot - (spot*startPriceMarginBps)/10_000
		if start > floorPrice {
			// Spot itself is already worse than the caller's floor —
			// nothing favorable to offer; start at the floor instead.
			return floorPrice
		}
	case auction.Sell:
		// Favorable to a seller = higher. Start above spot by the margin.
		start = spot + (spot*startPriceMarginBps)/10_000
		if start < floorPrice {
			return floorPrice
		}
	default:
		return floorPrice
	}
	return start
}
