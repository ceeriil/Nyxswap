package extension

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/balance"
	"extension-scaffold/pkg/orderbook"
	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/common"
	"github.com/flare-foundation/go-flare-common/pkg/tee/instruction"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
	teeutils "github.com/flare-foundation/tee-node/pkg/utils"

	"github.com/flare-foundation/tee-node/pkg/processorutils"
)

// Extension is the dark-pool trading extension handler. Orderbooks, balances,
// and everything about who's trading what live only here, in TEE memory —
// see NyxSwapVault.sol's header for why that's the point.
type Extension struct {
	mu     sync.RWMutex
	Server *http.Server

	orderbooks map[string]*orderbook.OrderBook     // pair name -> orderbook
	balances   *balance.Manager                    // per-(user, token) balances
	pairs      map[string]config.TradingPairConfig // pair name -> token addresses
	orders     map[string]string                   // orderID -> pair (for cancel routing)
	userOrders map[string][]string                 // user address -> list of orderIDs

	history           *History        // bounded per-user deposit/withdrawal history
	signPort          int             // TEE sign server port, for issueWithdrawal's signWithTEE
	fsa               *fsaStore       // FSA session-key bindings + replay nonces
	instructionSender common.Address  // this deployment's InstructionSender, for requireBoundContract
}

// --- DO NOT MODIFY: New(), actionHandler() structure is boilerplate. ---
func New(extensionPort, signPort int) *Extension {
	e := &Extension{
		orderbooks: make(map[string]*orderbook.OrderBook),
		balances:   balance.NewManager(),
		pairs:      make(map[string]config.TradingPairConfig),
		orders:     make(map[string]string),
		userOrders: make(map[string][]string),

		history:           newHistory(),
		signPort:          signPort,
		fsa:               newFsaStore(),
		instructionSender: common.HexToAddress(config.InstructionSender),
	}

	for _, pair := range config.TradingPairs {
		e.pairs[pair.Name] = pair
		e.orderbooks[pair.Name] = orderbook.NewOrderBook(pair.Name)
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
	e.mu.RLock()
	stateResponse := types.StateResponse{
		StateVersion: teeutils.ToHash(config.Version),
		State: types.State{
			ConfiguredPairs: len(e.pairs),
		},
	}
	e.mu.RUnlock()

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
// aren't implemented yet — see fsa.go's doc comment for why — so FSA_OP
// itself isn't dispatched here either; WITHDRAW_REQUEST is reached via the
// Direct path in processDirect instead, matching how the reference exposes it.
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

// processDirect handles off-chain direct actions — order placement,
// cancellation, and (once implemented) state/history queries.
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
	case di.OPCommand == teeutils.ToHash(config.OPCommandPlaceOrder):
		ar = e.processPlaceOrder(action, df, di.Message)
	case di.OPCommand == teeutils.ToHash(config.OPCommandCancelOrder):
		ar = e.processCancelOrder(action, df, di.Message)
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

// removeUserOrder removes an orderID from the user's order list.
// Caller must hold e.mu.Lock().
func (e *Extension) removeUserOrder(user, orderID string) {
	ids := e.userOrders[user]
	for i, id := range ids {
		if id == orderID {
			e.userOrders[user] = append(ids[:i], ids[i+1:]...)
			return
		}
	}
}

// nextOrderID generates a unique order ID. Concurrent-safe: the counter is
// incremented atomically and combined with a nanosecond timestamp.
var orderCounter atomic.Uint64

func (e *Extension) nextOrderID() string {
	n := orderCounter.Add(1)
	return fmt.Sprintf("ORD-%d-%d", time.Now().UnixNano(), n)
}
