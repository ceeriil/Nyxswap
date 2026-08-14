// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/// @title NyxSwap Price Oracle Interface
/// @notice Kept separate from NyxSwapPriceOracle so NyxSwapPool can depend on this
/// instead of the concrete FTSO-backed implementation — lets tests substitute a mock
/// with injected prices instead of needing a live Flare network to hit FTSOv2 through.
interface INyxSwapPriceOracle {
    /// @notice True if `token` has a real-world FTSO feed configured. Most
    /// SeedTokenFactory mocks won't — callers must handle false, not assume every
    /// token is priced.
    function hasFeed(address token) external view returns (bool);

    /// @return value USD price scaled by `decimals`.
    /// @return decimals Decimal places `value` is scaled by.
    /// @return timestamp Unix timestamp of the feed's last update.
    function getPrice(address token) external view returns (uint256 value, int8 decimals, uint64 timestamp);
}
