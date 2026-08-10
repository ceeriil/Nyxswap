package vault

import (
	"testing"

	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

// signWithdrawRequest builds and self-signs a WithdrawRequestPayload the way
// a real client (the account named by user) would: sign personal_sign over
// keccak256(canonical), matching fsa.RecoverSigner's expectations.
func signWithdrawRequest(t *testing.T, priv *ecdsaKey, contract, token, to common.Address, amount, nonce uint64) types.WithdrawRequestPayload {
	t.Helper()
	user := crypto.PubkeyToAddress(priv.key.PublicKey)

	canonical, err := types.CanonicalWithdrawRequestBytes(contract, user, token, to, amount, nonce)
	if err != nil {
		t.Fatal(err)
	}
	digest := accounts.TextHash(crypto.Keccak256(canonical))
	sig, err := crypto.Sign(digest, priv.key)
	if err != nil {
		t.Fatal(err)
	}

	return types.WithdrawRequestPayload{
		Contract:  contract,
		User:      user,
		Token:     token,
		To:        to,
		Amount:    amount,
		Nonce:     nonce,
		Signature: hexutil.Bytes(sig),
	}
}

func TestHandler_WithdrawRequest_SelfSigned(t *testing.T) {
	priv := newTestKey(t)

	signCalls := 0
	h, balances := newHandlerWithSigner(func(message []byte) ([]byte, error) {
		signCalls++
		return []byte{1, 2, 3}, nil
	})
	h.instructionSender = testContract

	user := crypto.PubkeyToAddress(priv.key.PublicKey)
	if err := balances.Deposit(userKey(user), testToken, 1_000); err != nil {
		t.Fatal(err)
	}

	req := signWithdrawRequest(t, priv, testContract, testToken, testTo, 400, 1)
	resp, err := h.WithdrawRequest(req, common.HexToHash("0x99"))
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

func TestHandler_WithdrawRequest_WrongContractRejected(t *testing.T) {
	priv := newTestKey(t)
	wrongContract := common.HexToAddress("0xBADBAD")

	h, _ := newHandlerWithSigner(func(message []byte) ([]byte, error) { return []byte{1}, nil })
	h.instructionSender = testContract

	req := signWithdrawRequest(t, priv, wrongContract, testToken, testTo, 100, 1)
	if _, err := h.WithdrawRequest(req, common.HexToHash("0x1")); err == nil {
		t.Fatal("expected an error for a request signed against the wrong contract")
	}
}

func TestHandler_WithdrawRequest_ReplayedNonceRejected(t *testing.T) {
	priv := newTestKey(t)

	h, balances := newHandlerWithSigner(func(message []byte) ([]byte, error) {
		return []byte{1}, nil
	})
	h.instructionSender = testContract

	user := crypto.PubkeyToAddress(priv.key.PublicKey)
	if err := balances.Deposit(userKey(user), testToken, 1_000); err != nil {
		t.Fatal(err)
	}

	req := signWithdrawRequest(t, priv, testContract, testToken, testTo, 100, 1)
	if _, err := h.WithdrawRequest(req, common.HexToHash("0x1")); err != nil {
		t.Fatalf("first request should succeed, got %v", err)
	}

	replay := signWithdrawRequest(t, priv, testContract, testToken, testTo, 100, 1) // same nonce
	if _, err := h.WithdrawRequest(replay, common.HexToHash("0x2")); err == nil {
		t.Fatal("expected the replayed nonce to be rejected")
	}
}

func TestHandler_WithdrawRequest_WrongSignerRejected(t *testing.T) {
	owner := newTestKey(t)
	impostor := newTestKey(t)

	h, _ := newHandlerWithSigner(func(message []byte) ([]byte, error) { return []byte{1}, nil })
	h.instructionSender = testContract

	// Sign as the impostor but claim to be the owner's address.
	req := signWithdrawRequest(t, impostor, testContract, testToken, testTo, 100, 1)
	req.User = crypto.PubkeyToAddress(owner.key.PublicKey)

	if _, err := h.WithdrawRequest(req, common.HexToHash("0x1")); err == nil {
		t.Fatal("expected an error when the signature doesn't match the claimed user")
	}
}
