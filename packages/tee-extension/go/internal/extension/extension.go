package extension

import (
	"encoding/json"
	"fmt"
	"net/http"

	"extension-scaffold/internal/config"
	"extension-scaffold/internal/extension/fsa"
	"extension-scaffold/internal/extension/history"
	"extension-scaffold/internal/extension/matching"
	"extension-scaffold/internal/extension/poolfallback"
	"extension-scaffold/internal/extension/teesign"
	"extension-scaffold/internal/extension/vault"
	"extension-scaffold/pkg/balance"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"

	"github.com/flare-foundation/tee-node/pkg/processorutils"
)

// Extension is NyxSwap's TEE extension dispatch root — reserves stay fully
// public and verifiable (see NyxSwapPool.sol), only a pending SWAP's own
// details are ever hidden here before it resolves. Not a dark pool: nothing
// about pool depth or settled activity is opaque, see brief.md. It owns no
// state of its own — every piece of mutable TEE state (balances, the
// matching engine, FSA bindings, deposit/withdrawal history) lives in one
// of its component packages, each guarding itself. Extension's only job is
// routing an incoming Action to the right component and wrapping the
// result back into the wire format.
type Extension struct {
	Server *http.Server

	vault    *vault.Handler   // DEPOSIT/WITHDRAW/WITHDRAW_REQUEST against NyxSwapVault
	matching *matching.Engine // SWAP/CANCEL_SWAP/GET_MY_STATE auction engine
}

// --- DO NOT MODIFY: New(), actionHandler() structure is boilerplate. ---
func New(extensionPort, signPort int) *Extension {
	balances := balance.NewManager()
	signer := teesign.NewClient(signPort)
	instructionSender := common.HexToAddress(config.InstructionSender)
	vaultAddress := common.HexToAddress(config.VaultAddress)

	vaultHandler := vault.New(balances, history.NewStore(), fsa.NewStore(), signer.Sign, instructionSender)

	pairs := make(map[string]config.TradingPairConfig, len(config.TradingPairs))
	for _, pair := range config.TradingPairs {
		pairs[pair.Name] = pair
	}

	// Pool fallback (and spot-price reading for SWAP's decay curve) is
	// optional: a dial failure or unset CHAIN_URL disables both — dialedReader
	// stays a true nil interface (not a nil *poolfallback.Reader wrapped in a
	// non-nil interface, which would panic on first use — see
	// matching.ReserveReader's doc comment), poolFallback stays nil. Neither
	// ever blocks extension startup.
	var poolFallback *poolfallback.Fallback
	var dialedReader matching.ReserveReader
	reader, err := poolfallback.Dial(config.ChainURL)
	if err != nil {
		logger.Infof("pool fallback disabled: %v", err)
	} else if reader != nil {
		poolFallback = poolfallback.New(reader, vaultAddress, signer.Sign)
		dialedReader = reader
	}

	matchingEngine := matching.New(pairs, balances, poolFallback, dialedReader)
	matchingEngine.StartResolver()

	e := &Extension{
		vault:    vaultHandler,
		matching: matchingEngine,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /state", e.stateHandler)
	mux.HandleFunc("POST /action", e.actionHandler)

	e.Server = &http.Server{Addr: fmt.Sprintf(":%d", extensionPort), Handler: mux}
	return e
}

// stateHandler reports minimal, non-sensitive extension state. No balances,
// no order/match data — those are user-scoped and only ever answered via
// GET_MY_STATE, never this unauthenticated endpoint.
func (e *Extension) stateHandler(w http.ResponseWriter, r *http.Request) {
	stateResponse := types.StateResponse{
		StateVersion: teeutils.ToHash(config.Version),
		State: types.State{
			ConfiguredPairs: e.matching.PairCount(),
		},
	}

	err := json.NewEncoder(w).Encode(stateResponse)
	if err != nil {
		http.Error(w, fmt.Sprintf("sending response: %v", err), http.StatusInternalServerError)
		return
	}
}

// processAction routes by action type (instruction vs direct) and then by
// OPType/OPCommand.
func (e *Extension) processAction(action teetypes.Action) (int, []byte) {
	switch action.Data.Type {
	case teetypes.Instruction:
		return e.processInstruction(action)
	case teetypes.Direct:
		return e.processDirect(action)
	default:
		return http.StatusBadRequest, []byte(fmt.Sprintf("unsupported action type: %s", action.Data.Type))
	}
}

// processInstruction handles on-chain instruction actions (DEPOSIT, WITHDRAW).
// FSA_OP's inner ops beyond WITHDRAW_REQUEST (BIND_SESSION_SIG, GET_BINDING)
// aren't implemented yet — see the fsa package's doc comment for why — so
// FSA_OP itself isn't dispatched here either; WITHDRAW_REQUEST is reached
// via the Direct path in processDirect instead, matching how the reference
// exposes it.
func (e *Extension) processInstruction(action teetypes.Action) (int, []byte) {
	df, err := processorutils.Parse[instruction.DataFixed](action.Data.Message)
	if err != nil {
		return http.StatusBadRequest, []byte(fmt.Sprintf("decoding fixed data: %v", err))
	}

	if df.OPType != teeutils.ToHash(config.OPTypeTrading) {
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op type: received %s, expected %s (%s)",
			df.OPType.Hex(), teeutils.ToHash(config.OPTypeTrading).Hex(), config.OPTypeTrading,
		))
	}

	var ar teetypes.ActionResult

	switch {
	case df.OPCommand == teeutils.ToHash(config.OPCommandDeposit):
		ar = e.processDeposit(action, df)
	case df.OPCommand == teeutils.ToHash(config.OPCommandWithdraw):
		ar = e.processWithdraw(action, df)
	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported instruction op command: %s", df.OPCommand.Hex(),
		))
	}

	b, _ := json.Marshal(ar)
	return http.StatusOK, b
}

// processDirect handles off-chain direct actions — SWAP submission,
// cancellation, GET_MY_STATE polling, and withdrawal requests.
func (e *Extension) processDirect(action teetypes.Action) (int, []byte) {
	di, err := processorutils.Parse[teetypes.DirectInstruction](action.Data.Message)
	if err != nil {
		return http.StatusBadRequest, []byte(fmt.Sprintf("decoding direct instruction: %v", err))
	}

	if di.OPType != teeutils.ToHash(config.OPTypeTrading) {
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported op type: received %s, expected %s (%s)",
			di.OPType.Hex(), teeutils.ToHash(config.OPTypeTrading).Hex(), config.OPTypeTrading,
		))
	}

	df := &instruction.DataFixed{
		InstructionID: action.Data.ID,
		OPType:        di.OPType,
		OPCommand:     di.OPCommand,
	}

	var ar teetypes.ActionResult

	switch {
	case di.OPCommand == teeutils.ToHash(config.OPCommandSwap):
		ar = e.processSwap(action, df, di.Message)
	case di.OPCommand == teeutils.ToHash(config.OPCommandCancelSwap):
		ar = e.processCancelSwap(action, df, di.Message)
	case di.OPCommand == teeutils.ToHash(config.OPCommandGetMyState):
		ar = e.processGetMyState(action, df, di.Message)
	case di.OPCommand == teeutils.ToHash(config.OPCommandWithdrawRequest):
		ar = e.processWithdrawRequest(action, df, di.Message)
	default:
		return http.StatusNotImplemented, []byte(fmt.Sprintf(
			"unsupported direct op command: %s", di.OPCommand.Hex(),
		))
	}

	b, _ := json.Marshal(ar)
	return http.StatusOK, b
}
