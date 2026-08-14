// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { NyxSwapRouter } from "../contracts/NyxSwapRouter.sol";
import { NyxSwapPool } from "../contracts/NyxSwapPool.sol";
import { INyxSwapPriceOracle } from "../contracts/interfaces/INyxSwapPriceOracle.sol";
import { IERC20 as INyxIERC20 } from "../contracts/interfaces/IERC20.sol";
import { SeedTokenFactory } from "../contracts/token/SeedTokenFactory.sol";
import { SeedToken } from "../contracts/token/SeedToken.sol";

contract NyxSwapRouterTest is Test {
    NyxSwapRouter router;
    SeedTokenFactory factory;

    address tokenA;
    address tokenB;
    address tokenC;

    address poolAB;
    address poolBC;

    address trader = address(0xBEEF);

    function setUp() public {
        router = new NyxSwapRouter(INyxSwapPriceOracle(address(0)), 0);
        factory = new SeedTokenFactory();

        tokenA = factory.deployToken("Token A", "AAA");
        tokenB = factory.deployToken("Token B", "BBB");
        tokenC = factory.deployToken("Token C", "CCC");

        poolAB = router.createPool(INyxIERC20(tokenA), INyxIERC20(tokenB));
        poolBC = router.createPool(INyxIERC20(tokenB), INyxIERC20(tokenC));

        SeedToken(tokenA).approve(poolAB, type(uint256).max);
        SeedToken(tokenB).approve(poolAB, type(uint256).max);
        SeedToken(tokenB).approve(poolBC, type(uint256).max);
        SeedToken(tokenC).approve(poolBC, type(uint256).max);

        NyxSwapPool(poolAB).addReserves(100_000 ether, 100_000 ether);
        NyxSwapPool(poolBC).addReserves(100_000 ether, 100_000 ether);

        SeedToken(tokenA).mint(1_000 ether);
        SeedToken(tokenA).transfer(trader, 1_000 ether);
    }

    function test_CreatePoolDeploysARealPoolMappedBothDirections() public {
        assertEq(address(router.poolFor(tokenA, tokenB)), poolAB);
        assertEq(address(router.poolFor(tokenB, tokenA)), poolAB);

        // Router doesn't just trust an address — it deployed this pool itself, so it's
        // provably a real NyxSwapPool wired to the exact tokens asked for.
        assertEq(address(NyxSwapPool(poolAB).tokenA()), tokenA);
        assertEq(address(NyxSwapPool(poolAB).tokenB()), tokenB);
    }

    function test_CreatePoolRevertsOnDuplicate() public {
        vm.expectRevert(NyxSwapRouter.PoolAlreadyExists.selector);
        router.createPool(INyxIERC20(tokenA), INyxIERC20(tokenB));
    }

    function test_CreatePoolRevertsOnIdenticalTokens() public {
        // Bubbles up from NyxSwapPool's own constructor — the router doesn't duplicate
        // this check, since the pool it deploys already enforces it.
        vm.expectRevert("NyxSwap: identical tokens");
        router.createPool(INyxIERC20(tokenA), INyxIERC20(tokenA));
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

    function test_SwapRevertsForShortPath() public {
        address[] memory path = new address[](1);
        path[0] = tokenA;

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(router), 100 ether);
        vm.expectRevert(NyxSwapRouter.PathTooShort.selector);
        router.swapExactTokensForTokens(100 ether, 0, path, trader, block.timestamp);
        vm.stopPrank();
    }

    function test_SwapRevertsForZeroRecipient() public {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(router), 100 ether);
        vm.expectRevert(NyxSwapRouter.ZeroAddress.selector);
        router.swapExactTokensForTokens(100 ether, 0, path, address(0), block.timestamp);
        vm.stopPrank();
    }

    function test_SwapRevertsWhenRecipientIsRouter() public {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(router), 100 ether);
        vm.expectRevert(NyxSwapRouter.CannotSendToRouter.selector);
        router.swapExactTokensForTokens(100 ether, 0, path, address(router), block.timestamp);
        vm.stopPrank();
    }

    function test_GetAmountsOutRevertsForShortPath() public {
        address[] memory path = new address[](1);
        path[0] = tokenA;

        vm.expectRevert(NyxSwapRouter.PathTooShort.selector);
        router.getAmountsOut(100 ether, path);
    }
}
