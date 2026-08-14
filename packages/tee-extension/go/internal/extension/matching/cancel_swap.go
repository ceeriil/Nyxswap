package matching

import (
	"fmt"
	"strings"

	"extension-scaffold/pkg/types"

	"github.com/flare-foundation/go-flare-common/pkg/logger"
)

// CancelSwap handles a CANCEL_SWAP request: pulls a still-live order off the
// book and releases whatever of its worst-case hold hasn't already been
// spent by a partial fill. No-op-turned-error once an order has already
// fully resolved (filled or expired) — check GET_MY_STATE for the outcome
// of an order that's no longer live instead.
func (e *Engine) CancelSwap(req types.CancelSwapRequest) (*types.CancelSwapResponse, error) {
	user := strings.ToLower(req.Sender)
	if user == "" {
		return nil, fmt.Errorf("sender address is required")
	}

	e.mu.Lock()
	pairName, ok := e.orderPair[req.OrderID]
	if !ok {
		e.mu.Unlock()
		return nil, fmt.Errorf("order not found: %s", req.OrderID)
	}
	book, ok := e.books[pairName]
	if !ok {
		e.mu.Unlock()
		return nil, fmt.Errorf("book not found for pair: %s", pairName)
	}
	pairConfig := e.pairs[pairName]
	e.mu.Unlock()

	cancelled, err := book.Remove(req.OrderID, user)
	if err != nil {
		return nil, fmt.Errorf("cancelling order: %w", err)
	}

	releaseToken, releaseAmount := calculateRelease(pairConfig, cancelled.Side, cancelled.Remaining, cancelled.FloorPrice)
	if releaseAmount > 0 {
		_ = e.balances.Release(user, releaseToken, releaseAmount)
	}

	logger.Infof("swap cancelled: %s pair=%s remaining=%d", cancelled.ID, pairName, cancelled.Remaining)

	return &types.CancelSwapResponse{
		OrderID:   cancelled.ID,
		Pair:      cancelled.Pair,
		Side:      string(cancelled.Side),
		Remaining: cancelled.Remaining,
	}, nil
}
