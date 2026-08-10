package poolfallback

import (
	"context"
	"errors"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
)

// testVault/testPool are shared across the Try-related tests below, which
// don't care what the addresses actually are.
var (
	testVault = common.HexToAddress("0xAAAA")
	testPool  = common.HexToAddress("0xBBBB")
)

type stubReader struct {
	reserveA, reserveB *big.Int
	err                error
}

func (s stubReader) Reserves(_ context.Context, _ common.Address) (*big.Int, *big.Int, error) {
	return s.reserveA, s.reserveB, s.err
}

func TestPackFillMessage_Length(t *testing.T) {
	vault := common.HexToAddress("0x1111111111111111111111111111111111111111")
	pool := common.HexToAddress("0x2222222222222222222222222222222222222222")
	fillID := deriveFillID("ORD-test-1")

	msg := packFillMessage(vault, fillID, pool, true, 1_000, 500)
	if len(msg) != 137 {
		t.Fatalf("expected 137-byte packed message, got %d", len(msg))
	}
	if common.BytesToAddress(msg[0:20]) != vault {
		t.Errorf("vault mismatch: got %s", common.BytesToAddress(msg[0:20]))
	}
	if common.BytesToHash(msg[20:52]) != fillID {
		t.Errorf("fillID mismatch: got %s", common.BytesToHash(msg[20:52]))
	}
	if common.BytesToAddress(msg[52:72]) != pool {
		t.Errorf("pool mismatch: got %s", common.BytesToAddress(msg[52:72]))
	}
	if msg[72] != 1 {
		t.Errorf("expected aToB byte = 1, got %d", msg[72])
	}
	amountIn := new(big.Int).SetBytes(msg[73:105])
	if amountIn.Uint64() != 1_000 {
		t.Errorf("amountIn mismatch: got %s", amountIn)
	}
	minAmountOut := new(big.Int).SetBytes(msg[105:137])
	if minAmountOut.Uint64() != 500 {
		t.Errorf("minAmountOut mismatch: got %s", minAmountOut)
	}
}

func TestDeriveFillID_DeterministicPerSeed(t *testing.T) {
	a := deriveFillID("ORD-1")
	b := deriveFillID("ORD-1")
	c := deriveFillID("ORD-2")
	if a != b {
		t.Fatal("expected same seed to produce the same fillID")
	}
	if a == c {
		t.Fatal("expected different seeds to produce different fillIDs")
	}
}

func TestNew_NilReader(t *testing.T) {
	if f := New(nil, common.Address{}, nil); f != nil {
		t.Fatalf("expected nil Fallback for nil reader, got %+v", f)
	}
}

func TestTry_Favorable(t *testing.T) {
	signCalls := 0
	f := &Fallback{
		reader: stubReader{reserveA: big.NewInt(1_000_000), reserveB: big.NewInt(2_000_000)},
		vault:  testVault,
		sign: func(message []byte) ([]byte, error) {
			signCalls++
			return []byte{1, 2, 3}, nil
		},
	}

	resp, err := f.Try(context.Background(), testPool, true, 10_000, 1, "order-1")
	if err != nil {
		t.Fatal(err)
	}
	if resp == nil {
		t.Fatal("expected a fill response")
	}
	if signCalls != 1 {
		t.Fatalf("expected sign to be called once, got %d", signCalls)
	}
	if resp.AmountIn != 10_000 {
		t.Errorf("expected amountIn 10000, got %d", resp.AmountIn)
	}
	if resp.AmountOut < resp.MinAmountOut {
		t.Errorf("amountOut %d below minAmountOut %d", resp.AmountOut, resp.MinAmountOut)
	}
}

func TestTry_NotFavorable(t *testing.T) {
	signCalled := false
	f := &Fallback{
		reader: stubReader{reserveA: big.NewInt(100), reserveB: big.NewInt(100)},
		vault:  testVault,
		sign: func(message []byte) ([]byte, error) {
			signCalled = true
			return nil, nil
		},
	}

	// Asking for far more out than these thin reserves could ever quote.
	resp, err := f.Try(context.Background(), testPool, true, 10_000, 1_000_000, "order-2")
	if err != nil {
		t.Fatal(err)
	}
	if resp != nil {
		t.Fatalf("expected nil (not favorable), got %+v", resp)
	}
	if signCalled {
		t.Error("sign should not be called when the pool price isn't favorable")
	}
}

func TestTry_VaultNotConfigured(t *testing.T) {
	f := &Fallback{
		reader: stubReader{reserveA: big.NewInt(1_000_000), reserveB: big.NewInt(2_000_000)},
		vault:  common.Address{}, // zero address: never configured
		sign:   func(message []byte) ([]byte, error) { return []byte{1}, nil },
	}

	_, err := f.Try(context.Background(), testPool, true, 10_000, 1, "order-1")
	if err == nil {
		t.Fatal("expected an error when the vault address isn't configured")
	}
}

func TestTry_ReaderError(t *testing.T) {
	wantErr := errors.New("rpc down")
	f := &Fallback{
		reader: stubReader{err: wantErr},
		vault:  testVault,
		sign:   func(message []byte) ([]byte, error) { return nil, nil },
	}

	_, err := f.Try(context.Background(), testPool, true, 10, 1, "order-3")
	if err == nil {
		t.Fatal("expected an error when the reserve read fails")
	}
}
