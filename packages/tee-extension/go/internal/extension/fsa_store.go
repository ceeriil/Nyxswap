package extension

import (
	"strings"
	"sync"
)

// EncPubLen is the length of an uncompressed secp256k1 public key (0x04 || X || Y).
const EncPubLen = 65

// fsaStore holds session-key bindings and per-user replay nonces for FSA
// (gasless account) users. In-memory only, like the rest of the TEE state
// that isn't balances: a lost binding is recovered with one free re-bind,
// so persistence isn't worth the surface.
//
// Nothing populates bindings yet — see fsa.go's doc comment. Until a
// BIND_SESSION_SIG handler exists, GetBinding always returns (nil, false),
// which is a safe default: WITHDRAW_REQUEST's authorization check then falls
// back to "the signer must be the user themselves," never silently trusting
// an unbound session key.
type fsaStore struct {
	mu       sync.RWMutex
	bindings map[string][]byte // user (lowercased hex) -> 65-byte uncompressed session pubkey
	nonces   map[string]uint64 // user -> last-seen monotonic nonce
}

func newFsaStore() *fsaStore {
	return &fsaStore{
		bindings: make(map[string][]byte),
		nonces:   make(map[string]uint64),
	}
}

// GetBinding returns a copy of the user's bound session pubkey and whether a
// binding exists. The user key is case-insensitive.
func (s *fsaStore) GetBinding(user string) ([]byte, bool) {
	user = strings.ToLower(user)
	s.mu.RLock()
	defer s.mu.RUnlock()
	pub, ok := s.bindings[user]
	if !ok {
		return nil, false
	}
	return append([]byte(nil), pub...), true
}

// SetBinding upserts the user -> sessionPub mapping. Re-binding silently
// overwrites the previous value — that's the rotation path. Caller validates
// the key shape. Currently unused (no BIND_SESSION_SIG handler calls it
// yet) — kept so fsaStore's API is complete for whoever builds that next.
func (s *fsaStore) SetBinding(user string, sessionPub []byte) {
	user = strings.ToLower(user)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bindings[user] = append([]byte(nil), sessionPub...)
}

// CheckAndAdvanceNonce returns true iff nonce is strictly greater than the
// last seen for user; updates the stored nonce on success. Replay protection
// for signed direct ops.
func (s *fsaStore) CheckAndAdvanceNonce(user string, nonce uint64) bool {
	user = strings.ToLower(user)
	s.mu.Lock()
	defer s.mu.Unlock()
	if nonce <= s.nonces[user] {
		return false
	}
	s.nonces[user] = nonce
	return true
}
