// Package teesign talks to the local TEE sign server — the only thing in
// this deployment with access to the TEE's private key. Every signature
// this extension ever produces (withdrawal slips, pool-fill authorizations)
// goes through a Client, which is why it's its own package rather than a
// method tucked inside whichever feature happened to need it first.
package teesign

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/flare-foundation/go-flare-common/pkg/logger"
	teetypes "github.com/flare-foundation/tee-node/pkg/types"
)

// Client posts raw messages to the sign server running on the same host.
type Client struct {
	port int
}

// NewClient builds a Client for the sign server on localhost:port.
func NewClient(port int) *Client {
	return &Client{port: port}
}

// Sign sends raw message bytes to the sign server, which keccak256's them
// and signs the EIP-191-prefixed digest — matching every on-chain
// _recoverSigner/ecrecover call this extension's authorizations are
// verified against (NyxSwapVault.withdraw, NyxSwapVault.fillFromPool).
func (c *Client) Sign(message []byte) ([]byte, error) {
	reqBody, _ := json.Marshal(teetypes.SignRequest{Message: message})

	url := fmt.Sprintf("http://localhost:%d/sign", c.port)
	resp, err := http.Post(url, "application/json", bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("POST /sign: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sign server returned %d", resp.StatusCode)
	}

	var signResp teetypes.SignResponse
	if err := json.NewDecoder(resp.Body).Decode(&signResp); err != nil {
		return nil, fmt.Errorf("decoding sign response: %w", err)
	}

	logger.Infof("message signed: %x", signResp.Signature[:8])
	return signResp.Signature, nil
}
