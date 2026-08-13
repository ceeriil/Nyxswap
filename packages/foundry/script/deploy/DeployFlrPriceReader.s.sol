//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { FlrPriceReader } from "../../contracts/FlrPriceReader.sol";

/**
 * @notice Deploys FlrPriceReader, which reads FLR/USD off Flare's FTSOv2 oracle.
 * @dev Run with: yarn deploy --file DeployFlrPriceReader.s.sol --network coston2
 */
contract DeployFlrPriceReader is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        FlrPriceReader flrPriceReader = new FlrPriceReader();
        deployments.push(Deployment("FlrPriceReader", address(flrPriceReader)));
    }
}
