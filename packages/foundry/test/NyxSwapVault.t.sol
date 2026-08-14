// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { NyxSwapVault } from "../contracts/NyxSwapVault.sol";
import { NyxSwapPool } from "../contracts/NyxSwapPool.sol";
import { INyxSwapPool } from "../contracts/interfaces/INyxSwapPool.sol";
import { INyxSwapPriceOracle } from "../contracts/interfaces/INyxSwapPriceOracle.sol";
import { IERC20 as INyxIERC20 } from "../contracts/interfaces/IERC20.sol";
import { SeedTokenFactory } from "../contracts/token/SeedTokenFactory.sol";
import { SeedToken } from "../contracts/token/SeedToken.sol";

contract NyxSwapVaultTest is Test {
    NyxSwapVault vault;
    NyxSwapPool pool;
    SeedTokenFactory factory;

    address tokenA;
    address tokenB;

    address owner = address(this);
    uint256 teePrivateKey = 0xA11CE;
    address teeAuthority;

    address recipient = address(0xCAFE);
    address filler = address(0xF111);

    function setUp() public {
        teeAuthority = vm.addr(teePrivateKey);

        vault = new NyxSwapVault(owner);
        factory = new SeedTokenFactory();

        tokenA = factory.deployToken("Token A", "AAA");
        tokenB = factory.deployToken("Token B", "BBB");

        pool = new NyxSwapPool(INyxIERC20(tokenA), INyxIERC20(tokenB), INyxSwapPriceOracle(address(0)), 0);

        SeedToken(tokenA).approve(address(pool), type(uint256).max);
        SeedToken(tokenB).approve(address(pool), type(uint256).max);
        pool.addReserves(100_000 ether, 100_000 ether);

        vault.setAllowedToken(tokenA, true);
        vault.setAllowedToken(tokenB, true);
        vault.setTeeAuthority(teeAuthority);

        // Simulate prior deposits landing in the vault (see NyxSwapVault's header —
        // deposits are a direct token transfer, there's no deposit() entrypoint here).
        SeedToken(tokenA).transfer(address(vault), 10_000 ether);
    }

    // --- admin ---

    function test_SetAllowedTokenRevertsForNonOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("NyxSwap: caller not owner");
        vault.setAllowedToken(tokenA, false);
    }

    function test_SetTeeAuthorityRevertsIfAlreadySet() public {
        vm.expectRevert("NyxSwap: tee authority already set");
        vault.setTeeAuthority(address(0xDEAD));
    }

    function test_TransferOwnerMovesAdminRights() public {
        address nextOwner = address(0xB0B);
        vault.transferOwner(nextOwner);

        vm.expectRevert("NyxSwap: caller not owner");
        vault.setAllowedToken(tokenA, false);

        vm.prank(nextOwner);
        vault.setAllowedToken(tokenA, false);
        assertFalse(vault.isAllowedToken(tokenA));
    }

    // --- fillFromPool (tie the vault back to the pool) ---

    function test_FillFromPoolSwapsVaultCustodyThroughPool() public {
        uint256 amountIn = 1_000 ether;
        uint256 quotedOut = _quote(amountIn, pool.reserveA(), pool.reserveB());

        bytes32 fillId = keccak256("fill-1");
        bytes memory sig = _signFill(fillId, pool, true, amountIn, quotedOut);

        uint256 vaultABefore = SeedToken(tokenA).balanceOf(address(vault));
        uint256 vaultBBefore = SeedToken(tokenB).balanceOf(address(vault));

        vm.prank(filler);
        uint256 amountOut = vault.fillFromPool(fillId, INyxSwapPool(address(pool)), true, amountIn, quotedOut, sig);

        assertEq(amountOut, quotedOut);
        assertEq(SeedToken(tokenA).balanceOf(address(vault)), vaultABefore - amountIn);
        assertEq(SeedToken(tokenB).balanceOf(address(vault)), vaultBBefore + amountOut);
        assertTrue(vault.usedFills(fillId));
    }

    function test_FillFromPoolRevertsOnReplayedFillId() public {
        uint256 amountIn = 1_000 ether;
        uint256 quotedOut = _quote(amountIn, pool.reserveA(), pool.reserveB());
        bytes32 fillId = keccak256("fill-replay");
        bytes memory sig = _signFill(fillId, pool, true, amountIn, quotedOut);

        vault.fillFromPool(fillId, INyxSwapPool(address(pool)), true, amountIn, quotedOut, sig);

        vm.expectRevert("NyxSwap: fill already used");
        vault.fillFromPool(fillId, INyxSwapPool(address(pool)), true, amountIn, quotedOut, sig);
    }

    function test_FillFromPoolRevertsOnBadSignature() public {
        uint256 amountIn = 1_000 ether;
        bytes32 fillId = keccak256("fill-bad-sig");

        // Signed by a random key, not the configured teeAuthority.
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBEEF, keccak256("wrong message"));
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert("NyxSwap: invalid signature");
        vault.fillFromPool(fillId, INyxSwapPool(address(pool)), true, amountIn, 0, badSig);
    }

    function test_FillFromPoolRevertsWhenTeeAuthorityNotSet() public {
        NyxSwapVault freshVault = new NyxSwapVault(owner);
        uint256 amountIn = 1_000 ether;
        bytes32 fillId = keccak256("fill-no-tee");
        bytes memory sig = _signFillFor(freshVault, fillId, pool, true, amountIn, 0);

        vm.expectRevert("NyxSwap: tee authority not set");
        freshVault.fillFromPool(fillId, INyxSwapPool(address(pool)), true, amountIn, 0, sig);
    }

    function test_FillFromPoolRevertsWhenTokenInNotAllowed() public {
        vault.setAllowedToken(tokenA, false);

        uint256 amountIn = 1_000 ether;
        bytes32 fillId = keccak256("fill-not-allowed");
        bytes memory sig = _signFill(fillId, pool, true, amountIn, 0);

        vm.expectRevert("NyxSwap: token not allowed");
        vault.fillFromPool(fillId, INyxSwapPool(address(pool)), true, amountIn, 0, sig);
    }

    // --- withdraw ---

    function test_WithdrawReleasesFundsToRecipient() public {
        uint256 amount = 500 ether;
        bytes32 withdrawalId = keccak256("withdrawal-1");
        bytes memory sig = _signWithdraw(recipient, tokenA, amount, withdrawalId);

        uint256 recipientBefore = SeedToken(tokenA).balanceOf(recipient);

        vault.withdraw(recipient, tokenA, amount, withdrawalId, sig);

        assertEq(SeedToken(tokenA).balanceOf(recipient), recipientBefore + amount);
        assertTrue(vault.usedWithdrawals(withdrawalId));
    }

    function test_WithdrawRevertsOnReplayedWithdrawalId() public {
        uint256 amount = 500 ether;
        bytes32 withdrawalId = keccak256("withdrawal-replay");
        bytes memory sig = _signWithdraw(recipient, tokenA, amount, withdrawalId);

        vault.withdraw(recipient, tokenA, amount, withdrawalId, sig);

        vm.expectRevert("NyxSwap: withdrawal already used");
        vault.withdraw(recipient, tokenA, amount, withdrawalId, sig);
    }

    function test_WithdrawRevertsOnBadSignature() public {
        uint256 amount = 500 ether;
        bytes32 withdrawalId = keccak256("withdrawal-bad-sig");

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBEEF, keccak256("wrong message"));
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert("NyxSwap: invalid signature");
        vault.withdraw(recipient, tokenA, amount, withdrawalId, badSig);
    }

    function test_WithdrawRevertsForDisallowedToken() public {
        vault.setAllowedToken(tokenA, false);
        uint256 amount = 500 ether;
        bytes32 withdrawalId = keccak256("withdrawal-disallowed");
        bytes memory sig = _signWithdraw(recipient, tokenA, amount, withdrawalId);

        vm.expectRevert("NyxSwap: token not allowed");
        vault.withdraw(recipient, tokenA, amount, withdrawalId, sig);
    }

    // --- helpers ---

    function _quote(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        uint256 amountInWithFee = (amountIn * (10_000 - 30)) / 10_000;
        return (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
    }

    function _signFill(bytes32 fillId, NyxSwapPool p, bool aToB, uint256 amountIn, uint256 minAmountOut)
        internal
        view
        returns (bytes memory)
    {
        return _signFillFor(vault, fillId, p, aToB, amountIn, minAmountOut);
    }

    function _signFillFor(
        NyxSwapVault v,
        bytes32 fillId,
        NyxSwapPool p,
        bool aToB,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal view returns (bytes memory) {
        bytes32 hash = keccak256(abi.encodePacked(address(v), fillId, address(p), aToB, amountIn, minAmountOut));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v_, bytes32 r, bytes32 s) = vm.sign(teePrivateKey, ethSignedHash);
        return abi.encodePacked(r, s, v_);
    }

    function _signWithdraw(address to, address token, uint256 amount, bytes32 withdrawalId)
        internal
        view
        returns (bytes memory)
    {
        bytes32 hash = keccak256(abi.encodePacked(address(vault), to, token, amount, withdrawalId));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(teePrivateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }
}
