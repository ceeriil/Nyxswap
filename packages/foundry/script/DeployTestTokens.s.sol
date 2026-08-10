//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { MintableTestToken } from "../contracts/mocks/MintableTestToken.sol";

/**
 * @notice Deploys MintableTestToken once per test-token symbol. One generic
 * contract, deployed multiple times with different constructor args — not a
 * distinct .sol file per token. Order here (USDT, BTC, ETH) is load-bearing:
 * scripts-js/deployTestTokens.js matches broadcast transactions back to token
 * keys by this same order, since every deployment shares the literal
 * contract name "MintableTestToken" and can't be told apart by name.
 * @dev Run via scripts-js/deployTestTokens.js, not `yarn deploy` directly.
 */
contract DeployTestTokens is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        MintableTestToken usdt = new MintableTestToken("Tether USD (Test)", "USDT", 6);
        deployments.push(Deployment("UsdtTestToken", address(usdt)));

        MintableTestToken btc = new MintableTestToken("Bitcoin (Test)", "BTC", 8);
        deployments.push(Deployment("BtcTestToken", address(btc)));

        MintableTestToken eth = new MintableTestToken("Ether (Test)", "ETH", 18);
        deployments.push(Deployment("EthTestToken", address(eth)));
    }
}
