// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/// @title Price Deviation
/// @notice Pure math for comparing an AMM swap's actual output against what an oracle's
/// cross price implies, expressed in basis points. Kept separate from any oracle-reading
/// code (NyxSwapPriceOracle) so it's unit-testable without a live FTSO feed.
library PriceDeviation {
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    /// @notice Oracle-implied output for `amountIn`, given each side's USD price/decimals.
    /// @dev decIn/decOut are FTSOv2-style int8 exponents; this assumes non-negative
    /// decimals, matching every feed Flare currently publishes.
    function oracleAmountOut(uint256 amountIn, uint256 priceIn, int8 decIn, uint256 priceOut, int8 decOut)
        internal
        pure
        returns (uint256)
    {
        require(decIn >= 0 && decOut >= 0, "NyxSwap: negative feed decimals unsupported");
        require(priceIn > 0 && priceOut > 0, "NyxSwap: zero feed price");
        // amountOut = amountIn * (priceIn / 10^decIn) / (priceOut / 10^decOut)
        //           = amountIn * priceIn * 10^decOut / (priceOut * 10^decIn)
        // forge-lint: disable-next-line(unsafe-typecast)
        // casting to uint8 is safe: decIn/decOut are non-negative per the require above.
        return (amountIn * priceIn * (10 ** uint8(decOut))) / (priceOut * (10 ** uint8(decIn)));
    }

    /// @notice True if `actualAmountOut` is within `maxDeviationBps` of `expectedAmountOut`.
    function isWithinDeviation(uint256 actualAmountOut, uint256 expectedAmountOut, uint256 maxDeviationBps)
        internal
        pure
        returns (bool)
    {
        if (expectedAmountOut == 0) return true; // nothing to compare against
        uint256 diff = actualAmountOut > expectedAmountOut
            ? actualAmountOut - expectedAmountOut
            : expectedAmountOut - actualAmountOut;
        return diff * BPS_DENOMINATOR <= expectedAmountOut * maxDeviationBps;
    }
}
