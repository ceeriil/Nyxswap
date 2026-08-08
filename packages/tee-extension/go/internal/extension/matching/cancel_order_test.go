package matching

import (
	"strings"
	"testing"

	"extension-scaffold/pkg/orderbook"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
)

func TestCancelOrder_ReleasesHold(t *testing.T) {
	pair := "FXRP/FLR"
	base := common.HexToAddress("0x1111111111111111111111111111111111111111")
	quote := common.HexToAddress("0x2222222222222222222222222222222222222222")
	e, balances := newTestEngine(pair, base, quote)

	seller := "0xaaaa000000000000000000000000000000000000"
	if err := balances.Deposit(seller, base, 100); err != nil {
		t.Fatal(err)
	}

	placed, err := e.PlaceOrder(types.PlaceOrderRequest{
		Sender: seller, Pair: pair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	})
	if err != nil {
		t.Fatal(err)
	}

	resp, err := e.CancelOrder(types.CancelOrderRequest{Sender: seller, OrderID: placed.OrderID})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Remaining != 100 {
		t.Fatalf("expected remaining=100, got %d", resp.Remaining)
	}

	bal := balances.Get(seller, base)
	if bal.Available != 100 || bal.Held != 0 {
		t.Fatalf("expected available=100 held=0 after cancel, got available=%d held=%d", bal.Available, bal.Held)
	}
	if n := e.TrackedOrderCount(); n != 0 {
		t.Errorf("expected no tracked orders after cancel, got %d", n)
	}
}

func TestCancelOrder_WrongOwnerRejected(t *testing.T) {
	pair := "FXRP/FLR"
	base := common.HexToAddress("0x1111111111111111111111111111111111111111")
	quote := common.HexToAddress("0x2222222222222222222222222222222222222222")
	e, balances := newTestEngine(pair, base, quote)

	owner := "0xaaaa000000000000000000000000000000000000"
	attacker := "0xffff000000000000000000000000000000000000"
	if err := balances.Deposit(owner, base, 100); err != nil {
		t.Fatal(err)
	}

	placed, err := e.PlaceOrder(types.PlaceOrderRequest{
		Sender: owner, Pair: pair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	})
	if err != nil {
		t.Fatal(err)
	}

	errMsg := cancelOrderExpectErr(t, e, types.CancelOrderRequest{Sender: attacker, OrderID: placed.OrderID})
	if !strings.Contains(errMsg, "not the order owner") {
		t.Errorf("expected 'not the order owner' in error, got %q", errMsg)
	}

	// Order must still be intact and cancellable by its real owner.
	bal := balances.Get(owner, base)
	if bal.Held != 100 {
		t.Fatalf("expected order still held after failed cancel, got held=%d", bal.Held)
	}
}

func TestCancelOrder_NotFound(t *testing.T) {
	e, _ := newTestEngine("FXRP/FLR", common.Address{1}, common.Address{2})
	errMsg := cancelOrderExpectErr(t, e, types.CancelOrderRequest{
		Sender: "0xaaaa000000000000000000000000000000000000", OrderID: "ORD-does-not-exist",
	})
	if !strings.Contains(errMsg, "order not found") {
		t.Errorf("expected 'order not found' in error, got %q", errMsg)
	}
}
