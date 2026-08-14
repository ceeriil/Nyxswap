// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { INyxSwapPool } from "./interfaces/INyxSwapPool.sol";
import { INyxSwapPriceOracle } from "./interfaces/INyxSwapPriceOracle.sol";
import { IERC20 } from "./interfaces/IERC20.sol";
import { NyxSwapPool } from "./NyxSwapPool.sol";

/// @title NyxSwap Router
/// @notice Multi-hop swap routing over NyxSwapPool instances, plus off-chain quoting.
/// Pools are created BY this router, not registered from an arbitrary caller-supplied
/// address — createPool deploys the real NyxSwapPool itself via `new`, so there's no
/// address to lie about (unlike a registry that trusts whatever contract it's handed,
/// which is squattable: an attacker could front-run legitimate registration with a
/// contract that reports the right tokenA()/tokenB() but a malicious swap()). Mirrors
/// how Uniswap V2's factory works, for the same reason. One pool per unordered pair.
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

    /// @notice Oracle (if any) and deviation tolerance every pool this router creates is
    /// wired up with. One consistent policy for the whole router, set once at deploy time.
    INyxSwapPriceOracle public immutable priceOracle;
    uint256 public immutable maxDeviationBps;

    mapping(address => mapping(address => INyxSwapPool)) public poolFor;

    event PoolCreated(address indexed tokenA, address indexed tokenB, address indexed pool);

    error PoolAlreadyExists();
    error PathTooShort();
    error Expired();
    error InsufficientOutputAmount();
    error PoolNotFound(address tokenIn, address tokenOut);
    error ZeroAddress();
    error CannotSendToRouter();

    modifier ensure(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    constructor(INyxSwapPriceOracle _priceOracle, uint256 _maxDeviationBps) {
        priceOracle = _priceOracle;
        maxDeviationBps = _maxDeviationBps;
    }

    /// @notice Deploys a NyxSwapPool for (tokenA, tokenB) and registers it, in both
    /// directions. Reverts (via NyxSwapPool's own constructor) on identical or zero
    /// token addresses. One pool per unordered pair — reverts if one already exists.
    function createPool(IERC20 tokenA, IERC20 tokenB) external returns (address pool) {
        address a = address(tokenA);
        address b = address(tokenB);
        if (address(poolFor[a][b]) != address(0)) revert PoolAlreadyExists();

        pool = address(new NyxSwapPool(tokenA, tokenB, priceOracle, maxDeviationBps));
        poolFor[a][b] = INyxSwapPool(pool);
        poolFor[b][a] = INyxSwapPool(pool);
        emit PoolCreated(a, b, pool);
    }

    /// @notice Swaps an exact amount of path[0] for as much as possible of path[last],
    /// hopping through a pool for each consecutive pair in `path`. Only the final output
    /// is slippage-checked against `amountOutMin` — matches how Uniswap V2's router
    /// handles multi-hop paths.
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
        if (to == address(0)) revert ZeroAddress();
        if (to == address(this)) revert CannotSendToRouter();

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

        require(IERC20(path[path.length - 1]).transfer(to, finalAmount), "NyxSwap: transfer failed");
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
