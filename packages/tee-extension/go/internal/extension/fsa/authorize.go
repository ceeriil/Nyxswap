package fsa

import (
	"bytes"
	"crypto/ecdsa"
	"fmt"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// RecoverSigner recovers the signer's ECDSA public key (and derived address) from an
// EIP-191 personal_sign signature over `message`: the signer signs the 32-byte
// keccak256(message) digest via personal_sign, i.e. sign(TextHash(keccak256(message))).
// Mirrors shielded-transfer's crypto.go so session keys work identically across extensions.
func RecoverSigner(message, signature []byte) (*ecdsa.PublicKey, common.Address, error) {
	if len(signature) != 65 {
		return nil, common.Address{}, fmt.Errorf("signature length: expected 65, got %d", len(signature))
	}
	sig := bytes.Clone(signature)
	if sig[64] >= 27 {
		sig[64] -= 27
	}
	msgHash := crypto.Keccak256(message)
	pub, err := crypto.SigToPub(accounts.TextHash(msgHash), sig)
	if err != nil {
		return nil, common.Address{}, fmt.Errorf("SigToPub: %w", err)
	}
	return pub, crypto.PubkeyToAddress(*pub), nil
}

// AuthorizeSigner authorizes a signed Direct-path op that claims to act as `identity`.
// It accepts the recovered signer if EITHER:
//
//	(a) the signer IS the identity — an EOA signing as itself (the MetaMask model), or
//	(b) the signer is the session key currently bound to the identity — the FSA model,
//	    where the identity is a PersonalAccount with no private key of its own, so its
//	    XRPL owner authorizes via a session key bound through BIND_SESSION_SIG.
//
// `boundPub` is the identity's bound key (nil if none, see Store.BoundPublicKey). A
// PersonalAccount can never satisfy (a), so for FSA identities authorization reduces
// to "signed by the bound session key" — and that key can only be set by a valid
// XRPL signature from the account's owner.
func AuthorizeSigner(signerAddr, identity common.Address, boundPub *ecdsa.PublicKey) error {
	if signerAddr == identity {
		return nil
	}
	if boundPub != nil && crypto.PubkeyToAddress(*boundPub) == signerAddr {
		return nil
	}
	return fmt.Errorf("signer mismatch: signature recovered to %s, which is neither %s nor its bound session key", signerAddr.Hex(), identity.Hex())
}

// BoundPublicKey returns the session public key bound to user, or (nil, nil)
// if none is bound — the normal case until a BIND_SESSION_SIG handler
// exists (see Store's doc comment). A non-nil error means a binding exists
// but is malformed, which should be unreachable in practice since SetBinding
// is the only writer; surfaced rather than silently ignored regardless.
func (s *Store) BoundPublicKey(user string) (*ecdsa.PublicKey, error) {
	raw, ok := s.GetBinding(user)
	if !ok {
		return nil, nil
	}
	pub, err := crypto.UnmarshalPubkey(raw)
	if err != nil {
		return nil, fmt.Errorf("malformed bound session pubkey: %w", err)
	}
	return pub, nil
}

// RequireBoundContract pins a signed off-chain request to this deployment's
// InstructionSender, so a signature captured against one deployment can't be
// replayed against another.
//
// This is the one piece of FSA support wired up without its XRPL half
// (a BIND_SESSION_SIG handler, and the XRPL signature verification it
// depends on) — that's a much bigger, security-sensitive undertaking
// (parsing signed XRPL transaction blobs, verifying an XRPL signature,
// resolving a PersonalAccount via an on-chain MasterAccountController call)
// that hasn't been ported here. Until it is, Store never gets a binding
// written to it, so WITHDRAW_REQUEST's authorization check always falls
// back to "the signer must be the user themselves" — a safe default, not a
// broken one, but BIND_SESSION_SIG/GET_BINDING have no handlers yet and
// requesting them 501s.
func RequireBoundContract(got, want common.Address) error {
	if want == (common.Address{}) {
		return fmt.Errorf("INSTRUCTION_SENDER not configured on this TEE")
	}
	if got != want {
		return fmt.Errorf("request is for contract %s, this TEE serves %s", got.Hex(), want.Hex())
	}
	return nil
}
