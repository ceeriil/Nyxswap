package poolfallback

import (
	"context"
	"fmt"
	"math/big"

	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// reserveFetcher is the subset of *Reader that Fallback depends on — an
// interface so tests can inject a stub without a live RPC endpoint.
type reserveFetcher interface {
	Reserves(ctx context.Context, pool common.Address) (reserveA, reserveB *big.Int, err error)
}

// Signer produces a TEE signature over message (raw bytes; the signer is
// expected to keccak256 + EIP-191-prefix them itself, matching
// NyxSwapVault's ecrecover expectations). Satisfied by (*teesign.Client).Sign.
type Signer func(message []byte) ([]byte, error)

// Fallback quotes and authorizes NyxSwapVault.fillFromPool fills.
type Fallback struct {
	reader reserveFetcher
	vault  common.Address
	sign   Signer
}

// New builds a Fallback for the given vault, signing through sign. Returns
// nil if reader is nil (Dial found no CHAIN_URL configured, or the caller
// otherwise has no live reader) — callers can construct unconditionally and
// treat a nil *Fallback as "pool fallback disabled," never a special case.
func New(reader *Reader, vault common.Address, sign Signer) *Fallback {
	if reader == nil {
		return nil
	}
	return &Fallback{reader: reader, vault: vault, sign: sign}
}

// Try quotes pool at its current on-chain reserves and, if the result meets
// minAmountOut, returns a TEE-signed fillFromPool authorization. Returns
// (nil, nil) — not an error — when the pool's current price doesn't clear
// minAmountOut; that's the normal "not favorable right now" outcome, not a
// failure. fillSeed should uniquely identify whatever this fill settles
// (e.g. an order ID); it's hashed into the single-use fill ID.
func (f *Fallback) Try(ctx context.Context, pool common.Address, aToB bool, amountIn, minAmountOut uint64, fillSeed string) (*types.PoolFillResponse, error) {
	if f.vault == (common.Address{}) {
		return nil, fmt.Errorf("vault address not configured; cannot sign pool fill")
	}

	reserveA, reserveB, err := f.reader.Reserves(ctx, pool)
	if err != nil {
		return nil, fmt.Errorf("reading pool reserves: %w", err)
	}
	reserveIn, reserveOut := reserveA, reserveB
	if !aToB {
		reserveIn, reserveOut = reserveB, reserveA
	}

	amountOutQuote := quoteSwap(reserveIn, reserveOut, new(big.Int).SetUint64(amountIn))
	if !amountOutQuote.IsUint64() {
		return nil, fmt.Errorf("pool quote overflow")
	}
	amountOut := amountOutQuote.Uint64()
	if amountOut < minAmountOut {
		return nil, nil
	}

	fillID := deriveFillID(fillSeed)
	message := packFillMessage(f.vault, fillID, pool, aToB, amountIn, minAmountOut)
	sig, err := f.sign(message)
	if err != nil {
		return nil, fmt.Errorf("signing pool fill: %w", err)
	}

	return &types.PoolFillResponse{
		FillID:       fillID,
		Pool:         pool,
		AToB:         aToB,
		AmountIn:     amountIn,
		MinAmountOut: minAmountOut,
		AmountOut:    amountOut,
		Signature:    sig,
	}, nil
}

// deriveFillID derives a single-use fill identifier from whatever this fill
// settles. One caller (one order) is expected to produce at most one fill
// per seed, so the seed alone is sufficient — no separate nonce needed.
func deriveFillID(seed string) common.Hash {
	return crypto.Keccak256Hash([]byte("NyxSwapPoolFill:" + seed))
}

// packFillMessage returns abi.encodePacked(vault, fillId, pool, aToB,
// amountIn, minAmountOut) as raw bytes (137 bytes total), matching
// NyxSwapVault.fillFromPool's expected signed hash. Like
// InstructionSender's packWithdrawalMessage, these are the RAW packed
// bytes — the TEE sign server keccak256's them and signs the
// EIP-191-prefixed digest itself.
func packFillMessage(vault common.Address, fillID common.Hash, pool common.Address, aToB bool, amountIn, minAmountOut uint64) []byte {
	buf := make([]byte, 0, 137)
	buf = append(buf, vault.Bytes()...)
	buf = append(buf, fillID.Bytes()...)
	buf = append(buf, pool.Bytes()...)
	if aToB {
		buf = append(buf, 1)
	} else {
		buf = append(buf, 0)
	}

	amountInBytes := make([]byte, 32)
	new(big.Int).SetUint64(amountIn).FillBytes(amountInBytes)
	buf = append(buf, amountInBytes...)

	minAmountOutBytes := make([]byte, 32)
	new(big.Int).SetUint64(minAmountOut).FillBytes(minAmountOutBytes)
	buf = append(buf, minAmountOutBytes...)

	return buf
}
