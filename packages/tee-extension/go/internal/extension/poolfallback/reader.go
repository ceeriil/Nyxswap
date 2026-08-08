// Package poolfallback quotes and authorizes NyxSwapVault.fillFromPool
// fills — the fallback path for whatever an order the orderbook couldn't
// match peer-to-peer. It knows nothing about orders, orderbooks, or
// balances; callers compute aToB/amountIn/minAmountOut from their own order
// semantics and hand them to Fallback.Try, which only answers "is the
// pool's live price good enough, and if so, get the TEE to sign the
// authorization for it."
package poolfallback

import (
	"context"
	"fmt"
	"math/big"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// Reader is a minimal read-only RPC client, used only to quote live pool
// reserves. Deliberately hand-rolled against raw selectors rather than a
// generated abigen binding — matches this codebase's existing preference
// (see pkg/decoder.ABIDecoder's doc comment) for direct, auditable ABI
// calls over generated code nothing here has run against a live
// deployment yet.
type Reader struct {
	client *ethclient.Client
}

// Dial connects to url, or returns (nil, nil) if url is empty — pool
// fallback is an optional feature, not a startup requirement. A non-nil
// error means a URL was configured but dialing it failed.
func Dial(url string) (*Reader, error) {
	if url == "" {
		return nil, nil
	}
	client, err := ethclient.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("dialing chain RPC: %w", err)
	}
	return &Reader{client: client}, nil
}

var (
	selectorReserveA = crypto.Keccak256([]byte("reserveA()"))[:4]
	selectorReserveB = crypto.Keccak256([]byte("reserveB()"))[:4]
)

// Reserves reads NyxSwapPool.reserveA()/reserveB() via eth_call.
func (r *Reader) Reserves(ctx context.Context, pool common.Address) (reserveA, reserveB *big.Int, err error) {
	reserveA, err = r.callUint256(ctx, pool, selectorReserveA)
	if err != nil {
		return nil, nil, fmt.Errorf("reading reserveA: %w", err)
	}
	reserveB, err = r.callUint256(ctx, pool, selectorReserveB)
	if err != nil {
		return nil, nil, fmt.Errorf("reading reserveB: %w", err)
	}
	return reserveA, reserveB, nil
}

func (r *Reader) callUint256(ctx context.Context, to common.Address, selector []byte) (*big.Int, error) {
	out, err := r.client.CallContract(ctx, ethereum.CallMsg{To: &to, Data: selector}, nil)
	if err != nil {
		return nil, err
	}
	if len(out) != 32 {
		return nil, fmt.Errorf("unexpected return length: %d", len(out))
	}
	return new(big.Int).SetBytes(out), nil
}

// quoteSwap replicates NyxSwapPool.sol's swap() pricing exactly — same
// mul-then-div order, same integer truncation — so a quote computed here
// matches what the contract would actually produce for the same reserves.
// Reserves can move between this quote and whenever the resulting signed
// fill gets relayed on-chain; minAmountOut, not this function, is what
// actually protects the user against that drift.
func quoteSwap(reserveIn, reserveOut, amountIn *big.Int) *big.Int {
	amountInWithFee := new(big.Int).Mul(amountIn, big.NewInt(bpsDenominator-swapFeeBps))
	amountInWithFee.Div(amountInWithFee, big.NewInt(bpsDenominator))

	denominator := new(big.Int).Add(reserveIn, amountInWithFee)
	if denominator.Sign() == 0 {
		return big.NewInt(0)
	}

	amountOut := new(big.Int).Mul(reserveOut, amountInWithFee)
	return amountOut.Div(amountOut, denominator)
}

// swapFeeBps/bpsDenominator mirror NyxSwapPool.sol's SWAP_FEE_BPS/BPS_DENOMINATOR.
const (
	swapFeeBps     = 30
	bpsDenominator = 10_000
)
