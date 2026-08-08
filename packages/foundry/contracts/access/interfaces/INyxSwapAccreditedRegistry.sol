// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/// @title NyxSwap Accredited Viewer Interface
/// @notice Ported from the fce-shielded-transfers reference extension's AccreditedRegistry.
/// Gates who may query *another* user's private history/data — a separate question from
/// who may participate (see INyxSwapAllowList). Not wired into anything yet; only
/// relevant if NyxSwap ends up with cross-user private data worth auditing, which is not
/// the current architecture — see brief.md.
interface INyxSwapAccreditedRegistry {
    /// @notice Returns whether `viewer` is authorized to query another user's history.
    /// @param viewer The address to check.
    function isAccredited(address viewer) external view returns (bool);
}
