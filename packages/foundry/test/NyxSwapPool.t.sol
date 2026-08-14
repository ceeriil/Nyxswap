// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { NyxSwapPool } from "../contracts/NyxSwapPool.sol";
import { INyxSwapPriceOracle } from "../contracts/interfaces/INyxSwapPriceOracle.sol";
import { IERC20 as INyxIERC20 } from "../contracts/interfaces/IERC20.sol";
import { SeedTokenFactory } from "../contracts/token/SeedTokenFactory.sol";
import { SeedToken } from "../contracts/token/SeedToken.sol";

/// @dev Injectable fake oracle — lets tests drive NyxSwapPool's deviation check without
/// a live FTSOv2 feed. Both tokens default to $1 @ 5 decimals once priced, matching a
/// balanced 1:1 pool so a normal swap starts out "at the oracle price."
contract MockPriceOracle is INyxSwapPriceOracle {
    mapping(address => bool) public hasFeedFor;
    mapping(address => uint256) public priceOf;
    int8 public constant DECIMALS = 5;

    function setPrice(address token, uint256 price) external {
        hasFeedFor[token] = true;
        priceOf[token] = price;
    }

    function clearFeed(address token) external {
        hasFeedFor[token] = false;
    }

    function hasFeed(address token) external view returns (bool) {
        return hasFeedFor[token];
    }

    function getPrice(address token) external view returns (uint256 value, int8 decimals, uint64 timestamp) {
        return (priceOf[token], DECIMALS, uint64(block.timestamp));
    }
}

contract NyxSwapPoolTest is Test {
    SeedTokenFactory factory;
    MockPriceOracle oracle;

    address tokenA;
    address tokenB;

    address trader = address(0xBEEF);

    function setUp() public {
        factory = new SeedTokenFactory();
        oracle = new MockPriceOracle();

        tokenA = factory.deployToken("Token A", "AAA");
        tokenB = factory.deployToken("Token B", "BBB");

        // Both tokens priced at $1 — a balanced 1:1 pool starts exactly at the oracle price.
        oracle.setPrice(tokenA, 1e5);
        oracle.setPrice(tokenB, 1e5);

        SeedToken(tokenA).mint(1_000 ether);
        SeedToken(tokenA).transfer(trader, 1_000 ether);
    }

    function _newPool(INyxSwapPriceOracle o, uint256 maxDeviationBps) internal returns (NyxSwapPool p) {
        p = new NyxSwapPool(INyxIERC20(tokenA), INyxIERC20(tokenB), o, maxDeviationBps);
        SeedToken(tokenA).approve(address(p), type(uint256).max);
        SeedToken(tokenB).approve(address(p), type(uint256).max);
        p.addReserves(100_000 ether, 100_000 ether);
    }

    function test_SwapSucceedsWithNoOracleConfigured() public {
        NyxSwapPool pool = _newPool(INyxSwapPriceOracle(address(0)), 0);

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(pool), 100 ether);
        uint256 out = pool.swap(true, 100 ether, 0);
        vm.stopPrank();

        assertGt(out, 0);
    }

    function test_SwapSucceedsWhenEitherTokenHasNoFeed() public {
        oracle.clearFeed(tokenB);
        NyxSwapPool pool = _newPool(oracle, 0); // 0 bps tolerance — would revert if the check ran

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(pool), 100 ether);
        uint256 out = pool.swap(true, 100 ether, 0);
        vm.stopPrank();

        assertGt(out, 0);
    }

    function test_SwapSucceedsWithinDeviationBound() public {
        // Balanced 1:1 pool, 0.3% swap fee — a small swap's output naturally lands
        // just under 1:1, well inside a 100bps (1%) tolerance.
        NyxSwapPool pool = _newPool(oracle, 100);

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(pool), 100 ether);
        uint256 out = pool.swap(true, 100 ether, 0);
        vm.stopPrank();

        assertApproxEqRel(out, 100 ether, 0.01e18);
    }

    function test_SwapRevertsWhenOracleDeviationExceeded() public {
        // Reprice tokenB at $2 post-pool-creation — the pool still thinks it's 1:1, so
        // every swap is now ~100% off the oracle's cross price.
        oracle.setPrice(tokenB, 2e5);
        NyxSwapPool pool = _newPool(oracle, 100); // 1% tolerance

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(pool), 100 ether);
        vm.expectRevert("NyxSwap: price deviation too high");
        pool.swap(true, 100 ether, 0);
        vm.stopPrank();
    }

    function test_SwapSucceedsWhenRepricedWithinToleranceBound() public {
        // 2% real price move, 500bps (5%) tolerance — should still pass.
        oracle.setPrice(tokenB, 1.02e5);
        NyxSwapPool pool = _newPool(oracle, 500);

        vm.startPrank(trader);
        SeedToken(tokenA).approve(address(pool), 100 ether);
        uint256 out = pool.swap(true, 100 ether, 0);
        vm.stopPrank();

        assertGt(out, 0);
    }
}
