// Package config contains configuration values and defaults used by the extension.
package config

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/flare-foundation/go-flare-common/pkg/logger"
)

const (
	Version = "0.1.0"

	// OP_TYPE_TRADING matches NyxSwapInstructionSender.sol's OP_TYPE_TRADING exactly —
	// the bytes32 encoding of these strings must match byte-for-byte, see
	// docs/extension-contract.md. NOTE: this is deliberately "TRADING", not the
	// fce-orderbook reference's "ORDERBOOK" — ours is the string actually deployed
	// on the Solidity side; copying the reference's literal here would make every
	// instruction silently 501 (a mismatch isn't a compile error, see the contract doc).
	OPTypeTrading = "TRADING"

	OPCommandDeposit       = "DEPOSIT"
	OPCommandWithdraw      = "WITHDRAW"
	OPCommandFsaOp         = "FSA_OP"
	OPCommandPlaceOrder    = "PLACE_ORDER"
	OPCommandCancelOrder   = "CANCEL_ORDER"
	OPCommandGetMyState    = "GET_MY_STATE"
	OPCommandExportHistory = "EXPORT_HISTORY"

	// FSA (Flare Smart Accounts / Xaman) direct ops. Only the store + nonce
	// plumbing (fsa_store.go) and the WITHDRAW_REQUEST consumer of it are
	// implemented so far — BIND_SESSION_SIG/GET_BINDING's handlers (which need
	// XRPL signature verification and a MasterAccountController client) are not
	// built yet. See internal/extension's package doc for the honest status.
	OPCommandBindSessionSig  = "BIND_SESSION_SIG"
	OPCommandGetBinding      = "GET_BINDING"
	OPCommandWithdrawRequest = "WITHDRAW_REQUEST"

	// MasterAccountController — same address on every Flare network.
	DefaultMasterAccountController = "0x434936d47503353f06750Db1A444DBDC5F0AD37c"

	TimeoutShutdown = 5 * time.Second
)

// Defaults.
var (
	ExtensionPort   = 8080
	SignPort        = 9090
	TypesServerPort = 8100
	AdminAddresses  []string
	BalancesPath    string // optional: path to persist balance manager state

	// FSA support. ChainURL is required for BIND_SESSION_SIG (PersonalAccount
	// resolution via the MasterAccountController); without it FSA ops are
	// disabled. ChainURL doubles as the read-only RPC endpoint the pool
	// fallback (see internal/extension/chain.go) uses to quote live pool
	// reserves — without it, pool fallback is disabled the same way FSA is.
	// InstructionSender pins signed off-chain requests to this deployment
	// (from config/extension.env via the compose env_file). VaultAddress is
	// the NyxSwapVault this TEE signs fillFromPool/withdraw authorizations
	// for — it's the contract address hashed into those signatures, distinct
	// from InstructionSender.
	ChainURL                string
	MasterAccountController = DefaultMasterAccountController
	InstructionSender       string
	VaultAddress            string
)

// TradingPairConfig maps a pair name to its base/quote token addresses and
// the on-chain pool used as a fallback for whatever the orderbook can't
// match peer-to-peer. PoolAddress may be the zero address, meaning this pair
// has no pool fallback configured — unmatched remainders just rest.
type TradingPairConfig struct {
	Name        string         `json:"name"`
	BaseToken   common.Address `json:"baseToken"`
	QuoteToken  common.Address `json:"quoteToken"`
	PoolAddress common.Address `json:"poolAddress"`
}

// LoadTradingPairs reads a JSON file of trading pair configs.
func LoadTradingPairs(path string) ([]TradingPairConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var pairs []TradingPairConfig
	if err := json.Unmarshal(data, &pairs); err != nil {
		return nil, err
	}
	return pairs, nil
}

// TradingPairs is the list of configured trading pairs, loaded at init from
// PAIRS_CONFIG (default config/pairs.json — see that file for NyxSwap's
// three pairs; addresses there are placeholders until real deployments exist).
var TradingPairs []TradingPairConfig

// Environment variables override defaults.
func init() {
	if v := os.Getenv("EXTENSION_PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			ExtensionPort = n
		}
	}
	if v := os.Getenv("SIGN_PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			SignPort = n
		}
	}
	if v := os.Getenv("TYPES_SERVER_PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			TypesServerPort = n
		}
	}
	if v := os.Getenv("BALANCES_PATH"); v != "" {
		BalancesPath = v
	}
	if v := os.Getenv("CHAIN_URL"); v != "" {
		ChainURL = v
	}
	if v := os.Getenv("MASTER_ACCOUNT_CONTROLLER"); v != "" {
		MasterAccountController = v
	}
	if v := os.Getenv("INSTRUCTION_SENDER"); v != "" {
		InstructionSender = v
	}
	if v := os.Getenv("VAULT_ADDRESS"); v != "" {
		VaultAddress = v
	}
	if v := os.Getenv("ADMIN_ADDRESSES"); v != "" {
		for _, addr := range strings.Split(v, ",") {
			addr = strings.TrimSpace(addr)
			if addr != "" {
				AdminAddresses = append(AdminAddresses, strings.ToLower(addr))
			}
		}
	}

	// Load trading pairs from config file if it exists.
	pairsPath := os.Getenv("PAIRS_CONFIG")
	if pairsPath == "" {
		pairsPath = "config/pairs.json"
	}
	pairs, err := LoadTradingPairs(pairsPath)
	if err != nil {
		logger.Infof("no trading pairs config loaded from %s: %v (will use defaults)", pairsPath, err)
		return
	}
	TradingPairs = pairs
}
