// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
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
/// The pool contract IS its own LP-share token (Uniswap V2's exact model, not a
/// separate deployment) — addReserves()/removeReserves() mint/burn shares against it
/// directly. This settles brief.md's "internal ledger vs minted token" question in
/// favor of a minted token: NyxSwapPool is fully on-chain and permissionless (unlike
/// NyxSwapVault, which routes everything through the TEE) — there's no off-chain ledger
/// to put LP positions in without inventing a TEE touchpoint that doesn't otherwise
/// exist for pool liquidity, and a minted share token is what lets NyxSwapLiquidityMining
/// (or anything else) hold/stake a position without new plumbing.
contract NyxSwapPool is INyxSwapPool, ERC20 {
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    /// @notice Swap fee in basis points. Matches the swap form's SWAP_FEE_BPS (0.3%).
    uint256 public constant SWAP_FEE_BPS = 30;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// @notice Permanently locked (minted to this contract, never transferable out) on
    /// the very first deposit — Uniswap V2's guard against the first-depositor
    /// share-price manipulation attack (donate reserves before anyone else deposits to
    /// mint a near-worthless amount of shares, then dilute later depositors).
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    /// @notice Optional FTSO-backed sanity check against this pool's own AMM math — a
    /// manipulation guard, not a pricing source (the AMM prices itself off reserves).
    /// Zero address disables the check entirely.
    INyxSwapPriceOracle public immutable priceOracle;
    /// @notice Max allowed deviation, in bps, between this pool's swap output and the
    /// oracle-implied output, when both tokens have a configured feed. Ignored when
    /// priceOracle is unset, or when either token has no feed (most SeedTokenFactory
    /// mocks won't — see NyxSwapPriceOracle's header).
    uint256 public immutable maxDeviationBps;

    event ReservesAdded(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity);
    event ReservesRemoved(address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidity);
    event Swapped(address indexed caller, bool aToB, uint256 amountIn, uint256 amountOut);

    constructor(IERC20 _tokenA, IERC20 _tokenB, INyxSwapPriceOracle _priceOracle, uint256 _maxDeviationBps)
        ERC20("NyxSwap LP", "NYX-LP")
    {
        require(address(_tokenA) != address(0) && address(_tokenB) != address(0), "NyxSwap: token zero");
        require(address(_tokenA) != address(_tokenB), "NyxSwap: identical tokens");
        tokenA = _tokenA;
        tokenB = _tokenB;
        priceOracle = _priceOracle;
        maxDeviationBps = _maxDeviationBps;
    }

    /// @notice Deposits amountA/amountB and mints LP shares proportional to the
    /// contribution (or, for the very first deposit, proportional to sqrt(amountA *
    /// amountB), minus MINIMUM_LIQUIDITY locked forever). Reverts if the resulting
    /// share amount would round down to zero.
    function addReserves(uint256 amountA, uint256 amountB) external returns (uint256 liquidity) {
        require(amountA > 0 && amountB > 0, "NyxSwap: amounts zero");
        require(tokenA.transferFrom(msg.sender, address(this), amountA), "NyxSwap: transferFrom A failed");
        require(tokenB.transferFrom(msg.sender, address(this), amountB), "NyxSwap: transferFrom B failed");

        uint256 supply = totalSupply();
        if (supply == 0) {
            liquidity = _sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
            _mint(address(this), MINIMUM_LIQUIDITY);
        } else {
            liquidity = _min((amountA * supply) / reserveA, (amountB * supply) / reserveB);
        }
        require(liquidity > 0, "NyxSwap: insufficient liquidity minted");

        reserveA += amountA;
        reserveB += amountB;
        _mint(msg.sender, liquidity);

        emit ReservesAdded(msg.sender, amountA, amountB, liquidity);
    }

    /// @notice Burns `liquidity` LP shares and returns the provider's proportional
    /// share of both reserves.
    function removeReserves(uint256 liquidity) external returns (uint256 amountA, uint256 amountB) {
        require(liquidity > 0, "NyxSwap: liquidity zero");

        uint256 supply = totalSupply();
        amountA = (liquidity * reserveA) / supply;
        amountB = (liquidity * reserveB) / supply;
        require(amountA > 0 && amountB > 0, "NyxSwap: insufficient liquidity burned");

        _burn(msg.sender, liquidity);
        reserveA -= amountA;
        reserveB -= amountB;

        require(tokenA.transfer(msg.sender, amountA), "NyxSwap: transfer A failed");
        require(tokenB.transfer(msg.sender, amountB), "NyxSwap: transfer B failed");

        emit ReservesRemoved(msg.sender, amountA, amountB, liquidity);
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

    /// @dev Babylonian method — same integer sqrt Uniswap V2's Math.sol uses.
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
