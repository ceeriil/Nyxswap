// Package types contains types that could be useful to other apps when interacting with this extension.
package types

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"

	"extension-scaffold/pkg/auction"
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

// --- Swap (off-chain direct action) ---
//
// A SWAP is a Dutch-auction intent, not an instantly-executed trade — see
// pkg/auction's package doc for the model (1inch Fusion's approach, adapted
// to a single TEE resolver instead of a competing resolver network). It
// resolves asynchronously: the SWAP handler itself only validates, holds
// funds, and creates the order — status is always 2 (pending) in its
// ActionResult. Poll GET_MY_STATE for the eventual outcome. This split
// exists because the extension's request/response cycle is fully
// synchronous and serialized (see docs/extension-contract.md §5) — a
// handler that blocked until the order resolved would freeze every other
// request against the extension for the same duration.

// SwapRequest is the JSON payload for a SWAP direct action.
type SwapRequest struct {
	Sender   string       `json:"sender"`
	Pair     string       `json:"pair"`
	Side     auction.Side `json:"side"`
	Quantity uint64       `json:"quantity"`
	// MinAcceptablePrice is the worst price the sender will accept — same
	// role as NyxSwapPool.swap()'s minAmountOut. The auction's FloorPrice
	// never goes past this: if the pool can't meet it by the time the order
	// expires, the order simply doesn't fill (funds released), the same
	// "swap doesn't execute" outcome ordinary slippage protection produces
	// elsewhere in this codebase — never a worse-than-tolerated fill.
	MinAcceptablePrice uint64 `json:"minAcceptablePrice"`
}

// SwapResponse is the JSON payload included (best-effort — data is only
// contractually meaningful for status == 1, see §4.6) alongside a SWAP
// request's immediate status-2 ActionResult. OrderID is what a client needs
// to correlate this submission with its eventual GET_MY_STATE entry.
type SwapResponse struct {
	OrderID    string       `json:"orderId"`
	Pair       string       `json:"pair"`
	Side       auction.Side `json:"side"`
	Quantity   uint64       `json:"quantity"`
	StartPrice uint64       `json:"startPrice"`
	FloorPrice uint64       `json:"floorPrice"`
	ExpiresAt  int64        `json:"expiresAt"` // unix nanoseconds
}

// PoolFillResponse is a TEE-signed authorization for NyxSwapVault.fillFromPool,
// covering whatever quantity of an order the auction couldn't match
// peer-to-peer. Same "TEE signs, anyone relays" pattern as WithdrawResponse:
// this JSON is public and carriable by any third party, and it authorizes
// nothing except exactly this (pool, aToB, amountIn, minAmountOut) swap, once,
// pulling from the vault's own custody — never bound to the trader on-chain.
type PoolFillResponse struct {
	FillID       common.Hash    `json:"fillId"`
	Pool         common.Address `json:"pool"`
	AToB         bool           `json:"aToB"`
	AmountIn     uint64         `json:"amountIn"`
	MinAmountOut uint64         `json:"minAmountOut"`
	AmountOut    uint64         `json:"amountOut"`
	Signature    hexutil.Bytes  `json:"signature"`
}

// --- Cancel Swap (off-chain direct action) ---

// CancelSwapRequest is the JSON payload for a CANCEL_SWAP direct action.
type CancelSwapRequest struct {
	Sender  string `json:"sender"`
	OrderID string `json:"orderId"`
}

// CancelSwapResponse is the JSON payload returned in ActionResult.Data.
type CancelSwapResponse struct {
	OrderID   string `json:"orderId"`
	Pair      string `json:"pair"`
	Side      string `json:"side"`
	Remaining uint64 `json:"remaining"`
}

// --- Get My State (off-chain direct action) ---
//
// The only channel that returns a caller's own private orders/history —
// GET /state (unauthenticated) deliberately never does, see its doc
// comment in internal/extension/extension.go. Authenticated the same way
// WITHDRAW_REQUEST is: an inner signature over canonical bytes, not
// msg.sender transport, so a gasless account can poll it too.

// GetMyStateDomain is the canonical-encoding domain separator for
// GET_MY_STATE requests — distinct from WithdrawRequestDomain so a
// WITHDRAW_REQUEST signature can never be replayed as a valid
// GET_MY_STATE proof, or vice versa.
var GetMyStateDomain = mkDomain("NyxSwapGetMyStateV1")

// GetMyStateRequest is the JSON payload for a GET_MY_STATE direct action.
// Timestamp must be within config.GetMyStateMaxSkew of the TEE's clock, or
// the request is rejected — bounds how long a leaked signature could be
// replayed to keep reading someone's state without their ongoing consent.
type GetMyStateRequest struct {
	User      string        `json:"user"`
	Timestamp int64         `json:"timestamp"`
	Signature hexutil.Bytes `json:"signature"`
}

// CanonicalGetMyStateBytes returns the byte-string signed for a
// GET_MY_STATE request. Layout: abi.encode(domain, user, timestamp). The
// frontend must produce the identical encoding.
func CanonicalGetMyStateBytes(user common.Address, timestamp int64) ([]byte, error) {
	bytes32Ty, err := abi.NewType("bytes32", "", nil)
	if err != nil {
		return nil, fmt.Errorf("bytes32 type: %w", err)
	}
	addrTy, err := abi.NewType("address", "", nil)
	if err != nil {
		return nil, fmt.Errorf("address type: %w", err)
	}
	int64Ty, err := abi.NewType("int64", "", nil)
	if err != nil {
		return nil, fmt.Errorf("int64 type: %w", err)
	}
	args := abi.Arguments{{Type: bytes32Ty}, {Type: addrTy}, {Type: int64Ty}}
	return args.Pack(GetMyStateDomain, user, timestamp)
}

// LiveOrderView is one still-pending order in a GetMyStateResponse.
type LiveOrderView struct {
	OrderID      string       `json:"orderId"`
	Pair         string       `json:"pair"`
	Side         auction.Side `json:"side"`
	Quantity     uint64       `json:"quantity"`
	Remaining    uint64       `json:"remaining"`
	CurrentPrice uint64       `json:"currentPrice"`
	ExpiresAt    int64        `json:"expiresAt"`
}

// ResolvedOrderView is one finished order (filled, partially filled, or
// expired unfilled) in a GetMyStateResponse.
type ResolvedOrderView struct {
	OrderID    string            `json:"orderId"`
	Pair       string            `json:"pair"`
	Side       auction.Side      `json:"side"`
	Status     string            `json:"status"` // "filled", "partial", "expired"
	Matches    []auction.Match   `json:"matches,omitempty"`
	PoolFill   *PoolFillResponse `json:"poolFill,omitempty"`
	Remaining  uint64            `json:"remaining"`
	ResolvedAt int64             `json:"resolvedAt"`
}

// GetMyStateResponse is the JSON payload returned in ActionResult.Data.
type GetMyStateResponse struct {
	LiveOrders []LiveOrderView     `json:"liveOrders"`
	Resolved   []ResolvedOrderView `json:"resolved"`
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
