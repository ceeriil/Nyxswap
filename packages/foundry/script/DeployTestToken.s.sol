//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { FlrTestToken } from "../contracts/mocks/FlrTestToken.sol";

/**
 * @notice Deploys the FLR test token faucet uses on testnets.
 * @dev Run with: yarn deploy --file DeployTestToken.s.sol --network coston2
 */
contract DeployTestToken is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        FlrTestToken flrTestToken = new FlrTestToken("Flare (Test)", "FLR", 18);
        deployments.push(Deployment("FlrTestToken", address(flrTestToken)));
    }
}
