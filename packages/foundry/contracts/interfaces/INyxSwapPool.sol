// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { IERC20 } from "./IERC20.sol";

/// @title NyxSwap Pool Interface
/// @notice The constant-product AMM a Settlement contract falls back to for whatever
/// an order-matching batch couldn't fill peer-to-peer.
interface INyxSwapPool {
    function tokenA() external view returns (IERC20);
    function tokenB() external view returns (IERC20);
    function reserveA() external view returns (uint256);
    function reserveB() external view returns (uint256);

    /// @notice Swaps `amountIn` of one side for the other. Caller must have already
    /// approved this pool for `amountIn` of the input token.
    /// @param aToB True to swap tokenA for tokenB, false for the reverse.
    /// @param amountIn Amount of the input token to swap.
    /// @param minAmountOut Minimum acceptable output, or the call reverts.
    /// @return amountOut The amount of output token sent to the caller.
    function swap(bool aToB, uint256 amountIn, uint256 minAmountOut) external returns (uint256 amountOut);
}
