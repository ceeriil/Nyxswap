// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/// @title NyxSwap Vault Interface
/// @notice The minimal read surface NyxSwapInstructionSender needs — whether a token
/// may be deposited. Vault custody itself (deposits arrive via a direct token transfer,
/// not a Vault function call) and the privileged withdraw/fillFromPool paths are not
/// part of this interface.
interface INyxSwapVault {
    function isAllowedToken(address token) external view returns (bool);
}
