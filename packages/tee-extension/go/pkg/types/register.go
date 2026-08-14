package types

import (
	"extension-scaffold/internal/config"
	"extension-scaffold/pkg/decoder"
)

// RegisterDecoders registers all type decoders for the trading extension.
//
// DEPOSIT and WITHDRAW's on-chain messages are ABI-encoded tuples, decoded
// directly in internal/extension/deposit.go and withdraw.go via
// abi.Arguments{...}.Unpack — not through this registry. Registering an
// ABIDecoder here would require independently reconstructing the exact
// tuple type (component order, names, abi tags matching structs.DecodeTo's
// expectations) with no compiler in this sandbox to catch a mismatch; a
// wrong tuple type wouldn't fail to compile, it would silently misdecode in
// the types-server sidecar only. Since that sidecar is a debugging aid, not
// load-bearing for the extension itself, the message-side registrations for
// DEPOSIT/WITHDRAW are deliberately left out rather than guessed at. Their
// result types (JSON) are registered below.
func RegisterDecoders(r *decoder.Registry) {
	// SWAP message + result
	r.Register(
		decoder.RegistryKey{OPType: config.OPTypeTrading, OPCommand: config.OPCommandSwap, Kind: decoder.KindMessage},
		decoder.NewJSONDecoder[SwapRequest](),
	)
	r.Register(
		decoder.RegistryKey{OPType: config.OPTypeTrading, OPCommand: config.OPCommandSwap, Kind: decoder.KindResult},
		decoder.NewJSONDecoder[SwapResponse](),
	)

	// CANCEL_SWAP message + result
	r.Register(
		decoder.RegistryKey{OPType: config.OPTypeTrading, OPCommand: config.OPCommandCancelSwap, Kind: decoder.KindMessage},
		decoder.NewJSONDecoder[CancelSwapRequest](),
	)
	r.Register(
		decoder.RegistryKey{OPType: config.OPTypeTrading, OPCommand: config.OPCommandCancelSwap, Kind: decoder.KindResult},
		decoder.NewJSONDecoder[CancelSwapResponse](),
	)

	// GET_MY_STATE message + result
	r.Register(
		decoder.RegistryKey{OPType: config.OPTypeTrading, OPCommand: config.OPCommandGetMyState, Kind: decoder.KindMessage},
		decoder.NewJSONDecoder[GetMyStateRequest](),
	)
	r.Register(
		decoder.RegistryKey{OPType: config.OPTypeTrading, OPCommand: config.OPCommandGetMyState, Kind: decoder.KindResult},
		decoder.NewJSONDecoder[GetMyStateResponse](),
	)

	// DEPOSIT result (message is ABI-encoded — see doc comment above)
	r.Register(
		decoder.RegistryKey{OPType: config.OPTypeTrading, OPCommand: config.OPCommandDeposit, Kind: decoder.KindResult},
		decoder.NewJSONDecoder[DepositResponse](),
	)

	// WITHDRAW result (message is ABI-encoded — see doc comment above)
	r.Register(
		decoder.RegistryKey{OPType: config.OPTypeTrading, OPCommand: config.OPCommandWithdraw, Kind: decoder.KindResult},
		decoder.NewJSONDecoder[WithdrawResponse](),
	)

	// WITHDRAW_REQUEST message + result — both JSON, unlike the on-chain pair above.
	r.Register(
		decoder.RegistryKey{OPType: config.OPTypeTrading, OPCommand: config.OPCommandWithdrawRequest, Kind: decoder.KindMessage},
		decoder.NewJSONDecoder[WithdrawRequestPayload](),
	)
	r.Register(
		decoder.RegistryKey{OPType: config.OPTypeTrading, OPCommand: config.OPCommandWithdrawRequest, Kind: decoder.KindResult},
		decoder.NewJSONDecoder[WithdrawResponse](),
	)
}
