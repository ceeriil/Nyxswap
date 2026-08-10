package vault

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi"
)

func TestHandler_Deposit_CreditsBalance(t *testing.T) {
	h := newTestHandler()

	resp, err := h.Deposit(testSender, testToken, 1_000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.Available != 1_000 {
		t.Fatalf("expected available 1000, got %d", resp.Available)
	}

	bal := h.balances.Get(userKey(testSender), testToken)
	if bal.Available != 1_000 {
		t.Fatalf("expected balance manager available 1000, got %d", bal.Available)
	}
}

func TestHandler_Deposit_ZeroAmount(t *testing.T) {
	h := newTestHandler()
	_, err := h.Deposit(testSender, testToken, 0)
	if err == nil {
		t.Fatal("expected an error for zero amount")
	}
}

func TestDecodeDepositMessage_RoundTrip(t *testing.T) {
	addrTy, _ := abi.NewType("address", "", nil)
	uint256Ty, _ := abi.NewType("uint256", "", nil)
	args := abi.Arguments{{Type: addrTy}, {Type: addrTy}, {Type: uint256Ty}}

	var wantAmount uint64 = 42_000

	packed, err := args.Pack(testSender, testToken, new(big.Int).SetUint64(wantAmount))
	if err != nil {
		t.Fatal(err)
	}

	sender, token, amount, err := DecodeDepositMessage(packed)
	if err != nil {
		t.Fatal(err)
	}
	if sender != testSender || token != testToken || amount != wantAmount {
		t.Fatalf("round trip mismatch: got sender=%s token=%s amount=%d", sender, token, amount)
	}
}
