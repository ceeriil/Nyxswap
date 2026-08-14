package matching

import (
	"testing"

	"extension-scaffold/pkg/auction"
	"extension-scaffold/pkg/balance"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
)

func fundAndHold(t *testing.T, e *Engine, balances *balance.Manager, user string, token common.Address, amount uint64) {
	t.Helper()
	if err := balances.Deposit(user, token, amount); err != nil {
		t.Fatalf("Deposit: %v", err)
	}
}

func TestSwap_BuyHoldsQuoteAtFloorPrice(t *testing.T) {
	e, balances := newTestEngine()
	fundAndHold(t, e, balances, testBuyer, testQuote, 1_000_000)

	resp, err := e.Swap(types.SwapRequest{
		Sender: testBuyer, Pair: testPair, Side: auction.Buy,
		Quantity: 100, MinAcceptablePrice: 2_000_000, // floor: 2.0
	})
	if err != nil {
		t.Fatalf("Swap: %v", err)
	}
	if resp.FloorPrice != 2_000_000 {
		t.Fatalf("expected floor 2_000_000, got %d", resp.FloorPrice)
	}
	// No reader configured, so StartPrice falls back to FloorPrice (no
	// favorable margin available without a spot price reference).
	if resp.StartPrice != resp.FloorPrice {
		t.Fatalf("expected StartPrice == FloorPrice with no reader, got start=%d floor=%d", resp.StartPrice, resp.FloorPrice)
	}

	// Hold = quantity * floorPrice / pricePrecision = 100 * 2_000_000 / 1_000_000 = 200.
	held := balances.Get(testBuyer, testQuote)
	if held.Held != 200 {
		t.Fatalf("expected 200 held, got %d", held.Held)
	}
}

func TestSwap_SellHoldsFullQuantityRegardlessOfPrice(t *testing.T) {
	e, balances := newTestEngine()
	fundAndHold(t, e, balances, testSeller, testBase, 1_000)

	_, err := e.Swap(types.SwapRequest{
		Sender: testSeller, Pair: testPair, Side: auction.Sell,
		Quantity: 100, MinAcceptablePrice: 1_500_000,
	})
	if err != nil {
		t.Fatalf("Swap: %v", err)
	}

	held := balances.Get(testSeller, testBase)
	if held.Held != 100 {
		t.Fatalf("expected 100 held, got %d", held.Held)
	}
}

func TestSwap_RejectsUnknownPair(t *testing.T) {
	e, _ := newTestEngine()
	msg := swapExpectErr(t, e, types.SwapRequest{
		Sender: testBuyer, Pair: "NOPE/NOPE", Side: auction.Buy,
		Quantity: 1, MinAcceptablePrice: 1,
	})
	if msg == "" {
		t.Fatal("expected error message")
	}
}

func TestSwap_RejectsZeroQuantity(t *testing.T) {
	e, _ := newTestEngine()
	swapExpectErr(t, e, types.SwapRequest{
		Sender: testBuyer, Pair: testPair, Side: auction.Buy,
		Quantity: 0, MinAcceptablePrice: 1,
	})
}

func TestSwap_RejectsZeroMinAcceptablePrice(t *testing.T) {
	e, _ := newTestEngine()
	swapExpectErr(t, e, types.SwapRequest{
		Sender: testBuyer, Pair: testPair, Side: auction.Buy,
		Quantity: 1, MinAcceptablePrice: 0,
	})
}

func TestSwap_RejectsInvalidSide(t *testing.T) {
	e, _ := newTestEngine()
	swapExpectErr(t, e, types.SwapRequest{
		Sender: testBuyer, Pair: testPair, Side: "bogus",
		Quantity: 1, MinAcceptablePrice: 1,
	})
}

func TestSwap_RejectsInsufficientBalance(t *testing.T) {
	e, _ := newTestEngine()
	// No deposit made — buyer has nothing to hold against.
	swapExpectErr(t, e, types.SwapRequest{
		Sender: testBuyer, Pair: testPair, Side: auction.Buy,
		Quantity: 100, MinAcceptablePrice: 2_000_000,
	})
}

func TestCancelSwap_ReleasesHeldFundsAndRemovesOrder(t *testing.T) {
	e, balances := newTestEngine()
	fundAndHold(t, e, balances, testBuyer, testQuote, 1_000_000)

	resp, err := e.Swap(types.SwapRequest{
		Sender: testBuyer, Pair: testPair, Side: auction.Buy,
		Quantity: 100, MinAcceptablePrice: 2_000_000,
	})
	if err != nil {
		t.Fatalf("Swap: %v", err)
	}

	if _, err := e.CancelSwap(types.CancelSwapRequest{Sender: testBuyer, OrderID: resp.OrderID}); err != nil {
		t.Fatalf("CancelSwap: %v", err)
	}

	held := balances.Get(testBuyer, testQuote)
	if held.Held != 0 {
		t.Fatalf("expected 0 held after cancel, got %d", held.Held)
	}
	if e.books[testPair].Get(resp.OrderID) != nil {
		t.Fatal("order should be removed from the book after cancel")
	}
}

func TestCancelSwap_RejectsWrongOwner(t *testing.T) {
	e, balances := newTestEngine()
	fundAndHold(t, e, balances, testBuyer, testQuote, 1_000_000)

	resp, err := e.Swap(types.SwapRequest{
		Sender: testBuyer, Pair: testPair, Side: auction.Buy,
		Quantity: 100, MinAcceptablePrice: 2_000_000,
	})
	if err != nil {
		t.Fatalf("Swap: %v", err)
	}

	cancelSwapExpectErr(t, e, types.CancelSwapRequest{Sender: testAttacker, OrderID: resp.OrderID})
}

func TestCancelSwap_RejectsUnknownOrder(t *testing.T) {
	e, _ := newTestEngine()
	cancelSwapExpectErr(t, e, types.CancelSwapRequest{Sender: testBuyer, OrderID: "nope"})
}
