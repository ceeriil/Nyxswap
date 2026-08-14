package matching

import (
	"fmt"
	"strings"
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/internal/extension/fsa"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
)

// GetMyState handles a GET_MY_STATE request — the only channel that returns
// a caller's own private SWAP orders (see types.GetMyStateRequest's doc
// comment for why the unauthenticated GET /state never does).
//
// Authentication is deliberately simpler than WITHDRAW_REQUEST's: the
// signer must BE req.User directly, no session-key indirection through
// fsa.Store — extending this to gasless PersonalAccounts (the same
// BIND_SESSION_SIG dependency WITHDRAW_REQUEST's FSA path has) is future
// work, not something to half-build here. Replay is bounded by
// config.GetMyStateMaxSkew on req.Timestamp rather than a consumed nonce,
// since unlike a withdrawal this is a repeatable read, not a one-time
// mutation — a client polling for its order's resolution just re-signs a
// fresh timestamp each time, which costs nothing (no gas, no chain call).
func (e *Engine) GetMyState(req types.GetMyStateRequest) (*types.GetMyStateResponse, error) {
	userAddr := common.HexToAddress(req.User)
	if userAddr == (common.Address{}) {
		return nil, fmt.Errorf("user address is zero")
	}
	if len(req.Signature) != 65 {
		return nil, fmt.Errorf("signature length: expected 65, got %d", len(req.Signature))
	}

	skew := time.Since(time.Unix(req.Timestamp, 0))
	if skew < 0 {
		skew = -skew
	}
	if skew > config.GetMyStateMaxSkew {
		return nil, fmt.Errorf("timestamp outside allowed skew (%s)", config.GetMyStateMaxSkew)
	}

	canonical, err := types.CanonicalGetMyStateBytes(userAddr, req.Timestamp)
	if err != nil {
		return nil, fmt.Errorf("canonical encoding: %w", err)
	}
	_, signerAddr, err := fsa.RecoverSigner(canonical, req.Signature)
	if err != nil {
		return nil, fmt.Errorf("recovering signer: %w", err)
	}
	if !strings.EqualFold(signerAddr.Hex(), userAddr.Hex()) {
		return nil, fmt.Errorf("signature does not match user")
	}

	user := strings.ToLower(userAddr.Hex())
	now := time.Now()

	e.mu.RLock()
	defer e.mu.RUnlock()

	resp := &types.GetMyStateResponse{}
	for _, orderID := range e.userOrders[user] {
		if entry, ok := e.resolved[orderID]; ok {
			resp.Resolved = append(resp.Resolved, entry.view)
			continue
		}

		pair, ok := e.orderPair[orderID]
		if !ok {
			continue
		}
		book, ok := e.books[pair]
		if !ok {
			continue
		}
		order := book.Get(orderID)
		if order == nil {
			// Resolved and dropped from the book, but hasn't landed in
			// e.resolved yet in this snapshot — can't happen while e.mu is
			// held for this whole read (resolveOnce takes the same lock
			// exclusively), kept defensive rather than assumed.
			continue
		}

		resp.LiveOrders = append(resp.LiveOrders, types.LiveOrderView{
			OrderID:      order.ID,
			Pair:         order.Pair,
			Side:         order.Side,
			Quantity:     order.Quantity,
			Remaining:    order.Remaining,
			CurrentPrice: order.CurrentPrice(now),
			ExpiresAt:    order.SubmittedAt.Add(order.Duration).UnixNano(),
		})
	}
	return resp, nil
}
