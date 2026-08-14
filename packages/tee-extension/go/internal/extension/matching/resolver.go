package matching

import (
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/auction"
	"extension-scaffold/pkg/types"

	"github.com/flare-foundation/go-flare-common/pkg/logger"
)

// StartResolver launches the background loop that periodically re-checks
// every live order's current decayed price: peer-to-peer crossing first,
// then pool-fallback for whatever's left, then expiring (and releasing
// held funds for) anything past its auction window that still couldn't
// fill. Runs until StopResolver is called. Never called from, and never
// blocks, any request handler — see types.SwapRequest's doc comment for
// why that split exists. Safe to call at most once per Engine.
func (e *Engine) StartResolver() {
	go func() {
		defer close(e.resolverDone)
		ticker := time.NewTicker(config.ResolverInterval)
		defer ticker.Stop()
		for {
			select {
			case <-e.stopResolver:
				return
			case now := <-ticker.C:
				e.resolveOnce(now)
			}
		}
	}()
}

// StopResolver signals the background loop to stop and waits for it to
// actually exit.
func (e *Engine) StopResolver() {
	close(e.stopResolver)
	<-e.resolverDone
}

// resolveOnce runs one full resolver pass over every configured pair.
//
// Lock order: e.mu -> a book's own internal lock (inside book.* calls) ->
// balances.mu (inside e.balances.* calls). Nothing in pkg/auction or
// pkg/balance ever calls back into Engine, so this ordering cannot deadlock.
func (e *Engine) resolveOnce(now time.Time) {
	e.mu.Lock()
	defer e.mu.Unlock()

	for pairName, book := range e.books {
		pairConfig := e.pairs[pairName]

		for _, m := range book.Cross(now) {
			e.settleMatch(pairConfig, book, m, now)
		}

		for _, order := range book.Live() {
			e.tryResolveLiveOrder(pairConfig, book, order, now)
		}
	}
}

// settleMatch transfers held funds between two peer-to-peer matched
// owners, records the match against both orders' accumulated fill history,
// and finalizes either side that Cross already fully filled (and so
// already dropped from book).
func (e *Engine) settleMatch(pairConfig config.TradingPairConfig, book *auction.Book, m auction.Match, now time.Time) {
	quoteAmount := mulPrice(m.Quantity, m.Price)
	_ = e.balances.Transfer(m.BuyOwner, m.SellOwner, pairConfig.QuoteToken, quoteAmount)
	_ = e.balances.Transfer(m.SellOwner, m.BuyOwner, pairConfig.BaseToken, m.Quantity)

	e.partialFills[m.BuyOrderID] = append(e.partialFills[m.BuyOrderID], m)
	e.partialFills[m.SellOrderID] = append(e.partialFills[m.SellOrderID], m)

	if book.Get(m.BuyOrderID) == nil {
		e.finalize(m.BuyOwner, m.BuyOrderID, pairConfig.Name, string(auction.Buy), nil, 0, now)
	}
	if book.Get(m.SellOrderID) == nil {
		e.finalize(m.SellOwner, m.SellOrderID, pairConfig.Name, string(auction.Sell), nil, 0, now)
	}
}

// tryResolveLiveOrder attempts a pool-fallback fill for order at its
// current decayed price; if that doesn't clear it and order has run out
// its full auction window, expires it and releases whatever of its
// worst-case hold is still unspent.
func (e *Engine) tryResolveLiveOrder(pairConfig config.TradingPairConfig, book *auction.Book, order *auction.Order, now time.Time) {
	poolFill, err := e.tryPoolFill(pairConfig, order, now)
	if err != nil {
		logger.Infof("pool fallback error for order %s: %v", order.ID, err)
	}
	if poolFill != nil {
		book.Drop(order.ID)
		e.finalize(order.Owner, order.ID, pairConfig.Name, string(order.Side), poolFill, 0, now)
		return
	}

	if order.Expired(now) {
		releaseToken, releaseAmount := calculateRelease(pairConfig, order.Side, order.Remaining, order.FloorPrice)
		if releaseAmount > 0 {
			_ = e.balances.Release(order.Owner, releaseToken, releaseAmount)
		}
		book.Drop(order.ID)
		e.finalize(order.Owner, order.ID, pairConfig.Name, string(order.Side), nil, order.Remaining, now)
	}
}

// finalize builds a ResolvedOrderView from whatever matches accumulated for
// orderID across every resolver tick plus (if any) this final poolFill,
// determines status, records it for GetMyState, and clears the
// accumulator entry — orderID is done being tracked as live from here on.
func (e *Engine) finalize(owner, orderID, pair, side string, poolFill *types.PoolFillResponse, remaining uint64, now time.Time) {
	matches := e.partialFills[orderID]
	delete(e.partialFills, orderID)

	status := "filled"
	switch {
	case remaining > 0 && (len(matches) > 0 || poolFill != nil):
		status = "partial"
	case remaining > 0:
		status = "expired"
	}

	view := types.ResolvedOrderView{
		OrderID:    orderID,
		Pair:       pair,
		Side:       auction.Side(side),
		Status:     status,
		Matches:    matches,
		PoolFill:   poolFill,
		Remaining:  remaining,
		ResolvedAt: now.UnixNano(),
	}
	e.recordResolution(owner, orderID, view)

	logger.Infof("swap resolved: %s pair=%s status=%s remaining=%d", orderID, pair, status, remaining)
}
