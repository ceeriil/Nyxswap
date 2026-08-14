// Package matching is the auction engine: Dutch-auction SWAP intents
// against pkg/auction, held-balance accounting, and the pool-fallback
// attempt for whatever a live order's remainder can't match peer-to-peer.
// Everything about who's trading what lives only here, in TEE memory — see
// NyxSwapVault.sol's header for why that's the point.
package matching

import (
	"context"
	"fmt"
	"math/big"
	"math/bits"
	"sync"
	"sync/atomic"
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/internal/extension/poolfallback"
	"extension-scaffold/pkg/auction"
	"extension-scaffold/pkg/balance"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
)

// pricePrecision is the multiplier applied to human-readable prices before
// they're stored in the TEE, giving 6 decimal places of price precision.
// price*quantity is divided back by this factor wherever a quote-token
// amount is computed. The frontend must use this same constant.
const pricePrecision = 1_000_000

// startPriceMarginBps is how much more favorable StartPrice is than the
// pool's current spot price, when a pool is configured for the pair — gives
// an order a window where it can only match peer-to-peer at a better-than-
// pool rate, before decaying down to the pool's own rate. Purely a UX/
// incentive knob, not a correctness requirement.
const startPriceMarginBps = 50 // 0.5%

// resolvedEntry pairs a resolved order's owner with its public view, so
// GetMyState can filter by caller without exposing anyone else's.
type resolvedEntry struct {
	owner string
	view  types.ResolvedOrderView
}

// Engine owns one auction.Book per configured trading pair, the balances
// shared with the rest of the extension, and the background resolver loop
// that periodically re-checks every live order's current decayed price.
// Engine guards its own state; callers don't need to hold any lock of
// their own.
type Engine struct {
	mu sync.RWMutex

	books        map[string]*auction.Book
	pairs        map[string]config.TradingPairConfig
	balances     *balance.Manager
	poolFallback *poolfallback.Fallback
	reader       ReserveReader // may be nil — same "pool fallback disabled" convention as poolFallback

	orderPair    map[string]string          // orderID -> pair, for cancel/lookup routing
	userOrders   map[string][]string        // user -> orderIDs, live and resolved
	resolved     map[string]resolvedEntry
	partialFills map[string][]auction.Match // orderID -> matches accumulated across resolver ticks, until the order fully resolves

	stopResolver chan struct{}
	resolverDone chan struct{}
}

// ReserveReader is the subset of *poolfallback.Reader Engine depends on —
// an interface so tests can inject a stub without a live RPC endpoint.
// Exported so callers constructing an Engine can hold a typed nil safely:
// passing a nil *poolfallback.Reader directly as this interface would wrap
// it in a non-nil interface value (Go's classic typed-nil trap) — callers
// must instead leave a var of this type unset (a true nil interface) when
// there's no reader, exactly like poolFallback *poolfallback.Fallback
// already does for the same reason.
type ReserveReader interface {
	Reserves(ctx context.Context, pool common.Address) (reserveA, reserveB *big.Int, err error)
}

// New builds an Engine with one fresh auction.Book per entry in pairs, and
// starts its background resolver loop (see StartResolver). poolFallback and
// reader may both be nil, which disables the pool-fallback attempt and spot
// pricing entirely — every order that isn't fully matched peer-to-peer just
// expires unfilled at the end of its auction window.
func New(pairs map[string]config.TradingPairConfig, balances *balance.Manager, poolFallback *poolfallback.Fallback, reader ReserveReader) *Engine {
	books := make(map[string]*auction.Book, len(pairs))
	for name := range pairs {
		books[name] = auction.NewBook(name)
	}
	return &Engine{
		books:        books,
		pairs:        pairs,
		balances:     balances,
		poolFallback: poolFallback,
		reader:       reader,
		orderPair:    make(map[string]string),
		userOrders:   make(map[string][]string),
		resolved:     make(map[string]resolvedEntry),
		partialFills: make(map[string][]auction.Match),
		stopResolver: make(chan struct{}),
		resolverDone: make(chan struct{}),
	}
}

