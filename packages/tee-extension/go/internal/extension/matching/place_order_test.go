package matching

import (
	"strings"
	"testing"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/balance"
	"extension-scaffold/pkg/orderbook"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
)

// newTestEngine builds a minimal Engine wired up for one trading pair, with
// no pool fallback.
func newTestEngine(pair string, base, quote common.Address) (*Engine, *balance.Manager) {
	pairs := map[string]config.TradingPairConfig{
		pair: {Name: pair, BaseToken: base, QuoteToken: quote},
	}
	balances := balance.NewManager()
	return New(pairs, balances, nil), balances
}

func placeOrderExpectErr(t *testing.T, e *Engine, req types.PlaceOrderRequest) string {
	t.Helper()
	_, err := e.PlaceOrder(req)
	if err == nil {
		t.Fatal("expected an error, got success")
	}
	return err.Error()
}

func cancelOrderExpectErr(t *testing.T, e *Engine, req types.CancelOrderRequest) string {
	t.Helper()
	_, err := e.CancelOrder(req)
	if err == nil {
		t.Fatal("expected an error, got success")
	}
	return err.Error()
}

func TestPlaceOrder_RestsWhenNoMatch(t *testing.T) {
	pair := "FXRP/FLR"
	base := common.HexToAddress("0x1111111111111111111111111111111111111111")
	quote := common.HexToAddress("0x2222222222222222222222222222222222222222")
	e, balances := newTestEngine(pair, base, quote)

	seller := "0xaaaa000000000000000000000000000000000000"
	if err := balances.Deposit(seller, base, 1_000); err != nil {
		t.Fatal(err)
	}

	resp, err := e.PlaceOrder(types.PlaceOrderRequest{
		Sender: seller, Pair: pair, Side: orderbook.Sell,
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

	bal := balances.Get(seller, base)
	if bal.Available != 900 || bal.Held != 100 {
		t.Fatalf("expected available=900 held=100, got available=%d held=%d", bal.Available, bal.Held)
	}
}

func TestPlaceOrder_MatchesAndSettles(t *testing.T) {
	pair := "FXRP/FLR"
	base := common.HexToAddress("0x1111111111111111111111111111111111111111")
	quote := common.HexToAddress("0x2222222222222222222222222222222222222222")
	e, balances := newTestEngine(pair, base, quote)

	seller := "0xaaaa000000000000000000000000000000000000"
	buyer := "0xbbbb000000000000000000000000000000000000"
	if err := balances.Deposit(seller, base, 100); err != nil {
		t.Fatal(err)
	}
	// price 2.0 * qty 100 = 200 quote.
	if err := balances.Deposit(buyer, quote, 200); err != nil {
		t.Fatal(err)
	}

	if _, err := e.PlaceOrder(types.PlaceOrderRequest{
		Sender: seller, Pair: pair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	}); err != nil {
		t.Fatal(err)
	}
	resp, err := e.PlaceOrder(types.PlaceOrderRequest{
		Sender: buyer, Pair: pair, Side: orderbook.Buy,
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

	sellerBase := balances.Get(seller, base)
	sellerQuote := balances.Get(seller, quote)
	buyerBase := balances.Get(buyer, base)
	buyerQuote := balances.Get(buyer, quote)

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
	pair := "FXRP/FLR"
	base := common.HexToAddress("0x1111111111111111111111111111111111111111")
	quote := common.HexToAddress("0x2222222222222222222222222222222222222222")
	e, _ := newTestEngine(pair, base, quote)

	seller := "0xaaaa000000000000000000000000000000000000"
	// No deposit at all.

	errMsg := placeOrderExpectErr(t, e, types.PlaceOrderRequest{
		Sender: seller, Pair: pair, Side: orderbook.Sell,
		Price: 2_000_000, Quantity: 100,
	})
	if !strings.Contains(errMsg, "insufficient balance") {
		t.Errorf("expected 'insufficient balance' in error, got %q", errMsg)
	}
}

func TestPlaceOrder_UnknownPair(t *testing.T) {
	e, _ := newTestEngine("FXRP/FLR", common.Address{1}, common.Address{2})
	errMsg := placeOrderExpectErr(t, e, types.PlaceOrderRequest{
		Sender: "0xaaaa000000000000000000000000000000000000", Pair: "NOPE/NOPE",
		Side: orderbook.Sell, Price: 1_000_000, Quantity: 1,
	})
	if !strings.Contains(errMsg, "unknown trading pair") {
		t.Errorf("expected 'unknown trading pair' in error, got %q", errMsg)
	}
}
