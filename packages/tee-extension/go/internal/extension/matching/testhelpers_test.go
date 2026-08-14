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
// fallback and no reader (spot pricing falls back to each request's own
// MinAcceptablePrice — see swap.go's startPriceFor).
func newTestEngine() (*Engine, *balance.Manager) {
	pairs := map[string]config.TradingPairConfig{
		testPair: {Name: testPair, BaseToken: testBase, QuoteToken: testQuote},
	}
	balances := balance.NewManager()
	return New(pairs, balances, nil, nil), balances
}

func swapExpectErr(t *testing.T, e *Engine, req types.SwapRequest) string {
	t.Helper()
	_, err := e.Swap(req)
	if err == nil {
		t.Fatal("expected an error, got success")
	}
	return err.Error()
}

func cancelSwapExpectErr(t *testing.T, e *Engine, req types.CancelSwapRequest) string {
	t.Helper()
	_, err := e.CancelSwap(req)
	if err == nil {
		t.Fatal("expected an error, got success")
	}
	return err.Error()
}
