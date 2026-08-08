// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/// @title NyxSwap Allow List Interface
/// @notice Ported from CoW Protocol's GPv2Authentication — decouples "is this address
/// allowed" from whichever contract needs to gate on it (admin functions, or a
/// deposit/withdraw compliance gate, depending on how that policy question lands).
interface INyxSwapAllowList {
    /// @notice Returns whether `account` is currently on the allow list.
    /// @param account The address to check.
    function isAllowed(address account) external view returns (bool);
}
