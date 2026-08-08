package extension

import (
	"encoding/json"
	"fmt"

	"extension-scaffold/internal/extension/vault"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
)

// This file holds every wire-format adapter dispatched from
// processInstruction/processDirect in extension.go — one per action type.
// Each does the same three things: unwrap the wire payload, call into the
// typed submodule that actually owns the logic (vault or matching), wrap
// the result back into an ActionResult. Kept together in one file rather
// than scattered one-per-file, since none of them is more than this.

// --- DEPOSIT / WITHDRAW / WITHDRAW_REQUEST (see internal/extension/vault) ---

// processDeposit handles DEPOSIT instructions (on-chain).
func (e *Extension) processDeposit(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	sender, token, amount, err := vault.DecodeDepositMessage(df.OriginalMessage)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding deposit message: %w", err))
	}

	resp, err := e.vault.Deposit(sender, token, amount)
	if err != nil {
		return buildResult(action, df, nil, 0, err)
	}
	data, _ := json.Marshal(resp)

	return buildResult(action, df, data, 1, nil)
}

// processWithdraw handles WITHDRAW instructions (on-chain).
func (e *Extension) processWithdraw(action teetypes.Action, df *instruction.DataFixed) teetypes.ActionResult {
	sender, token, amount, to, err := vault.DecodeWithdrawMessage(df.OriginalMessage)
	if err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding withdraw message: %w", err))
	}

	resp, err := e.vault.Withdraw(sender, token, amount, to, df.InstructionID)
	if err != nil {
		return buildResult(action, df, nil, 0, err)
	}
	data, _ := json.Marshal(resp)

	return buildResult(action, df, data, 1, nil)
}

// processWithdrawRequest handles WITHDRAW_REQUEST direct instructions — see
// vault.Handler.WithdrawRequest for the full design rationale and
// authorization flow.
func (e *Extension) processWithdrawRequest(action teetypes.Action, df *instruction.DataFixed, msg hexutil.Bytes) teetypes.ActionResult {
	var req types.WithdrawRequestPayload
	if err := json.Unmarshal(msg, &req); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
	}

	resp, err := e.vault.WithdrawRequest(req, df.InstructionID)
	if err != nil {
		return buildResult(action, df, nil, 0, err)
	}
	data, _ := json.Marshal(resp)

	return buildResult(action, df, data, 1, nil)
}

// --- PLACE_ORDER / CANCEL_ORDER (see internal/extension/matching) ---

// processPlaceOrder handles PLACE_ORDER direct actions.
func (e *Extension) processPlaceOrder(action teetypes.Action, df *instruction.DataFixed, msg hexutil.Bytes) teetypes.ActionResult {
	var req types.PlaceOrderRequest
	if err := json.Unmarshal(msg, &req); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
	}

	resp, err := e.matching.PlaceOrder(req)
	if err != nil {
		return buildResult(action, df, nil, 0, err)
	}
	data, _ := json.Marshal(resp)

	return buildResult(action, df, data, 1, nil)
}

// processCancelOrder handles CANCEL_ORDER direct actions.
func (e *Extension) processCancelOrder(action teetypes.Action, df *instruction.DataFixed, msg hexutil.Bytes) teetypes.ActionResult {
	var req types.CancelOrderRequest
	if err := json.Unmarshal(msg, &req); err != nil {
		return buildResult(action, df, nil, 0, fmt.Errorf("decoding request: %w", err))
	}

	resp, err := e.matching.CancelOrder(req)
	if err != nil {
		return buildResult(action, df, nil, 0, err)
	}
	data, _ := json.Marshal(resp)

	return buildResult(action, df, data, 1, nil)
}
