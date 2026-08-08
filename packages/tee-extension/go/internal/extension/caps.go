package extension

// In-memory size caps for bounded per-user history. `var`, not `const`, so
// tests can override them.
var (
	MaxUserDepositsHistory  = 200
	MaxUserWithdrawsHistory = 200
)

// appendBounded appends v to s and trims the head so len(s) <= maxLen.
func appendBounded[T any](s []T, v T, maxLen int) []T {
	s = append(s, v)
	if maxLen > 0 && len(s) > maxLen {
		s = s[len(s)-maxLen:]
	}
	return s
}
