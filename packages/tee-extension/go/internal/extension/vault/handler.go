// Package vault handles DEPOSIT, WITHDRAW, and WITHDRAW_REQUEST — the three
// instruction/direct-action types that move value between a user's TEE
// balance and NyxSwapVault's on-chain custody. It's named after that
// contract because this is its TEE-side counterpart: everything here either
// credits a balance because a deposit landed on-chain, or debits one and
// hands back a TEE-signed slip NyxSwapVault.withdraw will accept.
package vault

import (
	"extension-scaffold/internal/extension/fsa"
	"extension-scaffold/internal/extension/history"
	"extension-scaffold/pkg/balance"

	"github.com/ethereum/go-ethereum/common"
)

// Signer produces a TEE signature over message (raw bytes; the signer is
// expected to keccak256 + EIP-191-prefix them itself, matching
// NyxSwapVault's ecrecover expectations). Satisfied by (*teesign.Client).Sign
// — a function type rather than teesign.Client directly so tests can inject
// a stub without a live sign server, same seam poolfallback.Signer uses.
type Signer func(message []byte) ([]byte, error)

// Handler processes DEPOSIT/WITHDRAW/WITHDRAW_REQUEST against the shared
// balance ledger, history, and FSA state — all owned by the caller and
// handed in here by reference, not copied. Handler holds no lock of its
// own: balances, history, and fsa all guard themselves.
type Handler struct {
	balances          *balance.Manager
	history           *history.Store
	fsa               *fsa.Store
	signer            Signer
	instructionSender common.Address
}

// New builds a Handler. instructionSender may be the zero address —
// WithdrawRequest will then reject every request via
// fsa.RequireBoundContract, the same as if it were never configured.
func New(balances *balance.Manager, hist *history.Store, fsaStore *fsa.Store, signer Signer, instructionSender common.Address) *Handler {
	return &Handler{
		balances:          balances,
		history:           hist,
		fsa:               fsaStore,
		signer:            signer,
		instructionSender: instructionSender,
	}
}
