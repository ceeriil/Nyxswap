package matching

import (
	"strings"
	"testing"

	"extension-scaffold/pkg/orderbook"
	"extension-scaffold/pkg/types"
)

func TestPlaceOrder_RestsWhenNoMatch(t *testing.T) {
	e, balances := newTestEngine()

	if err := balances.Deposit(testSeller, testBase, 1_000); err != nil {
		t.Fatal(err)
	}

	resp, err := e.PlaceOrder(types.PlaceOrderRequest{
		Sender: testSeller, Pair: testPair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100, // price=2.0 (pricePrecision=1e6)
	})
	if err != nil {
		t.Fatal(err)
	}

	if resp.Status != "resting" {
		t.Fatalf("expected status 'resting', got %q", resp.Status)
	}
	if resp.Remaining != 100 {
		t.Fatalf("expected remaining=100, got %d", resp.Remaining)
	}

	bal := balances.Get(testSeller, testBase)
	if bal.Available != 900 || bal.Held != 100 {
		t.Fatalf("expected available=900 held=100, got available=%d held=%d", bal.Available, bal.Held)
	}
}

func TestPlaceOrder_MatchesAndSettles(t *testing.T) {
	e, balances := newTestEngine()

	if err := balances.Deposit(testSeller, testBase, 100); err != nil {
		t.Fatal(err)
	}
	// price 2.0 * qty 100 = 200 quote.
	if err := balances.Deposit(testBuyer, testQuote, 200); err != nil {
		t.Fatal(err)
	}

	if _, err := e.PlaceOrder(types.PlaceOrderRequest{
		Sender: testSeller, Pair: testPair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	}); err != nil {
		t.Fatal(err)
	}
	resp, err := e.PlaceOrder(types.PlaceOrderRequest{
		Sender: testBuyer, Pair: testPair, Side: orderbook.Buy,
		Price: 2_000_000, Quantity: 100,
	})
	if err != nil {
		t.Fatal(err)
	}

	if resp.Status != "filled" {
		t.Fatalf("expected status 'filled', got %q", resp.Status)
	}
	if len(resp.Matches) != 1 || resp.Matches[0].Quantity != 100 {
		t.Fatalf("expected one match of qty 100, got %+v", resp.Matches)
	}

	sellerBase := balances.Get(testSeller, testBase)
	sellerQuote := balances.Get(testSeller, testQuote)
	buyerBase := balances.Get(testBuyer, testBase)
	buyerQuote := balances.Get(testBuyer, testQuote)

	if sellerBase.Available != 0 || sellerBase.Held != 0 {
		t.Errorf("seller base: expected available=0 held=0, got %+v", sellerBase)
	}
	if sellerQuote.Available != 200 {
		t.Errorf("seller quote: expected available=200, got %+v", sellerQuote)
	}
	if buyerBase.Available != 100 {
		t.Errorf("buyer base: expected available=100, got %+v", buyerBase)
	}
	if buyerQuote.Available != 0 || buyerQuote.Held != 0 {
		t.Errorf("buyer quote: expected available=0 held=0, got %+v", buyerQuote)
	}

	// Both orders fully filled — nothing left resting or tracked.
	if n := e.TrackedOrderCount(); n != 0 {
		t.Errorf("expected no tracked orders after full fill, got %d", n)
	}
}

func TestPlaceOrder_InsufficientBalance(t *testing.T) {
	e, _ := newTestEngine()
	// No deposit at all.

	errMsg := placeOrderExpectErr(t, e, types.PlaceOrderRequest{
		Sender: testSeller, Pair: testPair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	})
	if !strings.Contains(errMsg, "insufficient balance") {
		t.Errorf("expected 'insufficient balance' in error, got %q", errMsg)
	}
}

func TestPlaceOrder_UnknownPair(t *testing.T) {
	e, _ := newTestEngine()
	errMsg := placeOrderExpectErr(t, e, types.PlaceOrderRequest{
		Sender: testSeller, Pair: "NOPE/NOPE",
		Side: orderbook.Sell, Price: 1_000_000, Quantity: 1,
	})
	if !strings.Contains(errMsg, "unknown trading pair") {
		t.Errorf("expected 'unknown trading pair' in error, got %q", errMsg)
	}
}
