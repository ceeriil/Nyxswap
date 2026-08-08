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

// Deposit credits sender's balance for a DEPOSIT instruction already known
// to have landed on-chain (the instruction only reaches the TEE once it
// has). token/amount come from the decoded on-chain message.
func (h *Handler) Deposit(sender, token common.Address, amount uint64) (*types.DepositResponse, error) {
	if amount == 0 {
		return nil, fmt.Errorf("deposit amount must be greater than zero")
	}

	user := strings.ToLower(sender.Hex())
	if err := h.balances.Deposit(user, token, amount); err != nil {
		return nil, fmt.Errorf("crediting balance: %w", err)
	}

	h.history.RecordDeposit(user, types.DepositRecord{
		Token:     token,
		Amount:    amount,
		Timestamp: time.Now().UnixNano(),
	})

	bal := h.balances.Get(user, token)
	return &types.DepositResponse{
		Token:     token,
		Amount:    amount,
		Available: bal.Available,
	}, nil
}

// DecodeDepositMessage ABI-decodes a DEPOSIT instruction's OriginalMessage:
// (address sender, address token, uint256 amount).
func DecodeDepositMessage(msg []byte) (sender, token common.Address, amount uint64, err error) {
	addrTy, _ := abi.NewType("address", "", nil)
	uint256Ty, _ := abi.NewType("uint256", "", nil)

	args := abi.Arguments{
		{Type: addrTy},
		{Type: addrTy},
		{Type: uint256Ty},
	}

	values, err := args.Unpack(msg)
	if err != nil {
		return common.Address{}, common.Address{}, 0, fmt.Errorf("abi unpack: %w", err)
	}
	if len(values) != 3 {
		return common.Address{}, common.Address{}, 0, fmt.Errorf("expected 3 values, got %d", len(values))
	}

	sender, ok := values[0].(common.Address)
	if !ok {
		return common.Address{}, common.Address{}, 0, fmt.Errorf("expected address for sender")
	}
	token, ok = values[1].(common.Address)
	if !ok {
		return common.Address{}, common.Address{}, 0, fmt.Errorf("expected address for token")
	}
	amountBig, ok := values[2].(*big.Int)
	if !ok {
		return common.Address{}, common.Address{}, 0, fmt.Errorf("expected uint256 for amount")
	}

	return sender, token, amountBig.Uint64(), nil
}