// PairCount returns how many trading pairs are configured.
func (e *Engine) PairCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.pairs)
}

func (e *Engine) trackOrder(owner, orderID, pair string) {
	e.orderPair[orderID] = pair
	e.userOrders[owner] = append(e.userOrders[owner], orderID)
}

func (e *Engine) recordResolution(owner, orderID string, view types.ResolvedOrderView) {
	e.resolved[orderID] = resolvedEntry{owner: owner, view: view}
}

// calculateHold determines what token and how much to hold for a SWAP
// before it's created, sized at the WORST price the order could ever
// execute at over its whole decay range: FloorPrice for a Buy (which needs
// more quote token the higher the price goes), a fixed Quantity of base
// token for a Sell (price-independent — see the original calculateHold this
// mirrors, née internal/extension/matching's PLACE_ORDER handler).
func calculateHold(pair config.TradingPairConfig, side auction.Side, quantity, floorPrice uint64) (holdToken common.Address, holdAmount uint64, err error) {
	switch side {
	case auction.Buy:
		holdToken = pair.QuoteToken
		var ok bool
		holdAmount, ok = safeMulDiv(quantity, floorPrice, pricePrecision)
		if !ok {
			return holdToken, 0, fmt.Errorf("overflow: quantity * floorPrice exceeds uint64")
		}
	case auction.Sell:
		holdToken = pair.BaseToken
		holdAmount = quantity
	default:
		return holdToken, 0, fmt.Errorf("invalid side: %s", side)
	}
	return holdToken, holdAmount, nil
}

// calculateRelease determines what token and how much to release for a
// cancelled or expired order's unfilled remainder, at the SAME worst-case
// price calculateHold used — the exact amount that's still actually held.
func calculateRelease(pair config.TradingPairConfig, side auction.Side, remaining, floorPrice uint64) (common.Address, uint64) {
	switch side {
	case auction.Buy:
		return pair.QuoteToken, mulPrice(remaining, floorPrice)
	case auction.Sell:
		return pair.BaseToken, remaining
	default:
		return common.Address{}, 0
	}
}

// spotPrice reads pool's live reserves and returns the raw quote-per-base
// ratio (ignoring swap fee/slippage — this is a reference price for sizing
// an order's decay curve, not an executable quote for a specific size).
// Returns (0, false) if no reader is configured, the pair has no pool, or
// the read fails — callers must handle that by falling back to some other
// reference (e.g. the caller's own MinAcceptablePrice).
func (e *Engine) spotPrice(ctx context.Context, pair config.TradingPairConfig, side auction.Side) (uint64, bool) {
	if e.reader == nil || pair.PoolAddress == (common.Address{}) {
		return 0, false
	}
	reserveA, reserveB, err := e.reader.Reserves(ctx, pair.PoolAddress)
	if err != nil {
		logger.Infof("spot price unavailable for %s: %v", pair.Name, err)
		return 0, false
	}
	// Pool's tokenA/tokenB ordering isn't necessarily base/quote — but every
	// pair here is configured with PoolAddress specifically for (base,
	// quote), so reserveA/reserveB are assumed base/quote in that order,
	// matching how poolfallback.Fallback.Try already treats aToB for this
	// same pool.
	if reserveA.Sign() == 0 || reserveB.Sign() == 0 {
		return 0, false
	}

	// price = quote/base * pricePrecision, direction depends on side only
	// in which token is "in" for calculateHold's purposes — the ratio
	// itself is the same reference regardless of side.
	num := new(big.Int).Mul(reserveB, big.NewInt(pricePrecision))
	price := new(big.Int).Div(num, reserveA)
	if !price.IsUint64() {
		return 0, false
	}
	return price.Uint64(), true
}

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
// calculateHold, which vets quantity*price at order-creation time via
// safeMulDiv, so reaching an overflow here means a live order's
// Remaining*FloorPrice wrapped after the fact — an invariant violation
// worth crashing on rather than silently producing a wrong amount.
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
	return fmt.Sprintf("SWP-%d-%d", time.Now().UnixNano(), n)
}
