package vault

import (
	"fmt"
	"strings"

	"extension-scaffold/internal/extension/fsa"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
)

// WithdrawRequest handles the off-chain WITHDRAW_REQUEST direct action — the
// off-chain twin of Withdraw.
//
// Withdrawing is two separable things: an authorization ("this user wants X
// out, paid to Y") and a value movement (the vault releasing tokens). Only
// the movement must live on-chain — NyxSwapVault.withdraw already accepts
// the TEE's slip from any caller. This op moves the authorization
// off-chain: the user (or the session key bound to them — the FSA model,
// since a gasless PersonalAccount can't call withdraw() itself) signs the
// canonical request, the TEE debits and signs the slip in seconds, and a
// relayer carries the slip on-chain. No XRPL payment, no FDC round-trip.
//
// Flow:
//  1. Structural validation; pin to this deployment's InstructionSender.
//  2. Recover the inner signer; authorize against req.User (self or bound key).
//  3. Advance the per-user nonce (replay protection — without it a replayed
//     request would debit the balance again and mint a second slip).
//  4. issueWithdrawal — same debit + slip as the on-chain path, with
//     withdrawalID (the caller's Direct action id) as the single-use ID.
//
// The response is public JSON, like the on-chain path: the slip must be
// carriable by third parties, and it authorizes nothing except paying
// req.To exactly what the signer requested.
func (h *Handler) WithdrawRequest(req types.WithdrawRequestPayload, withdrawalID common.Hash) (*types.WithdrawResponse, error) {
	if req.Amount == 0 {
		return nil, fmt.Errorf("amount must be positive")
	}
	if req.User == (common.Address{}) {
		return nil, fmt.Errorf("user address is zero")
	}
	if req.Token == (common.Address{}) {
		return nil, fmt.Errorf("token address is zero")
	}
	if req.To == (common.Address{}) {
		return nil, fmt.Errorf("destination address is zero")
	}
	if len(req.Signature) != 65 {
		return nil, fmt.Errorf("signature length: expected 65, got %d", len(req.Signature))
	}
	if err := fsa.RequireBoundContract(req.Contract, h.instructionSender); err != nil {
		return nil, err
	}

	// Recover + authorize: the user's own key, or the session key bound to them.
	canonical, err := types.CanonicalWithdrawRequestBytes(req.Contract, req.User, req.Token, req.To, req.Amount, req.Nonce)
	if err != nil {
		return nil, fmt.Errorf("canonical encoding: %w", err)
	}
	_, signerAddr, err := fsa.RecoverSigner(canonical, req.Signature)
	if err != nil {
		return nil, fmt.Errorf("recovering signer: %w", err)
	}

	userKey := strings.ToLower(req.User.Hex())
	boundPub, err := h.fsa.BoundPublicKey(userKey)
	if err != nil {
		return nil, err
	}
	if err := fsa.AuthorizeSigner(signerAddr, req.User, boundPub); err != nil {
		return nil, err
	}

	if !h.fsa.CheckAndAdvanceNonce(userKey, req.Nonce) {
		return nil, fmt.Errorf("stale or replayed nonce: %d", req.Nonce)
	}

	// withdrawalID doubles as the single-use withdrawalId, exactly like the
	// on-chain path uses its instruction id.
	return h.issueWithdrawal(userKey, req.Token, req.Amount, req.To, withdrawalID)
}
