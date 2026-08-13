#!/usr/bin/env bash
# Deploys the tokens listed in script/mocks/testTokens.json and merges their
# addresses into ../nextjs/contracts/deployedContracts.ts. Thin wrapper around
# scripts-js/deployTestTokens.js, which does the forge invocation + broadcast
# parsing (needs Node for the prettier-formatted deployedContracts.ts write).
#
# Usage:
#   script/shell/deploy-test-tokens.sh --network coston2 --keystore coston2-deployer [--password-file <path>]
#   script/shell/deploy-test-tokens.sh --restore-only   # no deploy, no gas — just re-merge known addresses
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
node scripts-js/deployTestTokens.js "$@"
