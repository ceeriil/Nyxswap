package matching

import (
	"fmt"
	"strings"

	"extension-scaffold/pkg/types"

	"github.com/flare-foundation/go-flare-common/pkg/logger"
)

// CancelOrder handles a CANCEL_ORDER request.
func (e *Engine) CancelOrder(req types.CancelOrderRequest) (*types.CancelOrderResponse, error) {
	user := strings.ToLower(req.Sender)
	if user == "" {
		return nil, fmt.Errorf("sender address is required")
	}

	e.mu.Lock()
	pairName, ok := e.orders[req.OrderID]
	if !ok {
		e.mu.Unlock()
		return nil, fmt.Errorf("order not found: %s", req.OrderID)
	}
	ob, ok := e.orderbooks[pairName]
	if !ok {
		e.mu.Unlock()
		return nil, fmt.Errorf("orderbook not found for pair: %s", pairName)
	}
	pairConfig := e.pairs[pairName]
	e.mu.Unlock()

	cancelled, err := ob.CancelOrder(req.OrderID, user)
	if err != nil {
		return nil, fmt.Errorf("cancelling order: %w", err)
	}

	releaseToken, releaseAmount := calculateRelease(pairConfig, cancelled)
	if releaseAmount > 0 {
		_ = e.balances.Release(user, releaseToken, releaseAmount)
	}

	e.mu.Lock()
	delete(e.orders, req.OrderID)
	e.removeUserOrder(user, req.OrderID)
	e.mu.Unlock()

	resp := &types.CancelOrderResponse{
		OrderID:   cancelled.ID,
		Pair:      cancelled.Pair,
		Side:      string(cancelled.Side),
		Remaining: cancelled.Remaining,
	}

	logger.Infof("order cancelled: %s pair=%s remaining=%d", cancelled.ID, pairName, cancelled.Remaining)

	return resp, nil
}
