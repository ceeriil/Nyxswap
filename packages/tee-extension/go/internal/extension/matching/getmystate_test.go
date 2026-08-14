package matching

import (
	"crypto/ecdsa"
	"strings"
	"testing"
	"time"

	"extension-scaffold/pkg/auction"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/crypto"
)

// generateTestKey returns a fresh throwaway ECDSA key for signing test
// requests — never used for anything real.
func generateTestKey(t *testing.T) *ecdsa.PrivateKey {
	t.Helper()
	priv, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("crypto.GenerateKey: %v", err)
	}
	return priv
}

// signGetMyState produces a valid GetMyStateRequest signature for user,
// matching fsa.RecoverSigner's expected encoding exactly (personal_sign
// over keccak256(canonical)).
func signGetMyState(t *testing.T, priv *ecdsa.PrivateKey, timestamp int64) []byte {
	t.Helper()
	userAddr := crypto.PubkeyToAddress(priv.PublicKey)
	canonical, err := types.CanonicalGetMyStateBytes(userAddr, timestamp)
	if err != nil {
		t.Fatalf("CanonicalGetMyStateBytes: %v", err)
	}
	digest := accounts.TextHash(crypto.Keccak256(canonical))
	sig, err := crypto.Sign(digest, priv)
	if err != nil {
		t.Fatalf("crypto.Sign: %v", err)
	}
	return sig
}

func TestGetMyState_ReturnsLiveAndResolvedOrdersForCaller(t *testing.T) {
	priv := generateTestKey(t)
	userAddr := crypto.PubkeyToAddress(priv.PublicKey)
	// Swap()/CancelSwap() lowercase Sender before using it as the balance
	// ledger's key — fund and submit under that same lowercased form, or
	// this and Deposit() land in different map entries.
	user := strings.ToLower(userAddr.Hex())

	e, balances := newTestEngine()
	fundAndHold(t, e, balances, user, testQuote, 1_000_000)
	fundAndHold(t, e, balances, user, testBase, 1_000)

	// Floors deliberately don't overlap (buy caps at 800_000, sell floors at
	// 900_000) so Cross() never touches either — keeps this test isolated
	// to the expiry path, not peer-to-peer matching (already covered by
	// TestResolveOnce_CrossesTwoLiveOrdersAndSettlesBalances).
	liveResp, err := e.Swap(types.SwapRequest{
		Sender: user, Pair: testPair, Side: auction.Buy,
		Quantity: 50, MinAcceptablePrice: 800_000,
	})
	if err != nil {
		t.Fatalf("Swap (live): %v", err)
	}
	// Long-lived on purpose, so it's still live at the timestamp below.
	e.books[testPair].Get(liveResp.OrderID).Duration = time.Hour

	resolvedResp, err := e.Swap(types.SwapRequest{
		Sender: user, Pair: testPair, Side: auction.Sell,
		Quantity: 10, MinAcceptablePrice: 900_000,
	})
	if err != nil {
		t.Fatalf("Swap (to be expired): %v", err)
	}
	order := e.books[testPair].Get(resolvedResp.OrderID)
	e.resolveOnce(order.SubmittedAt.Add(order.Duration + time.Second))

	timestamp := time.Now().Unix()
	sig := signGetMyState(t, priv, timestamp)

	resp, err := e.GetMyState(types.GetMyStateRequest{User: user, Timestamp: timestamp, Signature: sig})
	if err != nil {
		t.Fatalf("GetMyState: %v", err)
	}

	if len(resp.LiveOrders) != 1 || resp.LiveOrders[0].OrderID != liveResp.OrderID {
		t.Fatalf("expected 1 live order matching %s, got %+v", liveResp.OrderID, resp.LiveOrders)
	}
	if len(resp.Resolved) != 1 || resp.Resolved[0].OrderID != resolvedResp.OrderID {
		t.Fatalf("expected 1 resolved order matching %s, got %+v", resolvedResp.OrderID, resp.Resolved)
	}
	if resp.Resolved[0].Status != "expired" {
		t.Fatalf("expected resolved status expired, got %s", resp.Resolved[0].Status)
	}
}

func TestGetMyState_RejectsWrongSigner(t *testing.T) {
	priv := generateTestKey(t)
	other := generateTestKey(t)
	userAddr := crypto.PubkeyToAddress(priv.PublicKey)

	e, _ := newTestEngine()
	timestamp := time.Now().Unix()

	canonical, err := types.CanonicalGetMyStateBytes(userAddr, timestamp)
	if err != nil {
		t.Fatalf("CanonicalGetMyStateBytes: %v", err)
	}
	digest := accounts.TextHash(crypto.Keccak256(canonical))
	sig, err := crypto.Sign(digest, other) // signed by the WRONG key
	if err != nil {
		t.Fatalf("crypto.Sign: %v", err)
	}

	_, err = e.GetMyState(types.GetMyStateRequest{User: userAddr.Hex(), Timestamp: timestamp, Signature: sig})
	if err == nil {
		t.Fatal("expected an error for a signature from the wrong key")
	}
}

func TestGetMyState_RejectsStaleTimestamp(t *testing.T) {
	priv := generateTestKey(t)
	e, _ := newTestEngine()

	staleTimestamp := time.Now().Add(-time.Hour).Unix()
	sig := signGetMyState(t, priv, staleTimestamp)

	_, err := e.GetMyState(types.GetMyStateRequest{
		User: crypto.PubkeyToAddress(priv.PublicKey).Hex(), Timestamp: staleTimestamp, Signature: sig,
	})
	if err == nil {
		t.Fatal("expected an error for a stale timestamp")
	}
}

func TestGetMyState_RejectsWrongSignatureLength(t *testing.T) {
	e, _ := newTestEngine()
	_, err := e.GetMyState(types.GetMyStateRequest{
		User: testBuyer, Timestamp: time.Now().Unix(), Signature: []byte{1, 2, 3},
	})
	if err == nil {
		t.Fatal("expected an error for a malformed signature")
	}
}
