// Package balance tracks per-(user, token) available/held balances entirely
// in TEE memory — nothing here is written to chain or logged anywhere. See
// NyxSwapVault.sol's header for why deposit/withdraw are the only things
// that touch the chain; everything in between is this manager's job.
package balance

import (
	"errors"
	"sync"

	"github.com/ethereum/go-ethereum/common"
)

var (
	ErrInsufficientBalance = errors.New("insufficient available balance")
	ErrInsufficientHeld    = errors.New("insufficient held balance")
	ErrZeroAmount          = errors.New("amount must be greater than zero")
)

// TokenBalance tracks a user's balance for a single token.
type TokenBalance struct {
	Available uint64 `json:"available"` // free to use for new orders or withdrawal
	Held      uint64 `json:"held"`      // locked by open orders
}

// Manager tracks per-(user, token) balances. All state is in-memory unless
// SetPersistPath (see persist.go) has been called.
type Manager struct {
	mu          sync.RWMutex
	balances    map[string]map[common.Address]*TokenBalance // user -> token -> balance
	persistPath string                                      // "" disables persistence
}

// NewManager creates an empty balance manager.
func NewManager() *Manager {
	return &Manager{balances: make(map[string]map[common.Address]*TokenBalance)}
}

// Deposit credits the user's available balance. Called from the DEPOSIT
// on-chain instruction handler once the deposit has actually landed on-chain.
func (m *Manager) Deposit(user string, token common.Address, amount uint64) error {
	if amount == 0 {
		return ErrZeroAmount
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	tb := m.getOrCreate(user, token)
	tb.Available += amount
	return m.save()
}

// Withdraw debits the user's available balance. Called from the WITHDRAW
// instruction handler before the TEE signs a release.
func (m *Manager) Withdraw(user string, token common.Address, amount uint64) error {
	if amount == 0 {
		return ErrZeroAmount
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	tb := m.getOrCreate(user, token)
	if tb.Available < amount {
		return ErrInsufficientBalance
	}
	tb.Available -= amount
	return m.save()
}

// Hold moves funds from available to held — called when placing an order.
func (m *Manager) Hold(user string, token common.Address, amount uint64) error {
	if amount == 0 {
		return ErrZeroAmount
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	tb := m.getOrCreate(user, token)
	if tb.Available < amount {
		return ErrInsufficientBalance
	}
	tb.Available -= amount
	tb.Held += amount
	return m.save()
}

// Release moves funds from held back to available — called when cancelling
// an order, or refunding the unused portion of a market order's hold.
func (m *Manager) Release(user string, token common.Address, amount uint64) error {
	if amount == 0 {
		return ErrZeroAmount
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	tb := m.getOrCreate(user, token)
	if tb.Held < amount {
		return ErrInsufficientHeld
	}
	tb.Held -= amount
	tb.Available += amount
	return m.save()
}

// Transfer debits held funds from one user and credits available funds to
// another — called when a match executes: the seller's held base token goes
// to the buyer, and the buyer's held quote token goes to the seller.
func (m *Manager) Transfer(from, to string, token common.Address, amount uint64) error {
	if amount == 0 {
		return ErrZeroAmount
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	fromBal := m.getOrCreate(from, token)
	if fromBal.Held < amount {
		return ErrInsufficientHeld
	}
	fromBal.Held -= amount

	toBal := m.getOrCreate(to, token)
	toBal.Available += amount
	return m.save()
}

// SpendHeld debits held funds without crediting anything back — used when
// held funds leave the TEE-tracked ledger entirely via a different path than
// Transfer's peer-to-peer settlement, e.g. a pool-fallback fill where the
// input token is swapped on-chain and the output token is credited
// separately via Deposit once the swap's outcome is known.
func (m *Manager) SpendHeld(user string, token common.Address, amount uint64) error {
	if amount == 0 {
		return ErrZeroAmount
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	tb := m.getOrCreate(user, token)
	if tb.Held < amount {
		return ErrInsufficientHeld
	}
	tb.Held -= amount
	return m.save()
}

// Get returns a copy of the user's balance for a single token.
func (m *Manager) Get(user string, token common.Address) TokenBalance {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if byToken, ok := m.balances[user]; ok {
		if tb, ok := byToken[token]; ok {
			return *tb
		}
	}
	return TokenBalance{}
}

// GetAll returns a copy of all of the user's token balances, or nil if the
// user has never had one.
func (m *Manager) GetAll(user string) map[common.Address]TokenBalance {
	m.mu.RLock()
	defer m.mu.RUnlock()
	byToken, ok := m.balances[user]
	if !ok {
		return nil
	}
	out := make(map[common.Address]TokenBalance, len(byToken))
	for token, tb := range byToken {
		out[token] = *tb
	}
	return out
}

// AvailableBalance returns just the available amount, 0 if the user/token
// combination has never had a balance.
func (m *Manager) AvailableBalance(user string, token common.Address) uint64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if byToken, ok := m.balances[user]; ok {
		if tb, ok := byToken[token]; ok {
			return tb.Available
		}
	}
	return 0
}

func (m *Manager) getOrCreate(user string, token common.Address) *TokenBalance {
	byToken, ok := m.balances[user]
	if !ok {
		byToken = make(map[common.Address]*TokenBalance)
		m.balances[user] = byToken
	}
	tb, ok := byToken[token]
	if !ok {
		tb = &TokenBalance{}
		byToken[token] = tb
	}
	return tb
}
