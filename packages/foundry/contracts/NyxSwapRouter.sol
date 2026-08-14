// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { INyxSwapPool } from "./interfaces/INyxSwapPool.sol";
import { IERC20 } from "./interfaces/IERC20.sol";

/// @title NyxSwap Router
/// @notice Multi-hop swap routing over NyxSwapPool instances, plus off-chain quoting.
/// Pools are registered permissionlessly — anyone can register a deployed NyxSwapPool,
/// keyed by its own (tokenA, tokenB) pair, since the pool itself is the source of truth
/// for which tokens it holds. One pool per unordered token pair.
/// @dev No addLiquidity/removeLiquidity here — NyxSwapPool.addReserves is an explicit
/// placeholder (LP-share design is still undecided, see brief.md), so wrapping it in a
/// Router now would bake in the wrong shape. This only routes swaps against whatever
/// reserves already exist.
contract NyxSwapRouter {
    /// @notice Swap fee in basis points. Mirrors NyxSwapPool.SWAP_FEE_BPS for quoting —
    /// every pool shares this same fixed fee today, so it's safe to hardcode here too.
    /// If per-pool fees are ever introduced, this quoting math needs to read the fee
    /// from the pool instead.
    uint256 public constant SWAP_FEE_BPS = 30;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    mapping(address => mapping(address => INyxSwapPool)) public poolFor;

    event PoolRegistered(address indexed tokenA, address indexed tokenB, address indexed pool);

    error IdenticalTokens();
    error PoolAlreadyRegistered();
    error PathTooShort();
    error Expired();
    error InsufficientOutputAmount();
    error PoolNotFound(address tokenIn, address tokenOut);

    modifier ensure(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    /// @notice Registers `pool` for its own (tokenA, tokenB) pair, in both directions.
    /// Permissionless — the pool's own immutable tokenA/tokenB is the source of truth,
    /// so there's nothing for a caller to lie about beyond wasting their own gas.
    function registerPool(INyxSwapPool pool) external {
        address tokenA = address(pool.tokenA());
        address tokenB = address(pool.tokenB());
        if (tokenA == tokenB) revert IdenticalTokens();
        if (address(poolFor[tokenA][tokenB]) != address(0)) revert PoolAlreadyRegistered();

        poolFor[tokenA][tokenB] = pool;
        poolFor[tokenB][tokenA] = pool;
        emit PoolRegistered(tokenA, tokenB, address(pool));
    }

    /// @notice Swaps an exact amount of path[0] for as much as possible of path[last],
    /// hopping through a registered pool for each consecutive pair in `path`. Only the
    /// final output is slippage-checked against `amountOutMin` — matches how Uniswap V2's
    /// router handles multi-hop paths.
    /// @param amountIn Exact amount of path[0] to pull from the caller.
    /// @param amountOutMin Reverts if the final output is below this.
    /// @param path Token addresses defining the route; path[0] is input, path[last] is output.
    /// @param to Recipient of the final output token.
    /// @param deadline Reverts if block.timestamp exceeds this.
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        if (path.length < 2) revert PathTooShort();

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        require(IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn), "NyxSwap: transferFrom failed");

        for (uint256 i = 0; i < path.length - 1; i++) {
            address tokenIn = path[i];
            address tokenOut = path[i + 1];
            INyxSwapPool pool = poolFor[tokenIn][tokenOut];
            if (address(pool) == address(0)) revert PoolNotFound(tokenIn, tokenOut);

            bool aToB = address(pool.tokenA()) == tokenIn;

            require(IERC20(tokenIn).approve(address(pool), amounts[i]), "NyxSwap: approve failed");
            amounts[i + 1] = pool.swap(aToB, amounts[i], 0);
        }

        uint256 finalAmount = amounts[amounts.length - 1];
        if (finalAmount < amountOutMin) revert InsufficientOutputAmount();

        if (to != address(this)) {
            require(IERC20(path[path.length - 1]).transfer(to, finalAmount), "NyxSwap: transfer failed");
        }
    }

    /// @notice Previews `swapExactTokensForTokens`'s output for `path`, without a state
    /// change. Reverts with PoolNotFound if any hop in the path isn't registered.
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts) {
        if (path.length < 2) revert PathTooShort();

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i = 0; i < path.length - 1; i++) {
            address tokenIn = path[i];
            address tokenOut = path[i + 1];
            INyxSwapPool pool = poolFor[tokenIn][tokenOut];
            if (address(pool) == address(0)) revert PoolNotFound(tokenIn, tokenOut);

            bool aToB = address(pool.tokenA()) == tokenIn;
            (uint256 reserveIn, uint256 reserveOut) =
                aToB ? (pool.reserveA(), pool.reserveB()) : (pool.reserveB(), pool.reserveA());

            amounts[i + 1] = _getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    /// @dev Mirrors NyxSwapPool.swap()'s constant-product-with-fee math exactly.
    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        uint256 amountInWithFee = (amountIn * (BPS_DENOMINATOR - SWAP_FEE_BPS)) / BPS_DENOMINATOR;
        return (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
    }
}
