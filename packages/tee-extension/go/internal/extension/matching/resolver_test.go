package matching

import (
	"testing"
	"time"

	"extension-scaffold/pkg/auction"
	"extension-scaffold/pkg/types"
)

func TestResolveOnce_CrossesTwoLiveOrdersAndSettlesBalances(t *testing.T) {
	e, balances := newTestEngine()
	fundAndHold(t, e, balances, testBuyer, testQuote, 1_000_000)
	fundAndHold(t, e, balances, testSeller, testBase, 1_000)

	// Buy: floor 1_100_000 (willing to pay up to 1.1). Sell: floor 900_000
	// (willing to accept down to 0.9). Both start favorable (buy low, sell
	// high) so they don't cross at t=0 — they converge as they decay.
	buyResp, err := e.Swap(types.SwapRequest{
		Sender: testBuyer, Pair: testPair, Side: auction.Buy,
		Quantity: 100, MinAcceptablePrice: 1_100_000,
	})
	if err != nil {
		t.Fatalf("buyer Swap: %v", err)
	}
	sellResp, err := e.Swap(types.SwapRequest{
		Sender: testSeller, Pair: testPair, Side: auction.Sell,
		Quantity: 100, MinAcceptablePrice: 900_000,
	})
	if err != nil {
		t.Fatalf("seller Swap: %v", err)
	}

	// Force both orders' decay curves to already overlap, deterministically,
	// rather than depending on real wall-clock decay timing in a test.
	buyOrder := e.books[testPair].Get(buyResp.OrderID)
	buyOrder.StartPrice = 1_000_000
	sellOrder := e.books[testPair].Get(sellResp.OrderID)
	sellOrder.StartPrice = 1_000_000

	e.resolveOnce(time.Now())

	buyerBase := balances.Get(testBuyer, testBase)
	if buyerBase.Available != 100 {
		t.Fatalf("expected buyer to receive 100 base, got %d", buyerBase.Available)
	}
	sellerQuote := balances.Get(testSeller, testQuote)
	if sellerQuote.Available != 100 {
		t.Fatalf("expected seller to receive 100 quote (100 qty * 1.0 price), got %d", sellerQuote.Available)
	}

	if e.books[testPair].Get(buyResp.OrderID) != nil {
		t.Fatal("buy order should be fully filled and off the book")
	}
	if e.books[testPair].Get(sellResp.OrderID) != nil {
		t.Fatal("sell order should be fully filled and off the book")
	}

	if entry, ok := e.resolved[buyResp.OrderID]; !ok || entry.view.Status != "filled" {
		t.Fatalf("expected buy order resolved as filled, got %+v", entry)
	}
}

func TestResolveOnce_ExpiresUnfilledOrderAndReleasesHold(t *testing.T) {
	e, balances := newTestEngine()
	fundAndHold(t, e, balances, testBuyer, testQuote, 1_000_000)

	resp, err := e.Swap(types.SwapRequest{
		Sender: testBuyer, Pair: testPair, Side: auction.Buy,
		Quantity: 100, MinAcceptablePrice: 2_000_000,
	})
	if err != nil {
		t.Fatalf("Swap: %v", err)
	}

	order := e.books[testPair].Get(resp.OrderID)
	past := order.SubmittedAt.Add(order.Duration + time.Second)

	e.resolveOnce(past)

	if e.books[testPair].Get(resp.OrderID) != nil {
		t.Fatal("expired order should be off the book")
	}
	held := balances.Get(testBuyer, testQuote)
	if held.Held != 0 {
		t.Fatalf("expected held funds released on expiry, got %d still held", held.Held)
	}

	entry, ok := e.resolved[resp.OrderID]
	if !ok {
		t.Fatal("expected order to be recorded as resolved")
	}
	if entry.view.Status != "expired" {
		t.Fatalf("expected status expired, got %s", entry.view.Status)
	}
	if entry.view.Remaining != 100 {
		t.Fatalf("expected full 100 remaining unfilled, got %d", entry.view.Remaining)
	}
}

func TestResolveOnce_NoOpWithNoLiveOrders(t *testing.T) {
	e, _ := newTestEngine()
	// Should not panic or error with an empty book.
	e.resolveOnce(time.Now())
}
