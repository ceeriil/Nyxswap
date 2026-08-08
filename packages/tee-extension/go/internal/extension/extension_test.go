package extension

import (
	"encoding/json"
	"strings"
	"testing"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/balance"
	"extension-scaffold/pkg/orderbook"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
)

// newTestExtension builds a minimal Extension wired up for one trading pair, with no HTTP server.
func newTestExtension(pair string, base, quote common.Address) *Extension {
	pairCfg := config.TradingPairConfig{Name: pair, BaseToken: base, QuoteToken: quote}
	return &Extension{
		orderbooks: map[string]*orderbook.OrderBook{pair: orderbook.NewOrderBook(pair)},
		balances:   balance.NewManager(),
		pairs:      map[string]config.TradingPairConfig{pair: pairCfg},
		orders:     make(map[string]string),
		userOrders: make(map[string][]string),
	}
}

// placeOrder is a thin test-only invocation of processPlaceOrder that returns the parsed response.
func placeOrder(t *testing.T, e *Extension, req types.PlaceOrderRequest) types.PlaceOrderResponse {
	t.Helper()
	body, err := json.Marshal(req)
	if err != nil {
		t.Fatal(err)
	}
	ar := e.processPlaceOrder(teetypes.Action{}, &instruction.DataFixed{}, body)
	if ar.Status != 1 {
		t.Fatalf("place order failed: %s", ar.Log)
	}
	var resp types.PlaceOrderResponse
	if err := json.Unmarshal(ar.Data, &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return resp
}

// placeOrderExpectErr returns the action log expecting Status=0 (error).
func placeOrderExpectErr(t *testing.T, e *Extension, req types.PlaceOrderRequest) string {
	t.Helper()
	body, _ := json.Marshal(req)
	ar := e.processPlaceOrder(teetypes.Action{}, &instruction.DataFixed{}, body)
	if ar.Status == 1 {
		t.Fatalf("expected error, got success: data=%s", string(ar.Data))
	}
	return ar.Log
}

func cancelOrder(t *testing.T, e *Extension, req types.CancelOrderRequest) types.CancelOrderResponse {
	t.Helper()
	body, _ := json.Marshal(req)
	ar := e.processCancelOrder(teetypes.Action{}, &instruction.DataFixed{}, body)
	if ar.Status != 1 {
		t.Fatalf("cancel order failed: %s", ar.Log)
	}
	var resp types.CancelOrderResponse
	if err := json.Unmarshal(ar.Data, &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return resp
}

func cancelOrderExpectErr(t *testing.T, e *Extension, req types.CancelOrderRequest) string {
	t.Helper()
	body, _ := json.Marshal(req)
	ar := e.processCancelOrder(teetypes.Action{}, &instruction.DataFixed{}, body)
	if ar.Status == 1 {
		t.Fatalf("expected error, got success: data=%s", string(ar.Data))
	}
	return ar.Log
}

// Dispatch-level tests (processAction -> processDirect, exercising the real
// teetypes.DirectInstruction JSON wire shape) are deliberately not included
// here — this sandbox has no Go toolchain to verify the wire format against,
// and guessing at struct tags for a test I can't run isn't worth the risk of
// a silently-wrong test. processPlaceOrder/processCancelOrder are exercised
// directly below instead, same as the reference implementation's own tests
// do, which sidesteps that dependency entirely.

// --- PLACE_ORDER ---

func TestPlaceOrder_RestsWhenNoMatch(t *testing.T) {
	pair := "FXRP/FLR"
	base := common.HexToAddress("0x1111111111111111111111111111111111111111")
	quote := common.HexToAddress("0x2222222222222222222222222222222222222222")
	e := newTestExtension(pair, base, quote)

	seller := "0xaaaa000000000000000000000000000000000000"
	if err := e.balances.Deposit(seller, base, 1_000); err != nil {
		t.Fatal(err)
	}

	resp := placeOrder(t, e, types.PlaceOrderRequest{
		Sender: seller, Pair: pair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100, // price=2.0 (pricePrecision=1e6)
	})

	if resp.Status != "resting" {
		t.Fatalf("expected status 'resting', got %q", resp.Status)
	}
	if resp.Remaining != 100 {
		t.Fatalf("expected remaining=100, got %d", resp.Remaining)
	}

	bal := e.balances.Get(seller, base)
	if bal.Available != 900 || bal.Held != 100 {
		t.Fatalf("expected available=900 held=100, got available=%d held=%d", bal.Available, bal.Held)
	}
}

func TestPlaceOrder_MatchesAndSettles(t *testing.T) {
	pair := "FXRP/FLR"
	base := common.HexToAddress("0x1111111111111111111111111111111111111111")
	quote := common.HexToAddress("0x2222222222222222222222222222222222222222")
	e := newTestExtension(pair, base, quote)

	seller := "0xaaaa000000000000000000000000000000000000"
	buyer := "0xbbbb000000000000000000000000000000000000"
	if err := e.balances.Deposit(seller, base, 100); err != nil {
		t.Fatal(err)
	}
	// price 2.0 * qty 100 = 200 quote.
	if err := e.balances.Deposit(buyer, quote, 200); err != nil {
		t.Fatal(err)
	}

	placeOrder(t, e, types.PlaceOrderRequest{
		Sender: seller, Pair: pair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	})
	resp := placeOrder(t, e, types.PlaceOrderRequest{
		Sender: buyer, Pair: pair, Side: orderbook.Buy,
		Price: 2_000_000, Quantity: 100,
	})

	if resp.Status != "filled" {
		t.Fatalf("expected status 'filled', got %q", resp.Status)
	}
	if len(resp.Matches) != 1 || resp.Matches[0].Quantity != 100 {
		t.Fatalf("expected one match of qty 100, got %+v", resp.Matches)
	}

	sellerBase := e.balances.Get(seller, base)
	sellerQuote := e.balances.Get(seller, quote)
	buyerBase := e.balances.Get(buyer, base)
	buyerQuote := e.balances.Get(buyer, quote)

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
	if len(e.orders) != 0 {
		t.Errorf("expected no tracked orders after full fill, got %v", e.orders)
	}
}

func TestPlaceOrder_InsufficientBalance(t *testing.T) {
	pair := "FXRP/FLR"
	base := common.HexToAddress("0x1111111111111111111111111111111111111111")
	quote := common.HexToAddress("0x2222222222222222222222222222222222222222")
	e := newTestExtension(pair, base, quote)

	seller := "0xaaaa000000000000000000000000000000000000"
	// No deposit at all.

	log := placeOrderExpectErr(t, e, types.PlaceOrderRequest{
		Sender: seller, Pair: pair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	})
	if !strings.Contains(log, "insufficient balance") {
		t.Errorf("expected 'insufficient balance' in log, got %q", log)
	}
}

func TestPlaceOrder_UnknownPair(t *testing.T) {
	e := newTestExtension("FXRP/FLR", common.Address{1}, common.Address{2})
	log := placeOrderExpectErr(t, e, types.PlaceOrderRequest{
		Sender: "0xaaaa000000000000000000000000000000000000", Pair: "NOPE/NOPE",
		Side: orderbook.Sell, Price: 1_000_000, Quantity: 1,
	})
	if !strings.Contains(log, "unknown trading pair") {
		t.Errorf("expected 'unknown trading pair' in log, got %q", log)
	}
}

// --- CANCEL_ORDER ---

func TestCancelOrder_ReleasesHold(t *testing.T) {
	pair := "FXRP/FLR"
	base := common.HexToAddress("0x1111111111111111111111111111111111111111")
	quote := common.HexToAddress("0x2222222222222222222222222222222222222222")
	e := newTestExtension(pair, base, quote)

	seller := "0xaaaa000000000000000000000000000000000000"
	if err := e.balances.Deposit(seller, base, 100); err != nil {
		t.Fatal(err)
	}

	placed := placeOrder(t, e, types.PlaceOrderRequest{
		Sender: seller, Pair: pair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	})

	resp := cancelOrder(t, e, types.CancelOrderRequest{Sender: seller, OrderID: placed.OrderID})
	if resp.Remaining != 100 {
		t.Fatalf("expected remaining=100, got %d", resp.Remaining)
	}

	bal := e.balances.Get(seller, base)
	if bal.Available != 100 || bal.Held != 0 {
		t.Fatalf("expected available=100 held=0 after cancel, got available=%d held=%d", bal.Available, bal.Held)
	}
	if len(e.orders) != 0 {
		t.Errorf("expected no tracked orders after cancel, got %v", e.orders)
	}
}

func TestCancelOrder_WrongOwnerRejected(t *testing.T) {
	pair := "FXRP/FLR"
	base := common.HexToAddress("0x1111111111111111111111111111111111111111")
	quote := common.HexToAddress("0x2222222222222222222222222222222222222222")
	e := newTestExtension(pair, base, quote)

	owner := "0xaaaa000000000000000000000000000000000000"
	attacker := "0xffff000000000000000000000000000000000000"
	if err := e.balances.Deposit(owner, base, 100); err != nil {
		t.Fatal(err)
	}

	placed := placeOrder(t, e, types.PlaceOrderRequest{
		Sender: owner, Pair: pair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	})

	log := cancelOrderExpectErr(t, e, types.CancelOrderRequest{Sender: attacker, OrderID: placed.OrderID})
	if !strings.Contains(log, "not the order owner") {
		t.Errorf("expected 'not the order owner' in log, got %q", log)
	}

	// Order must still be intact and cancellable by its real owner.
	bal := e.balances.Get(owner, base)
	if bal.Held != 100 {
		t.Fatalf("expected order still held after failed cancel, got held=%d", bal.Held)
	}
}

func TestCancelOrder_NotFound(t *testing.T) {
	e := newTestExtension("FXRP/FLR", common.Address{1}, common.Address{2})
	log := cancelOrderExpectErr(t, e, types.CancelOrderRequest{
		Sender: "0xaaaa000000000000000000000000000000000000", OrderID: "ORD-does-not-exist",
	})
	if !strings.Contains(log, "order not found") {
		t.Errorf("expected 'order not found' in log, got %q", log)
	}
}
