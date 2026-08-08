// Package history holds bounded per-user deposit/withdrawal history, in
// memory only — like balances and orderbooks, it doesn't survive a
// restart. It's a package of its own purely for encapsulation: callers
// record events through Store's methods rather than reaching into raw
// maps, so the bounding logic (MaxDeposits/MaxWithdrawals) can't be
// bypassed by a call site that forgets to apply it.
package history

import (
	"sync"

	"extension-scaffold/pkg/types"
)

// Bounded per-user history sizes. vars, not consts, so tests can override
// them.
var (
	MaxDeposits    = 200
	MaxWithdrawals = 200
)

// Store guards its own state, like balance.Manager and fsa.Store — callers
// don't need to hold any lock of their own around Store's methods.
type Store struct {
	mu          sync.Mutex
	deposits    map[string][]types.DepositRecord
	withdrawals map[string][]types.WithdrawalRecord
}

func NewStore() *Store {
	return &Store{
		deposits:    make(map[string][]types.DepositRecord),
		withdrawals: make(map[string][]types.WithdrawalRecord),
	}
}

// RecordDeposit appends a deposit record for user, trimming to MaxDeposits.
func (s *Store) RecordDeposit(user string, rec types.DepositRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deposits[user] = appendBounded(s.deposits[user], rec, MaxDeposits)
}

// RecordWithdrawal appends a withdrawal record for user, trimming to MaxWithdrawals.
func (s *Store) RecordWithdrawal(user string, rec types.WithdrawalRecord) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.withdrawals[user] = appendBounded(s.withdrawals[user], rec, MaxWithdrawals)
}

// appendBounded appends v to s and trims the head so len(s) <= maxLen.
func appendBounded[T any](s []T, v T, maxLen int) []T {
	s = append(s, v)
	if maxLen > 0 && len(s) > maxLen {
		s = s[len(s)-maxLen:]
	}
	return s
}
