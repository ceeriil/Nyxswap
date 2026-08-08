package extension

import (
	"fmt"

	"github.com/ethereum/go-ethereum/common"
)

// requireBoundContract pins a signed off-chain request to this deployment's
// InstructionSender, so a signature captured against one deployment can't be
// replayed against another.
//
// This is the one piece of the reference's FSA support pulled in without its
// XRPL half (fsa_bind_sig.go's processBindSessionSig, and the XRPL signature
// verification it depends on) — that's a much bigger, security-sensitive
// undertaking (parsing signed XRPL transaction blobs, verifying an XRPL
// signature, resolving a PersonalAccount via an on-chain MasterAccountController
// call) that hasn't been ported here. Until it is, fsaStore never gets a
// binding written to it, so WITHDRAW_REQUEST's authorization check always
// falls back to "the signer must be the user themselves" — a safe default,
// not a broken one, but BIND_SESSION_SIG/GET_BINDING have no handlers yet
// and requesting them 501s.
func requireBoundContract(got, want common.Address) error {
	if want == (common.Address{}) {
		return fmt.Errorf("INSTRUCTION_SENDER not configured on this TEE")
	}
	if got != want {
		return fmt.Errorf("request is for contract %s, this TEE serves %s", got.Hex(), want.Hex())
	}
	return nil
}
