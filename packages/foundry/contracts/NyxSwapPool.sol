// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { INyxSwapPool } from "./interfaces/INyxSwapPool.sol";
import { INyxSwapPriceOracle } from "./interfaces/INyxSwapPriceOracle.sol";
import { IERC20 } from "./interfaces/IERC20.sol";
import { PriceDeviation } from "./lib/PriceDeviation.sol";

/// @title NyxSwap Pool
/// @notice Constant-product reserves for one token pair. Anyone can swap against it
/// directly, but its main expected caller is NyxSwapVault's TEE-signed fillFromPool,
/// used when the TEE couldn't match an order peer-to-peer off-chain and needs pool
/// liquidity to fill the remainder instead.
///
/// `addReserves` is a placeholder for funding the pool — it does not mint LP shares or
/// track provider equity. Whether LP positions end up as an internal ledger entry or a
/// minted token is still undecided (see brief.md); this just makes the pool usable now.
contract NyxSwapPool is INyxSwapPool {
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    /// @notice Swap fee in basis points. Matches the swap form's SWAP_FEE_BPS (0.3%).
    uint256 public constant SWAP_FEE_BPS = 30;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// @notice Optional FTSO-backed sanity check against this pool's own AMM math — a
    /// manipulation guard, not a pricing source (the AMM prices itself off reserves).
    /// Zero address disables the check entirely.
    INyxSwapPriceOracle public immutable priceOracle;
    /// @notice Max allowed deviation, in bps, between this pool's swap output and the
    /// oracle-implied output, when both tokens have a configured feed. Ignored when
    /// priceOracle is unset, or when either token has no feed (most SeedTokenFactory
    /// mocks won't — see NyxSwapPriceOracle's header).
    uint256 public immutable maxDeviationBps;

    event ReservesAdded(address indexed provider, uint256 amountA, uint256 amountB);
    event Swapped(address indexed caller, bool aToB, uint256 amountIn, uint256 amountOut);

    constructor(IERC20 _tokenA, IERC20 _tokenB, INyxSwapPriceOracle _priceOracle, uint256 _maxDeviationBps) {
        require(address(_tokenA) != address(0) && address(_tokenB) != address(0), "NyxSwap: token zero");
        require(address(_tokenA) != address(_tokenB), "NyxSwap: identical tokens");
        tokenA = _tokenA;
        tokenB = _tokenB;
        priceOracle = _priceOracle;
        maxDeviationBps = _maxDeviationBps;
    }

    /// @notice Placeholder liquidity funding — see contract header.
    function addReserves(uint256 amountA, uint256 amountB) external {
        require(amountA > 0 && amountB > 0, "NyxSwap: amounts zero");
        require(tokenA.transferFrom(msg.sender, address(this), amountA), "NyxSwap: transferFrom A failed");
        require(tokenB.transferFrom(msg.sender, address(this), amountB), "NyxSwap: transferFrom B failed");
        reserveA += amountA;
        reserveB += amountB;
        emit ReservesAdded(msg.sender, amountA, amountB);
    }

    /// @inheritdoc INyxSwapPool
    function swap(bool aToB, uint256 amountIn, uint256 minAmountOut) external returns (uint256 amountOut) {
        require(amountIn > 0, "NyxSwap: amount zero");

        IERC20 tokenIn = aToB ? tokenA : tokenB;
        IERC20 tokenOut = aToB ? tokenB : tokenA;
        (uint256 reserveIn, uint256 reserveOut) = aToB ? (reserveA, reserveB) : (reserveB, reserveA);

        uint256 amountInWithFee = (amountIn * (BPS_DENOMINATOR - SWAP_FEE_BPS)) / BPS_DENOMINATOR;
        amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
        require(amountOut >= minAmountOut, "NyxSwap: slippage");

        _checkPriceDeviation(address(tokenIn), address(tokenOut), amountIn, amountOut);

        require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "NyxSwap: transferFrom failed");

        if (aToB) {
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
        }

        require(tokenOut.transfer(msg.sender, amountOut), "NyxSwap: transfer failed");
        emit Swapped(msg.sender, aToB, amountIn, amountOut);
    }

    /// @dev Fail-open: skips the check if there's no oracle configured, or either token
    /// has no FTSO feed registered — a real-world price reference isn't guaranteed to
    /// exist for every SeedTokenFactory mock, and this pool must stay usable without one.
    function _checkPriceDeviation(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)
        internal
        view
    {
        if (address(priceOracle) == address(0)) return;
        if (!priceOracle.hasFeed(tokenIn) || !priceOracle.hasFeed(tokenOut)) return;

        (uint256 priceIn, int8 decIn,) = priceOracle.getPrice(tokenIn);
        (uint256 priceOut, int8 decOut,) = priceOracle.getPrice(tokenOut);

        uint256 expected = PriceDeviation.oracleAmountOut(amountIn, priceIn, decIn, priceOut, decOut);
        require(
            PriceDeviation.isWithinDeviation(amountOut, expected, maxDeviationBps), "NyxSwap: price deviation too high"
        );
    }
}
