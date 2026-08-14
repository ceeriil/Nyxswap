// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { DeployNyxToken } from "../script/deploy/DeployNyxToken.s.sol";
import { NyxToken } from "../contracts/token/NyxToken.sol";
import { NyxSwapLiquidityMining } from "../contracts/NyxSwapLiquidityMining.sol";

contract DeployNyxTokenTest is Test {
    function test_RunDeploysTokenAndMiningWiredTogether() public {
        DeployNyxToken deployScript = new DeployNyxToken();
        deployScript.run();

        (string memory tokenName, address tokenAddress) = deployScript.deployments(0);
        assertEq(tokenName, "NyxToken");

        (string memory miningName, address miningAddress) = deployScript.deployments(1);
        assertEq(miningName, "NyxSwapLiquidityMining");

        NyxToken nyxToken = NyxToken(tokenAddress);
        assertEq(nyxToken.minter(), miningAddress);

        NyxSwapLiquidityMining mining = NyxSwapLiquidityMining(miningAddress);
        assertEq(address(mining.nyxToken()), tokenAddress);
        assertEq(mining.nyxPerSecond(), 1 ether);
        assertEq(mining.poolLength(), 0);

        // Minter wiring actually works end-to-end, not just pointed at the right address.
        vm.prank(miningAddress);
        nyxToken.mint(address(0xBEEF), 1 ether);
        assertEq(nyxToken.balanceOf(address(0xBEEF)), 1 ether);
    }
}
