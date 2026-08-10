package matching

import (
	"strings"
	"testing"

	"extension-scaffold/pkg/orderbook"
	"extension-scaffold/pkg/types"
)

func TestCancelOrder_ReleasesHold(t *testing.T) {
	e, balances := newTestEngine()

	if err := balances.Deposit(testSeller, testBase, 100); err != nil {
		t.Fatal(err)
	}

	placed, err := e.PlaceOrder(types.PlaceOrderRequest{
		Sender: testSeller, Pair: testPair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	})
	if err != nil {
		t.Fatal(err)
	}

	resp, err := e.CancelOrder(types.CancelOrderRequest{Sender: testSeller, OrderID: placed.OrderID})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Remaining != 100 {
		t.Fatalf("expected remaining=100, got %d", resp.Remaining)
	}

	bal := balances.Get(testSeller, testBase)
	if bal.Available != 100 || bal.Held != 0 {
		t.Fatalf("expected available=100 held=0 after cancel, got available=%d held=%d", bal.Available, bal.Held)
	}
	if n := e.TrackedOrderCount(); n != 0 {
		t.Errorf("expected no tracked orders after cancel, got %d", n)
	}
}

func TestCancelOrder_WrongOwnerRejected(t *testing.T) {
	e, balances := newTestEngine()

	if err := balances.Deposit(testSeller, testBase, 100); err != nil {
		t.Fatal(err)
	}

	placed, err := e.PlaceOrder(types.PlaceOrderRequest{
		Sender: testSeller, Pair: testPair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	})
	if err != nil {
		t.Fatal(err)
	}

	errMsg := cancelOrderExpectErr(t, e, types.CancelOrderRequest{Sender: testAttacker, OrderID: placed.OrderID})
	if !strings.Contains(errMsg, "not the order owner") {
		t.Errorf("expected 'not the order owner' in error, got %q", errMsg)
	}

	// Order must still be intact and cancellable by its real owner.
	bal := balances.Get(testSeller, testBase)
	if bal.Held != 100 {
		t.Fatalf("expected order still held after failed cancel, got held=%d", bal.Held)
	}
}

func TestCancelOrder_NotFound(t *testing.T) {
	e, _ := newTestEngine()
	errMsg := cancelOrderExpectErr(t, e, types.CancelOrderRequest{
		Sender: testSeller, OrderID: "ORD-does-not-exist",
	})
	if !strings.Contains(errMsg, "order not found") {
		t.Errorf("expected 'order not found' in error, got %q", errMsg)
	}
}
