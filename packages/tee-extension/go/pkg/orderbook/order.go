// Package orderbook implements a price-time-priority matching engine for a
// single trading pair. Everything here lives only in TEE memory — an Order
// resting on the book is never written to chain or logged to the proxy; the
// only observable trace of trading activity is a pool fallback fill (see
// NyxSwapVault.fillFromPool on the Solidity side), which is anonymous.
package orderbook

import "errors"

// Side is which side of the book an order rests on.
type Side string

const (
	Buy  Side = "buy"
	Sell Side = "sell"
)

// Order is a single resting or incoming order. Every order is a limit order
// — there is no separate market-order type, same as CoW Protocol: the
// Price/Quantity pair *is* the limit, and matching never crosses it. An
// order that can't be filled (in full or in part) simply rests until it
// matches or is cancelled; the pool fallback (NyxSwapVault.fillFromPool on
// the Solidity side) is the separate mechanism for guaranteed execution,
// not a market-order type within this book. Price is denominated in the
// quote token, scaled by pricePrecision (see handlers.go) to keep integer
// arithmetic exact.
type Order struct {
	ID        string `json:"id"`
	Owner     string `json:"owner"`
	Pair      string `json:"pair"`
	Side      Side   `json:"side"`
	Price     uint64 `json:"price"`
	Quantity  uint64 `json:"quantity"`
	Remaining uint64 `json:"remaining"`
	Timestamp int64  `json:"timestamp"`
}

// Match is one fill between two orders. Never leaves TEE memory except as a
// summary in the two owners' own GET_MY_STATE / history responses — nobody
// but the two parties (and, if wired in later, an accredited viewer) ever
// sees it.
type Match struct {
	BuyOrderID  string `json:"buyOrderId"`
	SellOrderID string `json:"sellOrderId"`
	BuyOwner    string `json:"buyOwner"`
	SellOwner   string `json:"sellOwner"`
	Pair        string `json:"pair"`
	Price       uint64 `json:"price"`
	Quantity    uint64 `json:"quantity"`
	Timestamp   int64  `json:"timestamp"`
}

var (
	ErrOrderNotFound   = errors.New("order not found")
	ErrNotOwner        = errors.New("not the order owner")
	ErrInvalidPrice    = errors.New("price must be greater than zero")
	ErrInvalidQuantity = errors.New("quantity must be greater than zero")
	ErrInvalidSide     = errors.New("invalid order side")
	ErrInvalidPair     = errors.New("unknown trading pair")
)

func min64(a, b uint64) uint64 {
	if a < b {
		return a
	}
	return b
}
