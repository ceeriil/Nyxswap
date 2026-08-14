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

    // --- LP shares ---

    address lp2 = address(0x1111);

    function test_FirstDepositLocksMinimumLiquidityAndMintsRemainderToProvider() public {
        NyxSwapPool pool = _newPool(INyxSwapPriceOracle(address(0)), 0);

        // _newPool's addReserves(100_000 ether, 100_000 ether) is the first deposit.
        uint256 expected = 100_000 ether - pool.MINIMUM_LIQUIDITY();
        assertEq(pool.balanceOf(firstLp()), expected);
        assertEq(pool.balanceOf(address(pool)), pool.MINIMUM_LIQUIDITY());
        assertEq(pool.totalSupply(), 100_000 ether);
    }

    function test_SecondDepositAtSameRatioMintsProportionalShares() public {
        NyxSwapPool pool = _newPool(INyxSwapPriceOracle(address(0)), 0);
        uint256 supplyBefore = pool.totalSupply();

        vm.startPrank(lp2);
        SeedToken(tokenA).mint(10_000 ether);
        SeedToken(tokenB).mint(10_000 ether);
        SeedToken(tokenA).approve(address(pool), 10_000 ether);
        SeedToken(tokenB).approve(address(pool), 10_000 ether);
        // Depositing exactly 10% of the existing 100_000/100_000 reserves.
        uint256 minted = pool.addReserves(10_000 ether, 10_000 ether);
        vm.stopPrank();

        assertEq(minted, supplyBefore / 10);
        assertEq(pool.balanceOf(lp2), minted);
    }

    function test_AddReservesRevertsWhenMintedLiquidityRoundsToZero() public {
        NyxSwapPool pool = _newPool(INyxSwapPriceOracle(address(0)), 0);

        // A big swap skews reserveA away from totalSupply (fees/swaps grow reserves
        // without minting shares) so a 1-wei deposit's share of the now-larger reserve
        // truncates to 0 via integer division — a balanced, untouched pool can't
        // reproduce this, since supply == reserveA == reserveB there.
        vm.startPrank(trader);
        SeedToken(tokenA).mint(50_000 ether);
        SeedToken(tokenA).approve(address(pool), 50_000 ether);
        pool.swap(true, 50_000 ether, 0);
        vm.stopPrank();

        vm.startPrank(lp2);
        SeedToken(tokenA).mint(1);
        SeedToken(tokenB).mint(1);
        SeedToken(tokenA).approve(address(pool), 1);
        SeedToken(tokenB).approve(address(pool), 1);
        vm.expectRevert("NyxSwap: insufficient liquidity minted");
        pool.addReserves(1, 1);
        vm.stopPrank();
    }

    function test_RemoveReservesReturnsProportionalTokensAndBurnsShares() public {
        NyxSwapPool pool = _newPool(INyxSwapPriceOracle(address(0)), 0);
        uint256 lpBalance = pool.balanceOf(firstLp());
        uint256 supply = pool.totalSupply();

        uint256 toBurn = lpBalance / 2;
        uint256 expectedA = (toBurn * pool.reserveA()) / supply;
        uint256 expectedB = (toBurn * pool.reserveB()) / supply;

        uint256 balABefore = SeedToken(tokenA).balanceOf(firstLp());
        uint256 balBBefore = SeedToken(tokenB).balanceOf(firstLp());

        (uint256 outA, uint256 outB) = pool.removeReserves(toBurn);

        assertEq(outA, expectedA);
        assertEq(outB, expectedB);
        assertEq(pool.balanceOf(firstLp()), lpBalance - toBurn);
        assertEq(SeedToken(tokenA).balanceOf(firstLp()), balABefore + outA);
        assertEq(SeedToken(tokenB).balanceOf(firstLp()), balBBefore + outB);
    }

    function test_RemoveReservesRevertsForZeroLiquidity() public {
        NyxSwapPool pool = _newPool(INyxSwapPriceOracle(address(0)), 0);

        vm.expectRevert("NyxSwap: liquidity zero");
        pool.removeReserves(0);
    }

    function test_RemoveReservesRevertsWhenBurningMoreThanOwned() public {
        NyxSwapPool pool = _newPool(INyxSwapPriceOracle(address(0)), 0);

        vm.prank(lp2);
        vm.expectRevert();
        pool.removeReserves(1 ether);
    }

    function test_AddThenRemoveRoundTripReturnsApproximatelyWhatWasDeposited() public {
        NyxSwapPool pool = _newPool(INyxSwapPriceOracle(address(0)), 0);
        uint256 lpBalance = pool.balanceOf(firstLp());

        (uint256 outA, uint256 outB) = pool.removeReserves(lpBalance);

        // MINIMUM_LIQUIDITY stays locked forever, so a full exit by the sole LP
        // recovers slightly less than the original deposit, not exactly all of it.
        assertLt(outA, 100_000 ether);
        assertLt(outB, 100_000 ether);
        assertApproxEqAbs(outA, 100_000 ether, 1000);
        assertApproxEqAbs(outB, 100_000 ether, 1000);
    }

    function firstLp() internal view returns (address) {
        return address(this);
    }
}
