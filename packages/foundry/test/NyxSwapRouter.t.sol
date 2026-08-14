// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { NyxSwapRouter } from "../contracts/NyxSwapRouter.sol";
import { NyxSwapPool } from "../contracts/NyxSwapPool.sol";
import { INyxSwapPool } from "../contracts/interfaces/INyxSwapPool.sol";
import { IERC20 as INyxIERC20 } from "../contracts/interfaces/IERC20.sol";
import { SeedTokenFactory } from "../contracts/token/SeedTokenFactory.sol";
import { SeedToken } from "../contracts/token/SeedToken.sol";

contract NyxSwapRouterTest is Test {
    NyxSwapRouter router;
    SeedTokenFactory factory;

    address tokenA;
    address tokenB;
    address tokenC;

    NyxSwapPool poolAB;
    NyxSwapPool poolBC;

    address trader = address(0xBEEF);

    function setUp() public {
        router = new NyxSwapRouter();
        factory = new SeedTokenFactory();

        tokenA = factory.deployToken("Token A", "AAA");
        tokenB = factory.deployToken("Token B", "BBB");
        tokenC = factory.deployToken("Token C", "CCC");

        poolAB = new NyxSwapPool(INyxIERC20(tokenA), INyxIERC20(tokenB));
        poolBC = new NyxSwapPool(INyxIERC20(tokenB), INyxIERC20(tokenC));

        SeedToken(tokenA).approve(address(poolAB), type(uint256).max);
        SeedToken(tokenB).approve(address(poolAB), type(uint256).max);
        SeedToken(tokenB).approve(address(poolBC), type(uint256).max);
        SeedToken(tokenC).approve(address(poolBC), type(uint256).max);

        poolAB.addReserves(100_000 ether, 100_000 ether);
        poolBC.addReserves(100_000 ether, 100_000 ether);

        router.registerPool(INyxSwapPool(address(poolAB)));
        router.registerPool(INyxSwapPool(address(poolBC)));

        SeedToken(tokenA).mint(1_000 ether);
        SeedToken(tokenA).transfer(trader, 1_000 ether);
    }

    function test_RegisterPoolMapsBothDirections() public {
        assertEq(address(router.poolFor(tokenA, tokenB)), address(poolAB));
        assertEq(address(router.poolFor(tokenB, tokenA)), address(poolAB));
    }

    function test_RegisterPoolRevertsOnDuplicate() public {
        vm.expectRevert(NyxSwapRouter.PoolAlreadyRegistered.selector);
        router.registerPool(INyxSwapPool(address(poolAB)));
    }

    function test_SingleHopSwapMatchesQuote() public {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;

        uint256[] memory quoted = router.getAmountsOut(100 ether, path);

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(router), 100 ether);
        uint256[] memory amounts = router.swapExactTokensForTokens(100 ether, quoted[1], path, trader, block.timestamp);
        vm.stopPrank();

        assertEq(amounts[1], quoted[1]);
        assertEq(SeedToken(tokenB).balanceOf(trader), quoted[1]);
        assertEq(SeedToken(tokenA).balanceOf(trader), 900 ether);
    }

    function test_MultiHopSwapChainsThroughBothPools() public {
        address[] memory path = new address[](3);
        path[0] = tokenA;
        path[1] = tokenB;
        path[2] = tokenC;

        uint256[] memory quoted = router.getAmountsOut(100 ether, path);
        assertEq(quoted.length, 3);

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(router), 100 ether);
        uint256[] memory amounts = router.swapExactTokensForTokens(100 ether, quoted[2], path, trader, block.timestamp);
        vm.stopPrank();

        assertEq(amounts[2], quoted[2]);
        assertEq(SeedToken(tokenC).balanceOf(trader), quoted[2]);
        // Router shouldn't retain any of the intermediate token.
        assertEq(SeedToken(tokenB).balanceOf(address(router)), 0);
    }

    function test_SwapRevertsWhenOutputBelowMinimum() public {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(router), 100 ether);
        vm.expectRevert(NyxSwapRouter.InsufficientOutputAmount.selector);
        router.swapExactTokensForTokens(100 ether, 1_000_000 ether, path, trader, block.timestamp);
        vm.stopPrank();
    }

    function test_SwapRevertsAfterDeadline() public {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(router), 100 ether);
        vm.expectRevert(NyxSwapRouter.Expired.selector);
        router.swapExactTokensForTokens(100 ether, 0, path, trader, block.timestamp - 1);
        vm.stopPrank();
    }

    function test_SwapRevertsForUnregisteredPair() public {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenC;

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(router), 100 ether);
        vm.expectRevert(abi.encodeWithSelector(NyxSwapRouter.PoolNotFound.selector, tokenA, tokenC));
        router.swapExactTokensForTokens(100 ether, 0, path, trader, block.timestamp);
        vm.stopPrank();
    }

    function test_GetAmountsOutRevertsForShortPath() public {
        address[] memory path = new address[](1);
        path[0] = tokenA;

        vm.expectRevert(NyxSwapRouter.PathTooShort.selector);
        router.getAmountsOut(100 ether, path);
    }
}
