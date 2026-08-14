//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeployHelpers.s.sol";
import { NyxToken } from "../../contracts/token/NyxToken.sol";
import { NyxSwapLiquidityMining } from "../../contracts/NyxSwapLiquidityMining.sol";

/**
 * @notice Deploys NyxToken and NyxSwapLiquidityMining, and wires the mining contract as
 * NyxToken's minter. Emission starts immediately (startTime = now) at a flat testnet
 * default of 1 NYX/second — adjust NYX_PER_SECOND before running if that's wrong for
 * your demo's timescale, it's immutable once deployed.
 *
 * Doesn't call addPool() for anything — NyxSwapPool addresses come from
 * DeployNyxSwapPools.s.sol, which must run first. Register each pool's LP-share token
 * (the NyxSwapPool contract itself) afterward via NyxSwapLiquidityMining.addPool().
 * @dev Run with: yarn deploy --file deploy/DeployNyxToken.s.sol --network coston2
 */
contract DeployNyxToken is ScaffoldETHDeploy {
    uint256 constant NYX_PER_SECOND = 1 ether;

    function run() external ScaffoldEthDeployerRunner {
        NyxToken nyxToken = new NyxToken(deployer);
        deployments.push(Deployment("NyxToken", address(nyxToken)));

        NyxSwapLiquidityMining mining = new NyxSwapLiquidityMining(deployer, nyxToken, NYX_PER_SECOND, block.timestamp);
        deployments.push(Deployment("NyxSwapLiquidityMining", address(mining)));

        nyxToken.setMinter(address(mining));
    }
}
