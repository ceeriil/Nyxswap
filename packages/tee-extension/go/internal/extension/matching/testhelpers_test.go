package matching

import (
	"testing"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/balance"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
)

// Shared fixtures for matching package tests — one trading pair and a
// handful of addresses reused across every test that doesn't care what
// they actually are.
var (
	testPair  = "FXRP/FLR"
	testBase  = common.HexToAddress("0x1111111111111111111111111111111111111111")
	testQuote = common.HexToAddress("0x2222222222222222222222222222222222222222")

	testSeller   = "0xaaaa000000000000000000000000000000000000"
	testBuyer    = "0xbbbb000000000000000000000000000000000000"
	testAttacker = "0xffff000000000000000000000000000000000000"
)

// newTestEngine builds a minimal Engine wired up for testPair, with no pool
// fallback.
func newTestEngine() (*Engine, *balance.Manager) {
	pairs := map[string]config.TradingPairConfig{
		testPair: {Name: testPair, BaseToken: testBase, QuoteToken: testQuote},
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
