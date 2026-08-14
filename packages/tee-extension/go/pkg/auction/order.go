// Package auction implements a Dutch-auction matching model for a single
// trading pair — the same idea 1inch Fusion uses for intent-based swaps,
// adapted to NyxSwap's shape (the TEE itself is the only "resolver," filling
// against either another live order or NyxSwapVault.fillFromPool's AMM
// fallback, rather than a network of competing third-party resolvers).
//
// Every order's acceptable price decays linearly from StartPrice (favorable
// to the submitter) toward FloorPrice (the pool's spot price at submission
// time, so a fill via the pool is always guaranteed once decay reaches it)
// over Duration. This deliberately isn't a resting limit-order book: an
// order is never persisted past its own auction window, and its acceptable
// price is recomputed fresh on every resolver pass rather than fixed at
// submission — see internal/extension/matching's Engine for the resolver
// loop that actually drives this.
package auction

import "time"

// Side is which side of a pair an order is on.
type Side string

const (
	Buy  Side = "buy"
	Sell Side = "sell"
)

// Order is a single live Dutch-auction intent. Everything here lives only in
// TEE memory — an Order is never written to chain or logged to the proxy;
// the only observable trace of trading activity is a pool fallback fill (see
// NyxSwapVault.fillFromPool on the Solidity side), which is anonymous.
type Order struct {
	ID        string `json:"id"`
	Owner     string `json:"owner"`
	Pair      string `json:"pair"`
	Side      Side   `json:"side"`
	Quantity  uint64 `json:"quantity"`
	Remaining uint64 `json:"remaining"`

	// StartPrice is the acceptable price at t=0 — favorable to the submitter
	// (lower than pool spot for a Buy, higher for a Sell). FloorPrice is the
	// acceptable price once Duration has fully elapsed — the pool's spot
	// price at submission, guaranteeing an eventual fill. Price is
	// denominated in the quote token, scaled by PricePrecision (see
	// internal/extension/matching) to keep integer arithmetic exact.
	StartPrice uint64 `json:"startPrice"`
	FloorPrice uint64 `json:"floorPrice"`

	SubmittedAt time.Time     `json:"submittedAt"`
	Duration    time.Duration `json:"duration"`
}

// CurrentPrice returns the order's acceptable price at time now, linearly
// interpolated between StartPrice (at SubmittedAt) and FloorPrice (at
// SubmittedAt+Duration). Clamped to FloorPrice once Duration has elapsed —
// the order never becomes MORE favorable to the submitter than the
// guaranteed pool-fillable rate, and never keeps decaying past it.
func (o *Order) CurrentPrice(now time.Time) uint64 {
	elapsed := now.Sub(o.SubmittedAt)
	if elapsed <= 0 {
		return o.StartPrice
	}
	if elapsed >= o.Duration {
		return o.FloorPrice
	}

	frac := float64(elapsed) / float64(o.Duration)
	var delta float64
	if o.FloorPrice >= o.StartPrice {
		delta = float64(o.FloorPrice-o.StartPrice) * frac
		return o.StartPrice + uint64(delta)
	}
	delta = float64(o.StartPrice-o.FloorPrice) * frac
	return o.StartPrice - uint64(delta)
}

// Expired reports whether now is at or past the end of the order's auction
// window — the point past which CurrentPrice no longer changes.
func (o *Order) Expired(now time.Time) bool {
	return now.Sub(o.SubmittedAt) >= o.Duration
}

// Match is one fill between two live orders. Never leaves TEE memory except
// as a summary in the two owners' own GET_MY_STATE responses — nobody but
// the two parties ever sees it.
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
