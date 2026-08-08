package decoder

import (
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/flare-foundation/go-flare-common/pkg/tee/structs"
)

// ABIDecoder decodes ABI-encoded bytes into a value of type T.
//
// Uses structs.DecodeTo (pointer-target form) rather than a generic
// structs.Decode[T], since that's the form already proven to compile
// against this repo's pinned go-flare-common version — see the original
// scaffold's SAY_GOODBYE handler, which used this exact call shape.
type ABIDecoder[T any] struct {
	arg abi.Argument
}

// NewABIDecoder creates an ABIDecoder for the given ABI argument.
func NewABIDecoder[T any](arg abi.Argument) *ABIDecoder[T] {
	return &ABIDecoder[T]{arg: arg}
}

func (d *ABIDecoder[T]) Decode(data []byte) (any, error) {
	var v T
	if err := structs.DecodeTo(d.arg, data, &v); err != nil {
		return nil, err
	}
	return v, nil
}
