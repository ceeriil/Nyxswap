package matching

import (
	"testing"
	"time"

	"extension-scaffold/pkg/auction"

	"github.com/ethereum/go-ethereum/common"
)

// TestTryPoolFill_NoPoolConfigured confirms the fallback is a graceful no-op
// (nil, nil) — not an error — when a pair has no pool address, the normal
// case for any pair that hasn't opted into pool fallback.
func TestTryPoolFill_NoPoolConfigured(t *testing.T) {
	e, _ := newTestEngine()
	pairCfg := e.pairs[testPair] // PoolAddress left zero
	now := time.Now()

	order := &auction.Order{
		ID: "ORD-1", Owner: testSeller, Pair: testPair,
		Side: auction.Sell, Quantity: 100, Remaining: 100,
		StartPrice: 2_000_000, FloorPrice: 2_000_000,
		SubmittedAt: now, Duration: time.Minute,
	}

	fill, err := e.tryPoolFill(pairCfg, order, now)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if fill != nil {
		t.Fatalf("expected nil fill with no pool configured, got %+v", fill)
	}
}

// TestTryPoolFill_NoFallbackConfigured confirms the same graceful no-op
// when a pool IS configured but this Engine has no poolFallback wired up
// (e.g. CHAIN_URL unset). Pool fallback degrades to "just leave it live",
// never a hard failure.
func TestTryPoolFill_NoFallbackConfigured(t *testing.T) {
	e, _ := newTestEngine()
	pairCfg := e.pairs[testPair]
	pairCfg.PoolAddress = common.HexToAddress("0x33")
	e.pairs[testPair] = pairCfg
	now := time.Now()

	order := &auction.Order{
		ID: "ORD-2", Owner: testSeller, Pair: testPair,
		Side: auction.Sell, Quantity: 100, Remaining: 100,
		StartPrice: 2_000_000, FloorPrice: 2_000_000,
		SubmittedAt: now, Duration: time.Minute,
	}

	fill, err := e.tryPoolFill(pairCfg, order, now)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if fill != nil {
		t.Fatalf("expected nil fill with no pool fallback configured, got %+v", fill)
	}
}
