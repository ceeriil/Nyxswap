package vault

import (
	"crypto/ecdsa"
	"strings"
	"testing"

	"extension-scaffold/internal/extension/fsa"
	"extension-scaffold/internal/extension/history"
	"extension-scaffold/pkg/balance"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// Shared fixtures for vault package tests — reused across every test that
// doesn't care what the addresses actually are.
var (
	testSender   = common.HexToAddress("0xAAAA")
	testToken    = common.HexToAddress("0xBBBB")
	testTo       = common.HexToAddress("0xCCCC")
	testContract = common.HexToAddress("0xC0FFEE")
)

// newTestHandler builds a Handler with no signer and no configured
// instructionSender — for tests that never reach a signing or
// WithdrawRequest call.
func newTestHandler() *Handler {
	return New(balance.NewManager(), history.NewStore(), fsa.NewStore(), nil, common.Address{})
}

// newHandlerWithSigner builds a Handler around sign, with instructionSender
// left at the zero address — set h.instructionSender directly for tests
// that need WithdrawRequest's fsa.RequireBoundContract check to pass.
func newHandlerWithSigner(sign Signer) (*Handler, *balance.Manager) {
	balances := balance.NewManager()
	h := New(balances, history.NewStore(), fsa.NewStore(), sign, common.Address{})
	return h, balances
}

// ecdsaKey wraps a generated test key — a thin wrapper mainly so test call
// sites read as "a signer" rather than a bare *ecdsa.PrivateKey.
type ecdsaKey struct {
	key *ecdsa.PrivateKey
}

func newTestKey(t *testing.T) *ecdsaKey {
	t.Helper()
	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatal(err)
	}
	return &ecdsaKey{key: key}
}

// userKey mirrors the lowercased-hex convention balance.Manager,
// history.Store, and fsa.Store all key their maps by.
func userKey(addr common.Address) string {
	return strings.ToLower(addr.Hex())
}
