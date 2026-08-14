// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { PriceDeviation } from "../contracts/lib/PriceDeviation.sol";

contract PriceDeviationTest is Test {
    // 1:1 price, matching decimals — 100 in should quote 100 out.
    function test_OracleAmountOutEqualPrices() public pure {
        uint256 out = PriceDeviation.oracleAmountOut(100 ether, 1e5, 5, 1e5, 5);
        assertEq(out, 100 ether);
    }

    // tokenIn is $2, tokenOut is $1 — 100 in should quote 200 out.
    function test_OracleAmountOutDifferentPrices() public pure {
        uint256 out = PriceDeviation.oracleAmountOut(100 ether, 2e5, 5, 1e5, 5);
        assertEq(out, 200 ether);
    }

    // Same real prices, different feed decimal scales (5 vs 8) — result should be identical.
    function test_OracleAmountOutHandlesDifferingDecimals() public pure {
        uint256 outA = PriceDeviation.oracleAmountOut(100 ether, 2e5, 5, 1e5, 5);
        uint256 outB = PriceDeviation.oracleAmountOut(100 ether, 2e8, 8, 1e5, 5);
        assertEq(outA, outB);
    }

    function test_OracleAmountOutRevertsOnNegativeDecimals() public {
        vm.expectRevert("NyxSwap: negative feed decimals unsupported");
        this.callOracleAmountOut(100 ether, 1e5, -1, 1e5, 5);
    }

    function test_OracleAmountOutRevertsOnZeroPrice() public {
        vm.expectRevert("NyxSwap: zero feed price");
        this.callOracleAmountOut(100 ether, 0, 5, 1e5, 5);
    }

    // External wrapper so the internal library call crosses a real call-frame boundary —
    // vm.expectRevert() can't catch a revert from an inlined internal call otherwise.
    function callOracleAmountOut(uint256 amountIn, uint256 priceIn, int8 decIn, uint256 priceOut, int8 decOut)
        external
        pure
        returns (uint256)
    {
        return PriceDeviation.oracleAmountOut(amountIn, priceIn, decIn, priceOut, decOut);
    }

    function test_IsWithinDeviationExactMatch() public pure {
        assertTrue(PriceDeviation.isWithinDeviation(100 ether, 100 ether, 0));
    }

    function test_IsWithinDeviationAtBoundary() public pure {
        // 300 bps = 3% — exactly 3% off should pass.
        assertTrue(PriceDeviation.isWithinDeviation(103 ether, 100 ether, 300));
        assertTrue(PriceDeviation.isWithinDeviation(97 ether, 100 ether, 300));
    }

    function test_IsWithinDeviationJustOverBoundary() public pure {
        assertFalse(PriceDeviation.isWithinDeviation(103.01 ether, 100 ether, 300));
    }

    function test_IsWithinDeviationSkipsWhenExpectedIsZero() public pure {
        assertTrue(PriceDeviation.isWithinDeviation(500 ether, 0, 0));
    }
}
