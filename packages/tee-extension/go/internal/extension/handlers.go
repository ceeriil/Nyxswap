package extension

import (
	"encoding/json"
	"fmt"
	"math/bits"
	"strings"
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/orderbook"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
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

// processPlaceOrder handles PLACE_ORDER direct actions.
//
// Lock order: e.mu -> ob.mu (inside ob.* calls) -> balances.mu (inside
// e.balances.* calls). Nothing in pkg/orderbook or pkg/balance ever calls
// back into Extension, so this ordering cannot deadlock.
func (e *Extension) processPlaceOrder(action teetypes.Action, df *instruction.DataFixed, msg hexutil.Bytes) teetypes.ActionResult {
	var req types.PlaceOrderRequest
	if err := json.Unmarshal(msg, &req); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
	}

	user := strings.ToLower(req.Sender)
	if user == "" {
		return buildResult(action, df, nil, 0, fmt.Errorf("sender address is required"))
	}

	pairConfig, ok := e.pairs[req.Pair]
	if !ok {
		return buildResult(action, df, nil, 0, fmt.Errorf("unknown trading pair: %s", req.Pair))
	}
	ob, ok := e.orderbooks[req.Pair]
	if !ok {
		return buildResult(action, df, nil, 0, fmt.Errorf("orderbook not found for pair: %s", req.Pair))
	}

	order := &orderbook.Order{
		ID:        e.nextOrderID(),
		Owner:     user,
		Pair:      req.Pair,
		Side:      req.Side,
		Price:     req.Price,
		Quantity:  req.Quantity,
		Timestamp: time.Now().UnixNano(),
	}

	holdToken, holdAmount, err := e.calculateHold(pairConfig, order)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("calculating hold: %w", err))
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	if err := e.balances.Hold(user, holdToken, holdAmount); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("insufficient balance: %w", err))
	}

	matches, err := ob.PlaceOrder(order)
	if err != nil {
		_ = e.balances.Release(user, holdToken, holdAmount)
		return buildResult(action, df, nil, 0, fmt.Errorf("placing order: %w", err))
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

	resp := types.PlaceOrderResponse{
		OrderID:   order.ID,
		Status:    status,
		Matches:   matches,
		Remaining: order.Remaining,
	}
	data, _ := json.Marshal(resp)

	logger.Infof("order placed: %s %s %s price=%d qty=%d matches=%d remaining=%d",
		order.ID, req.Pair, req.Side, req.Price, req.Quantity, len(matches), order.Remaining)

	return buildResult(action, df, data, 1, nil)
}

// processCancelOrder handles CANCEL_ORDER direct actions.
func (e *Extension) processCancelOrder(action teetypes.Action, df *instruction.DataFixed, msg hexutil.Bytes) teetypes.ActionResult {
	var req types.CancelOrderRequest
	if err := json.Unmarshal(msg, &req); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
	}

	user := strings.ToLower(req.Sender)
	if user == "" {
		return buildResult(action, df, nil, 0, fmt.Errorf("sender address is required"))
	}

	e.mu.Lock()
	pairName, ok := e.orders[req.OrderID]
	if !ok {
		e.mu.Unlock()
		return buildResult(action, df, nil, 0, fmt.Errorf("order not found: %s", req.OrderID))
	}
	ob, ok := e.orderbooks[pairName]
	if !ok {
		e.mu.Unlock()
		return buildResult(action, df, nil, 0, fmt.Errorf("orderbook not found for pair: %s", pairName))
	}
	pairConfig := e.pairs[pairName]
	e.mu.Unlock()

	cancelled, err := ob.CancelOrder(req.OrderID, user)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("cancelling order: %w", err))
	}

	releaseToken, releaseAmount := e.calculateRelease(pairConfig, cancelled)
	if releaseAmount > 0 {
		_ = e.balances.Release(user, releaseToken, releaseAmount)
	}

	e.mu.Lock()
	delete(e.orders, req.OrderID)
	e.removeUserOrder(user, req.OrderID)
	e.mu.Unlock()

	resp := types.CancelOrderResponse{
		OrderID:   cancelled.ID,
		Pair:      cancelled.Pair,
		Side:      string(cancelled.Side),
		Remaining: cancelled.Remaining,
	}
	data, _ := json.Marshal(resp)

	logger.Infof("order cancelled: %s pair=%s remaining=%d", cancelled.ID, pairName, cancelled.Remaining)

	return buildResult(action, df, data, 1, nil)
}

// processMatch settles a single match: transfers held funds between the two
// owners. Caller must hold e.mu.Lock().
func (e *Extension) processMatch(m orderbook.Match, pairConfig config.TradingPairConfig) {
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
func (e *Extension) cleanupIfFilled(orderID, owner, pair string) {
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

// calculateHold determines what token and how much to hold for an order
// before it's placed. Every order is a limit order (see orderbook.Order's
// doc comment), so this is always computable up front from Price*Quantity —
// no "hold whatever's available" branch for a market order that doesn't exist.
func (e *Extension) calculateHold(pair config.TradingPairConfig, order *orderbook.Order) (holdToken common.Address, holdAmount uint64, err error) {
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
func (e *Extension) calculateRelease(pair config.TradingPairConfig, order *orderbook.Order) (common.Address, uint64) {
	switch order.Side {
	case orderbook.Buy:
		return pair.QuoteToken, mulPrice(order.Remaining, order.Price)
	case orderbook.Sell:
		return pair.BaseToken, order.Remaining
	default:
		return common.Address{}, 0
	}
}
