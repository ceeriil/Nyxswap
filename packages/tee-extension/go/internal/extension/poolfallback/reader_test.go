package poolfallback

import (
	"math/big"
	"testing"
)

// TestQuoteSwap_MatchesPoolMath checks quoteSwap against a hand-computed
// value for NyxSwapPool.sol's exact formula: amountOut = reserveOut *
// (amountIn * (10000-30) / 10000) / (reserveIn + amountInWithFee).
func TestQuoteSwap_MatchesPoolMath(t *testing.T) {
	reserveIn := big.NewInt(1_000_000)
	reserveOut := big.NewInt(2_000_000)
	amountIn := big.NewInt(10_000)

	amountInWithFee := big.NewInt(10_000 * 9970 / 10000) // 9970
	want := new(big.Int).Mul(reserveOut, amountInWithFee)
	want.Div(want, new(big.Int).Add(reserveIn, amountInWithFee))

	got := quoteSwap(reserveIn, reserveOut, amountIn)
	if got.Cmp(want) != 0 {
		t.Fatalf("quoteSwap: expected %s, got %s", want, got)
	}
}

func TestQuoteSwap_ZeroReserves(t *testing.T) {
	got := quoteSwap(big.NewInt(0), big.NewInt(0), big.NewInt(100))
	if got.Sign() != 0 {
		t.Fatalf("expected 0 for zero reserves, got %s", got)
	}
}
