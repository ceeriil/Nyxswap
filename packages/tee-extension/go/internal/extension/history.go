package extension

import "extension-scaffold/pkg/types"

// History holds bounded per-user deposit/withdrawal history, in memory only —
// like balances and orderbooks, it doesn't survive a restart. Guarded by
// Extension.mu, same as every other mutable field on Extension.
type History struct {
	deposits    map[string][]types.DepositRecord
	withdrawals map[string][]types.WithdrawalRecord
}

func newHistory() *History {
	return &History{
		deposits:    make(map[string][]types.DepositRecord),
		withdrawals: make(map[string][]types.WithdrawalRecord),
	}
}
