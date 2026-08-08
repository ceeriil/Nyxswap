package vault

import (
	"math/big"
	"testing"

	"extension-scaffold/internal/extension/fsa"
	"extension-scaffold/internal/extension/history"
	"extension-scaffold/pkg/balance"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

func newTestHandler() *Handler {
	return New(balance.NewManager(), history.NewStore(), fsa.NewStore(), nil, common.Address{})
}

func TestHandler_Deposit_CreditsBalance(t *testing.T) {
	h := newTestHandler()
	sender := common.HexToAddress("0xAAAA")
	token := common.HexToAddress("0xBBBB")

	resp, err := h.Deposit(sender, token, 1_000)
	if err != nil {
		t.Fatal(err)
	}
	if resp.Available != 1_000 {
		t.Fatalf("expected available 1000, got %d", resp.Available)
	}

	bal := h.balances.Get("0x000000000000000000000000000000000000aaaa", token)
	if bal.Available != 1_000 {
		t.Fatalf("expected balance manager available 1000, got %d", bal.Available)
	}
}

func TestHandler_Deposit_ZeroAmount(t *testing.T) {
	h := newTestHandler()
	_, err := h.Deposit(common.HexToAddress("0xAAAA"), common.HexToAddress("0xBBBB"), 0)
	if err == nil {
		t.Fatal("expected an error for zero amount")
	}
}

func TestDecodeDepositMessage_RoundTrip(t *testing.T) {
	addrTy, _ := abi.NewType("address", "", nil)
	uint256Ty, _ := abi.NewType("uint256", "", nil)
	args := abi.Arguments{{Type: addrTy}, {Type: addrTy}, {Type: uint256Ty}}

	wantSender := common.HexToAddress("0xAAAA")
	wantToken := common.HexToAddress("0xBBBB")
	var wantAmount uint64 = 42_000

	packed, err := args.Pack(wantSender, wantToken, new(big.Int).SetUint64(wantAmount))
	if err != nil {
		t.Fatal(err)
	}

	sender, token, amount, err := DecodeDepositMessage(packed)
	if err != nil {
		t.Fatal(err)
	}
	if sender != wantSender || token != wantToken || amount != wantAmount {
		t.Fatalf("round trip mismatch: got sender=%s token=%s amount=%d", sender, token, amount)
	}
}
