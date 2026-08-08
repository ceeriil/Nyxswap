package vault

import (
	"crypto/ecdsa"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

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
