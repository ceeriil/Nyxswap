package auction

import (
	"errors"
	"sort"
	"sync"
	"time"
)

var (
	ErrOrderNotFound   = errors.New("order not found")
	ErrNotOwner        = errors.New("not the order owner")
	ErrInvalidQuantity = errors.New("quantity must be greater than zero")
	ErrInvalidSide     = errors.New("invalid order side")
	ErrInvalidPrices   = errors.New("start/floor price must be greater than zero")
)

// Book holds every live order for a single trading pair, across both sides.
// Unlike a resting limit-order book, entries here are always time-bounded —
// see Order's doc comment.
type Book struct {
	mu     sync.RWMutex
	pair   string
	orders map[string]*Order
}

func NewBook(pair string) *Book {
	return &Book{pair: pair, orders: make(map[string]*Order)}
}

// Add validates and inserts order, setting its Remaining to its full Quantity.
func (b *Book) Add(order *Order) error {
	if err := validate(order); err != nil {
		return err
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	order.Remaining = order.Quantity
	b.orders[order.ID] = order
	return nil
}

// Remove takes order off the book after verifying the caller is the owner.
// Returns the order (with its Remaining at time of removal) so the caller
// can release the right amount of held balance.
func (b *Book) Remove(orderID, owner string) (*Order, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	order, ok := b.orders[orderID]
	if !ok {
		return nil, ErrOrderNotFound
	}
	if order.Owner != owner {
		return nil, ErrNotOwner
	}
	delete(b.orders, orderID)
	return order, nil
}

// Drop unconditionally removes orderID (used by the resolver once an order
// is fully filled or has expired without ever needing an owner check).
func (b *Book) Drop(orderID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.orders, orderID)
}

// Get returns the live order with the given ID, or nil if it's not
// currently live (filled/cancelled/expired/never existed).
func (b *Book) Get(orderID string) *Order {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.orders[orderID]
}

// Live returns a snapshot of every currently-live order — safe to read
// without the book's own lock afterward.
func (b *Book) Live() []*Order {
	b.mu.RLock()
	defer b.mu.RUnlock()
	out := make([]*Order, 0, len(b.orders))
	for _, o := range b.orders {
		out = append(out, o)
	}
	return out
}

// Cross matches every currently-crossing pair of live buy/sell orders, at
// each order's own current decayed price (see Order.CurrentPrice) — the
// earlier-submitted side of each match sets the execution price, the same
// "maker's price" convention a resting-order book would use, just
// recomputed fresh on every call instead of fixed at insertion. Fully
// filled orders are dropped from the book as part of the same pass.
//
// A continuous double auction: best bid (highest current price) is matched
// against best ask (lowest current price) while they still cross, walking
// down/up each side in price-then-time priority. Deliberately re-sorted
// fresh on every call rather than kept in a persistent heap — the live set
// is bounded by each order's own auction duration (dozens of orders at
// most, not thousands of resting orders accumulated over time), so an
// O(n log n) sort per resolver tick is simpler to reason about correctly
// than an incrementally-maintained structure, at negligible cost.
func (b *Book) Cross(now time.Time) []Match {
	b.mu.Lock()
	defer b.mu.Unlock()

	var buys, sells []*Order
	for _, o := range b.orders {
		switch o.Side {
		case Buy:
			buys = append(buys, o)
		case Sell:
			sells = append(sells, o)
		}
	}
	if len(buys) == 0 || len(sells) == 0 {
		return nil
	}

	sort.Slice(buys, func(i, j int) bool {
		pi, pj := buys[i].CurrentPrice(now), buys[j].CurrentPrice(now)
		if pi != pj {
			return pi > pj // highest bid first
		}
		return buys[i].SubmittedAt.Before(buys[j].SubmittedAt)
	})
	sort.Slice(sells, func(i, j int) bool {
		pi, pj := sells[i].CurrentPrice(now), sells[j].CurrentPrice(now)
		if pi != pj {
			return pi < pj // lowest ask first
		}
		return sells[i].SubmittedAt.Before(sells[j].SubmittedAt)
	})

	var matches []Match
	bi, si := 0, 0
	for bi < len(buys) && si < len(sells) {
		buy, sell := buys[bi], sells[si]
		buyPrice, sellPrice := buy.CurrentPrice(now), sell.CurrentPrice(now)
		if buyPrice < sellPrice {
			break // best remaining pair no longer crosses; none behind it will either
		}

		execPrice := sellPrice
		if buy.SubmittedAt.Before(sell.SubmittedAt) {
			execPrice = buyPrice
		}

		qty := buy.Remaining
		if sell.Remaining < qty {
			qty = sell.Remaining
		}

		matches = append(matches, Match{
			BuyOrderID: buy.ID, SellOrderID: sell.ID,
			BuyOwner: buy.Owner, SellOwner: sell.Owner,
			Pair: b.pair, Price: execPrice, Quantity: qty, Timestamp: now.UnixNano(),
		})

		buy.Remaining -= qty
		sell.Remaining -= qty

		if buy.Remaining == 0 {
			delete(b.orders, buy.ID)
			bi++
		}
		if sell.Remaining == 0 {
			delete(b.orders, sell.ID)
			si++
		}
	}

	return matches
}

func validate(order *Order) error {
	if order.Side != Buy && order.Side != Sell {
		return ErrInvalidSide
	}
	if order.Quantity == 0 {
		return ErrInvalidQuantity
	}
	if order.StartPrice == 0 || order.FloorPrice == 0 {
		return ErrInvalidPrices
	}
	return nil
}
