package matching

import (
	"testing"

	"extension-scaffold/pkg/orderbook"

	"github.com/ethereum/go-ethereum/common"
)

// TestTryPoolFill_NoPoolConfigured confirms the fallback is a graceful no-op
// (nil, nil) — not an error — when a pair has no pool address, the normal
// case for any pair that hasn't opted into pool fallback.
func TestTryPoolFill_NoPoolConfigured(t *testing.T) {
	e, _ := newTestEngine("FXRP/FLR", common.HexToAddress("0x11"), common.HexToAddress("0x22"))
	pairCfg := e.pairs["FXRP/FLR"] // PoolAddress left zero

	order := &orderbook.Order{
		ID: "ORD-1", Owner: "seller", Pair: "FXRP/FLR",
		Side: orderbook.Sell, Price: 2_000_000, Quantity: 100, Remaining: 100,
	}

	fill, err := e.tryPoolFill(pairCfg, order)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if fill != nil {
		t.Fatalf("expected nil fill with no pool configured, got %+v", fill)
	}
}

// TestTryPoolFill_NoFallbackConfigured confirms the same graceful no-op
// when a pool IS configured but this Engine has no poolFallback wired up
// (e.g. CHAIN_URL unset). Pool fallback degrades to "just rest it", never a
// hard failure.
func TestTryPoolFill_NoFallbackConfigured(t *testing.T) {
	e, _ := newTestEngine("FXRP/FLR", common.HexToAddress("0x11"), common.HexToAddress("0x22"))
	pairCfg := e.pairs["FXRP/FLR"]
	pairCfg.PoolAddress = common.HexToAddress("0x33")
	e.pairs["FXRP/FLR"] = pairCfg

	order := &orderbook.Order{
		ID: "ORD-2", Owner: "seller", Pair: "FXRP/FLR",
		Side: orderbook.Sell, Price: 2_000_000, Quantity: 100, Remaining: 100,
	}

	fill, err := e.tryPoolFill(pairCfg, order)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if fill != nil {
		t.Fatalf("expected nil fill with no pool fallback configured, got %+v", fill)
	}
}
