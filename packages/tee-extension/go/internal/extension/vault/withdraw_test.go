package vault

import (
	"errors"
	"math/big"
	"testing"

	"extension-scaffold/internal/extension/fsa"
	"extension-scaffold/internal/extension/history"
	"extension-scaffold/pkg/balance"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

func newHandlerWithSigner(sign Signer) (*Handler, *balance.Manager) {
	balances := balance.NewManager()
	h := New(balances, history.NewStore(), fsa.NewStore(), sign, common.Address{})
	return h, balances
}

func TestHandler_Withdraw_DebitsAndSigns(t *testing.T) {
	signCalls := 0
	h, balances := newHandlerWithSigner(func(message []byte) ([]byte, error) {
		signCalls++
		return []byte{9, 9, 9}, nil
	})

	sender := common.HexToAddress("0xAAAA")
	token := common.HexToAddress("0xBBBB")
	_ = balances.Deposit("0x000000000000000000000000000000000000aaaa", token, 1_000)

	resp, err := h.Withdraw(sender, token, 400, common.HexToAddress("0xCCCC"), common.HexToHash("0x01"))
	if err != nil {
		t.Fatal(err)
	}
	if signCalls != 1 {
		t.Fatalf("expected sign to be called once, got %d", signCalls)
	}
	if resp.Available != 600 {
		t.Fatalf("expected available 600, got %d", resp.Available)
	}
}

func TestHandler_Withdraw_InsufficientBalance(t *testing.T) {
	h := newTestHandler()
	_, err := h.Withdraw(common.HexToAddress("0xAAAA"), common.HexToAddress("0xBBBB"), 100, common.HexToAddress("0xCCCC"), common.Hash{1})
	if err == nil {
		t.Fatal("expected an error for insufficient balance")
	}
}

func TestHandler_Withdraw_SignFailureRollsBackBalance(t *testing.T) {
	wantErr := errors.New("sign server unreachable")
	h, balances := newHandlerWithSigner(func(message []byte) ([]byte, error) {
		return nil, wantErr
	})

	sender := common.HexToAddress("0xAAAA")
	token := common.HexToAddress("0xBBBB")
	user := "0x000000000000000000000000000000000000aaaa"
	_ = balances.Deposit(user, token, 1_000)

	_, err := h.Withdraw(sender, token, 400, common.HexToAddress("0xCCCC"), common.HexToHash("0x01"))
	if err == nil {
		t.Fatal("expected an error when signing fails")
	}

	bal := balances.Get(user, token)
	if bal.Available != 1_000 {
		t.Fatalf("expected balance rolled back to 1000, got %d", bal.Available)
	}
}

func TestPackWithdrawalMessage_Length(t *testing.T) {
	token := common.HexToAddress("0x1111")
	to := common.HexToAddress("0x2222")
	withdrawalID := common.HexToHash("0x03")

	msg := packWithdrawalMessage(token, 1_000, to, withdrawalID)
	if len(msg) != 104 {
		t.Fatalf("expected 104-byte packed message, got %d", len(msg))
	}
	if common.BytesToAddress(msg[0:20]) != token {
		t.Errorf("token mismatch: got %s", common.BytesToAddress(msg[0:20]))
	}
	amount := new(big.Int).SetBytes(msg[20:52])
	if amount.Uint64() != 1_000 {
		t.Errorf("amount mismatch: got %s", amount)
	}
	if common.BytesToAddress(msg[52:72]) != to {
		t.Errorf("to mismatch: got %s", common.BytesToAddress(msg[52:72]))
	}
	if common.BytesToHash(msg[72:104]) != withdrawalID {
		t.Errorf("withdrawalID mismatch: got %s", common.BytesToHash(msg[72:104]))
	}
}

func TestDecodeWithdrawMessage_RoundTrip(t *testing.T) {
	addrTy, _ := abi.NewType("address", "", nil)
	uint256Ty, _ := abi.NewType("uint256", "", nil)
	args := abi.Arguments{{Type: addrTy}, {Type: addrTy}, {Type: uint256Ty}, {Type: addrTy}}

	wantSender := common.HexToAddress("0xAAAA")
	wantToken := common.HexToAddress("0xBBBB")
	wantTo := common.HexToAddress("0xCCCC")
	var wantAmount uint64 = 7_500

	packed, err := args.Pack(wantSender, wantToken, new(big.Int).SetUint64(wantAmount), wantTo)
	if err != nil {
		t.Fatal(err)
	}

	sender, token, amount, to, err := DecodeWithdrawMessage(packed)
	if err != nil {
		t.Fatal(err)
	}
	if sender != wantSender || token != wantToken || amount != wantAmount || to != wantTo {
		t.Fatalf("round trip mismatch: got sender=%s token=%s amount=%d to=%s", sender, token, amount, to)
	}
}
