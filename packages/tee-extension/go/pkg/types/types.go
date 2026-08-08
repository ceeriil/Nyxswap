// Package types contains types that could be useful to other apps when interacting with this extension.
package types

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"

	"extension-scaffold/pkg/orderbook"
)

// --- Deposit (on-chain instruction) ---

// DepositResponse is the JSON payload returned in ActionResult.Data for a
// DEPOSIT instruction. There is no DepositRequest type — the message is
// ABI-encoded (address sender, address token, uint256 amount), decoded
// directly in processDeposit rather than through a struct, since it's a
// positional ABI tuple, not JSON.
type DepositResponse struct {
	Token     common.Address `json:"token"`
	Amount    uint64         `json:"amount"`
	Available uint64         `json:"available"`
}

// DepositRecord is one entry in a user's bounded deposit history.
type DepositRecord struct {
	Token     common.Address `json:"token"`
	Amount    uint64         `json:"amount"`
	Timestamp int64          `json:"timestamp"`
}

// --- Withdraw (on-chain instruction + its off-chain WITHDRAW_REQUEST twin) ---

// WithdrawResponse is the JSON payload returned in ActionResult.Data for both
// the on-chain WITHDRAW instruction and the off-chain WITHDRAW_REQUEST direct
// action — same outcome either way: a TEE-signed authorization the vault's
// withdraw() accepts from anyone.
type WithdrawResponse struct {
	Token        common.Address `json:"token"`
	Amount       uint64         `json:"amount"`
	To           common.Address `json:"to"`
	WithdrawalID common.Hash    `json:"withdrawalId"`
	Signature    hexutil.Bytes  `json:"signature"`
	Available    uint64         `json:"available"`
}

// WithdrawalRecord is one entry in a user's bounded withdrawal history.
type WithdrawalRecord struct {
	Token     common.Address `json:"token"`
	Amount    uint64         `json:"amount"`
	Address   common.Address `json:"address"`
	Timestamp int64          `json:"timestamp"`
}

// WithdrawRequestPayload is the off-chain twin of the on-chain WITHDRAW
// instruction: same outcome (balance debit + TEE-signed withdrawal slip), but
// authorized by an inner signature over the canonical bytes — the user's own
// key or the session key bound to them — instead of msg.sender transport.
// Exists so gasless accounts can request withdrawals in seconds; the returned
// slip is then relayed on-chain by anyone (NyxSwapVault.withdraw is
// permissionless).
type WithdrawRequestPayload struct {
	Contract  common.Address `json:"contract"`
	User      common.Address `json:"user"`
	Token     common.Address `json:"token"`
	To        common.Address `json:"to"`
	Amount    uint64         `json:"amount"`
	Nonce     uint64         `json:"nonce"`
	Signature hexutil.Bytes  `json:"signature"`
}

// WithdrawRequestDomain is the canonical-encoding domain separator,
// Solidity bytes32("NyxSwapWithdrawReqV1")-style (left-aligned, zero-padded).
var WithdrawRequestDomain = mkDomain("NyxSwapWithdrawReqV1")

func mkDomain(s string) [32]byte {
	var d [32]byte
	copy(d[:], s)
	return d
}

// CanonicalWithdrawRequestBytes returns the byte-string signed for an
// off-chain WITHDRAW_REQUEST. Layout: abi.encode(domain, contract, user,
// token, to, amount, nonce). The frontend must produce the identical
// encoding.
func CanonicalWithdrawRequestBytes(contract, user, token, to common.Address, amount, nonce uint64) ([]byte, error) {
	bytes32Ty, err := abi.NewType("bytes32", "", nil)
	if err != nil {
		return nil, fmt.Errorf("bytes32 type: %w", err)
	}
	addrTy, err := abi.NewType("address", "", nil)
	if err != nil {
		return nil, fmt.Errorf("address type: %w", err)
	}
	uint256Ty, err := abi.NewType("uint256", "", nil)
	if err != nil {
		return nil, fmt.Errorf("uint256 type: %w", err)
	}
	args := abi.Arguments{
		{Type: bytes32Ty},
		{Type: addrTy}, {Type: addrTy}, {Type: addrTy}, {Type: addrTy},
		{Type: uint256Ty}, {Type: uint256Ty},
	}
	return args.Pack(
		WithdrawRequestDomain,
		contract, user, token, to,
		new(big.Int).SetUint64(amount), new(big.Int).SetUint64(nonce),
	)
}

// --- Place Order (off-chain direct action) ---

// PlaceOrderRequest is the JSON payload for a PLACE_ORDER direct action.
// Every order is a limit order — see orderbook.Order's doc comment for why
// there's no separate market-order type.
type PlaceOrderRequest struct {
	Sender   string         `json:"sender"`
	Pair     string         `json:"pair"`
	Side     orderbook.Side `json:"side"`
	Price    uint64         `json:"price"`
	Quantity uint64         `json:"quantity"`
}

// PlaceOrderResponse is the JSON payload returned in ActionResult.Data.
type PlaceOrderResponse struct {
	OrderID   string            `json:"orderId"`
	Status    string            `json:"status"` // "filled", "partial", "resting"
	Matches   []orderbook.Match `json:"matches,omitempty"`
	Remaining uint64            `json:"remaining"`
}

// --- Cancel Order (off-chain direct action) ---

// CancelOrderRequest is the JSON payload for a CANCEL_ORDER direct action.
type CancelOrderRequest struct {
	Sender  string `json:"sender"`
	OrderID string `json:"orderId"`
}

// CancelOrderResponse is the JSON payload returned in ActionResult.Data.
type CancelOrderResponse struct {
	OrderID   string `json:"orderId"`
	Pair      string `json:"pair"`
	Side      string `json:"side"`
	Remaining uint64 `json:"remaining"`
}

// State holds the extension's observable state, returned by GET /state.
// Deliberately minimal — no balances, no order/match data. Those are
// user-scoped and only ever answered via GET_MY_STATE, never this
// unauthenticated endpoint.
type State struct {
	ConfiguredPairs int `json:"configuredPairs"`
}

// --- DO NOT MODIFY below this line. ---

// StateResponse is the envelope returned by GET /state.
type StateResponse struct {
	StateVersion common.Hash `json:"stateVersion"`
	State        State       `json:"state"`
}
