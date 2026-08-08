package vault

import (
	"fmt"
	"math/big"
	"strings"
	"time"

	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

// Withdraw debits sender's balance for an on-chain WITHDRAW instruction and
// returns a TEE-signed authorization NyxSwapVault.withdraw accepts from
// anyone. withdrawalID is the instruction's own ID, used as the single-use
// replay guard.
func (h *Handler) Withdraw(sender, token common.Address, amount uint64, to common.Address, withdrawalID common.Hash) (*types.WithdrawResponse, error) {
	return h.issueWithdrawal(strings.ToLower(sender.Hex()), token, amount, to, withdrawalID)
}

// issueWithdrawal debits the user's balance and returns a TEE-signed
// withdrawal authorization. Shared by Withdraw (on-chain, user already
// known) and WithdrawRequest (off-chain FSA path, user recovered from a
// signature) — the two differ only in how the request is authorized.
func (h *Handler) issueWithdrawal(user string, token common.Address, amount uint64, to common.Address, withdrawalID common.Hash) (*types.WithdrawResponse, error) {
	if amount == 0 {
		return nil, fmt.Errorf("withdraw amount must be greater than zero")
	}

	if err := h.balances.Withdraw(user, token, amount); err != nil {
		return nil, fmt.Errorf("debiting balance: %w", err)
	}

	// Build the withdrawal message: abi.encodePacked(token, amount, to, withdrawalId).
	// We send the RAW packed bytes (not keccak256'd) because the TEE sign server
	// applies keccak256 + EIP-191 prefix internally; see teesign.Client.Sign.
	message := packWithdrawalMessage(token, amount, to, withdrawalID)

	sig, err := h.signer(message)
	if err != nil {
		// Rollback: re-credit balance on signing failure.
		_ = h.balances.Deposit(user, token, amount)
		return nil, fmt.Errorf("signing withdrawal: %w", err)
	}

	h.history.RecordWithdrawal(user, types.WithdrawalRecord{
		Token:     token,
		Amount:    amount,
		Address:   to,
		Timestamp: time.Now().UnixNano(),
	})

	bal := h.balances.Get(user, token)
	return &types.WithdrawResponse{
		Token:        token,
		Amount:       amount,
		To:           to,
		WithdrawalID: withdrawalID,
		Signature:    sig,
		Available:    bal.Available,
	}, nil
}

// packWithdrawalMessage returns abi.encodePacked(token, amount, to, withdrawalId)
// as raw bytes (104 bytes total). The TEE sign server keccak256's this input
// and signs the EIP-191-prefixed digest, matching NyxSwapVault's
// _recoverSigner expectation.
func packWithdrawalMessage(token common.Address, amount uint64, to common.Address, withdrawalID common.Hash) []byte {
	buf := make([]byte, 0, 104)
	buf = append(buf, token.Bytes()...)

	amountBytes := make([]byte, 32)
	new(big.Int).SetUint64(amount).FillBytes(amountBytes)
	buf = append(buf, amountBytes...)

	buf = append(buf, to.Bytes()...)
	buf = append(buf, withdrawalID.Bytes()...)

	return buf
}

// DecodeWithdrawMessage ABI-decodes a WITHDRAW instruction's OriginalMessage:
// (address sender, address token, uint256 amount, address to).
func DecodeWithdrawMessage(msg []byte) (sender, token common.Address, amount uint64, to common.Address, err error) {
	addrTy, _ := abi.NewType("address", "", nil)
	uint256Ty, _ := abi.NewType("uint256", "", nil)

	args := abi.Arguments{
		{Type: addrTy},
		{Type: addrTy},
		{Type: uint256Ty},
		{Type: addrTy},
	}

	values, err := args.Unpack(msg)
	if err != nil {
		return common.Address{}, common.Address{}, 0, common.Address{}, fmt.Errorf("abi unpack: %w", err)
	}
	if len(values) != 4 {
		return common.Address{}, common.Address{}, 0, common.Address{}, fmt.Errorf("expected 4 values, got %d", len(values))
	}

	sender = values[0].(common.Address)
	token = values[1].(common.Address)
	amountBig := values[2].(*big.Int)
	to = values[3].(common.Address)

	return sender, token, amountBig.Uint64(), to, nil
}
