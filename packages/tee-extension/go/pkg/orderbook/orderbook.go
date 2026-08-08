package orderbook

import (
	"sync"
	"time"
)

// OrderBook is a price-time-priority matching engine for a single trading
// pair. All state is in-memory only — see the package doc comment.
type OrderBook struct {
	mu   sync.RWMutex
	pair string
	bids *orderSide // descending: highest bid first
	asks *orderSide // ascending: lowest ask first
}

// NewOrderBook creates an empty OrderBook for the given trading pair.
func NewOrderBook(pair string) *OrderBook {
	return &OrderBook{
		pair: pair,
		bids: newOrderSide(true),
		asks: newOrderSide(false),
	}
}

// PlaceOrder validates and matches an order against the opposite side, in
// price-time priority. Any unfilled remainder rests on the book — there is
// no market-order variant that discards its remainder, see the Order doc
// comment for why.
func (ob *OrderBook) PlaceOrder(order *Order) ([]Match, error) {
	if err := validateOrder(order); err != nil {
		return nil, err
	}

	ob.mu.Lock()
	defer ob.mu.Unlock()

	order.Remaining = order.Quantity
	var matches []Match

	switch order.Side {
	case Buy:
		matches = ob.matchBuy(order, order.Price)
		if order.Remaining > 0 {
			ob.bids.Add(order)
		}
	case Sell:
		matches = ob.matchSell(order, order.Price)
		if order.Remaining > 0 {
			ob.asks.Add(order)
		}
	}

	return matches, nil
}

// CancelOrder removes an order from the book after verifying the caller is
// the owner. Returns the cancelled order (with its Remaining at time of
// cancellation) so the caller can release the right amount of held balance.
func (ob *OrderBook) CancelOrder(orderID, owner string) (*Order, error) {
	ob.mu.Lock()
	defer ob.mu.Unlock()

	if ob.bids.Has(orderID) {
		order := ob.bids.GetOrder(orderID)
		if order.Owner != owner {
			return nil, ErrNotOwner
		}
		ob.bids.Remove(orderID)
		return order, nil
	}
	if ob.asks.Has(orderID) {
		order := ob.asks.GetOrder(orderID)
		if order.Owner != owner {
			return nil, ErrNotOwner
		}
		ob.asks.Remove(orderID)
		return order, nil
	}
	return nil, ErrOrderNotFound
}

// GetOrder returns a pointer to the resting order with the given ID, on
// either side, or nil if it's not currently resting (filled/cancelled).
func (ob *OrderBook) GetOrder(orderID string) *Order {
	ob.mu.RLock()
	defer ob.mu.RUnlock()
	if o := ob.bids.GetOrder(orderID); o != nil {
		return o
	}
	return ob.asks.GetOrder(orderID)
}

// matchBuy sweeps asks for a buy order, never crossing limitPrice.
func (ob *OrderBook) matchBuy(order *Order, limitPrice uint64) []Match {
	var matches []Match
	for order.Remaining > 0 {
		resting := ob.asks.Best()
		if resting == nil || resting.Price > limitPrice {
			break
		}
		matches = ob.fill(order, resting, ob.asks, matches)
	}
	return matches
}

// matchSell sweeps bids for a sell order, never crossing limitPrice.
func (ob *OrderBook) matchSell(order *Order, limitPrice uint64) []Match {
	var matches []Match
	for order.Remaining > 0 {
		resting := ob.bids.Best()
		if resting == nil || resting.Price < limitPrice {
			break
		}
		matches = ob.fill(order, resting, ob.bids, matches)
	}
	return matches
}

// fill executes one fill between incoming and the best resting order on
// restingSide, at the resting order's price (maker's price), and drops the
// resting order from its side once fully filled.
func (ob *OrderBook) fill(incoming, resting *Order, restingSide *orderSide, matches []Match) []Match {
	fillQty := min64(incoming.Remaining, resting.Remaining)
	now := time.Now().UnixNano()

	var m Match
	if incoming.Side == Buy {
		m = Match{
			BuyOrderID: incoming.ID, SellOrderID: resting.ID,
			BuyOwner: incoming.Owner, SellOwner: resting.Owner,
			Pair: ob.pair, Price: resting.Price, Quantity: fillQty, Timestamp: now,
		}
	} else {
		m = Match{
			BuyOrderID: resting.ID, SellOrderID: incoming.ID,
			BuyOwner: resting.Owner, SellOwner: incoming.Owner,
			Pair: ob.pair, Price: resting.Price, Quantity: fillQty, Timestamp: now,
		}
	}
	matches = append(matches, m)

	incoming.Remaining -= fillQty
	resting.Remaining -= fillQty

	if resting.Remaining == 0 {
		restingSide.dropBest()
	}

	return matches
}

// validateOrder checks common invariants.
func validateOrder(order *Order) error {
	if order.Side != Buy && order.Side != Sell {
		return ErrInvalidSide
	}
	if order.Price == 0 {
		return ErrInvalidPrice
	}
	if order.Quantity == 0 {
		return ErrInvalidQuantity
	}
	return nil
}
