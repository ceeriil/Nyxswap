// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { NyxSwapLiquidityMining } from "../contracts/NyxSwapLiquidityMining.sol";
import { NyxToken } from "../contracts/token/NyxToken.sol";
import { IERC20 as INyxIERC20 } from "../contracts/interfaces/IERC20.sol";
import { SeedTokenFactory } from "../contracts/token/SeedTokenFactory.sol";
import { SeedToken } from "../contracts/token/SeedToken.sol";

// Stand-in LP tokens: the mining contract only cares about the staked token's ERC20
// interface, not that it's a real NyxSwapPool — using plain SeedTokenFactory mints
// keeps these tests focused on the reward math, not pool internals (already covered in
// NyxSwapPool.t.sol).
contract NyxSwapLiquidityMiningTest is Test {
    NyxToken nyxToken;
    NyxSwapLiquidityMining mining;
    SeedTokenFactory factory;

    address lpA;
    address lpB;

    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 constant NYX_PER_SECOND = 1 ether;

    function setUp() public {
        nyxToken = new NyxToken(owner);
        mining = new NyxSwapLiquidityMining(owner, nyxToken, NYX_PER_SECOND, block.timestamp);
        nyxToken.setMinter(address(mining));

        factory = new SeedTokenFactory();
        lpA = factory.deployToken("LP A", "LPA");
        lpB = factory.deployToken("LP B", "LPB");
    }

    function _stake(address user, address lpToken, uint256 pid, uint256 amount) internal {
        vm.startPrank(user);
        SeedToken(lpToken).mint(amount);
        SeedToken(lpToken).approve(address(mining), amount);
        mining.deposit(pid, amount);
        vm.stopPrank();
    }

    // --- pool admin ---

    function test_AddPoolRegistersLpToken() public {
        mining.addPool(INyxIERC20(lpA), 100);

        assertEq(mining.poolLength(), 1);
        assertTrue(mining.poolExistsFor(lpA));
        assertEq(mining.totalAllocPoint(), 100);
    }

    function test_AddPoolRevertsOnDuplicate() public {
        mining.addPool(INyxIERC20(lpA), 100);

        vm.expectRevert("NyxSwap: pool exists");
        mining.addPool(INyxIERC20(lpA), 50);
    }

    function test_AddPoolRevertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert("NyxSwap: caller not owner");
        mining.addPool(INyxIERC20(lpA), 100);
    }

    // --- single staker, time-weighted accrual ---

    function test_SingleStakerEarnsFullEmissionOverTime() public {
        mining.addPool(INyxIERC20(lpA), 100);
        _stake(alice, lpA, 0, 100 ether);

        vm.warp(block.timestamp + 100);

        // Sole staker, sole pool — pending should equal the raw emission for the elapsed time.
        assertEq(mining.pendingNyx(0, alice), NYX_PER_SECOND * 100);
    }

    function test_WithdrawPaysOutExactlyWhatWasPending() public {
        mining.addPool(INyxIERC20(lpA), 100);
        _stake(alice, lpA, 0, 100 ether);

        vm.warp(block.timestamp + 100);
        uint256 expected = mining.pendingNyx(0, alice);

        vm.prank(alice);
        mining.withdraw(0, 100 ether);

        assertEq(nyxToken.balanceOf(alice), expected);
        assertEq(SeedToken(lpA).balanceOf(alice), 100 ether);
    }

    function test_DepositMoreClaimsPendingFirst() public {
        mining.addPool(INyxIERC20(lpA), 100);
        _stake(alice, lpA, 0, 100 ether);

        vm.warp(block.timestamp + 50);
        uint256 expected = mining.pendingNyx(0, alice);

        vm.startPrank(alice);
        SeedToken(lpA).mint(50 ether);
        SeedToken(lpA).approve(address(mining), 50 ether);
        mining.deposit(0, 50 ether);
        vm.stopPrank();

        assertEq(nyxToken.balanceOf(alice), expected);
        (uint256 staked,) = mining.userInfo(0, alice);
        assertEq(staked, 150 ether);
    }

    // --- multiple stakers, same pool ---

    function test_TwoStakersJoiningTogetherSplitProportionally() public {
        mining.addPool(INyxIERC20(lpA), 100);
        _stake(alice, lpA, 0, 100 ether); // 25% of the 400 ether total
        _stake(bob, lpA, 0, 300 ether); // 75%

        vm.warp(block.timestamp + 100);

        uint256 totalReward = NYX_PER_SECOND * 100;
        assertEq(mining.pendingNyx(0, alice), totalReward / 4);
        assertEq(mining.pendingNyx(0, bob), (totalReward * 3) / 4);
    }

    function test_LaterStakerOnlyEarnsFromWhenTheyJoined() public {
        mining.addPool(INyxIERC20(lpA), 100);
        _stake(alice, lpA, 0, 100 ether);

        vm.warp(block.timestamp + 50);
        _stake(bob, lpA, 0, 100 ether); // joins once alice already has 50s of solo accrual

        vm.warp(block.timestamp + 50);

        // First 50s: alice alone, earns it all (50 ether). Second 50s: split 50/50
        // between alice and bob (25 ether each, now equal stakes).
        assertEq(mining.pendingNyx(0, alice), 75 ether);
        assertEq(mining.pendingNyx(0, bob), 25 ether);
    }

    function test_WithdrawRevertsWhenInsufficientStakedBalance() public {
        mining.addPool(INyxIERC20(lpA), 100);
        _stake(alice, lpA, 0, 50 ether);

        vm.prank(alice);
        vm.expectRevert("NyxSwap: insufficient staked balance");
        mining.withdraw(0, 100 ether);
    }

    // --- multiple pools, split by allocPoint ---

    function test_MultiplePoolsSplitEmissionByAllocPoint() public {
        mining.addPool(INyxIERC20(lpA), 100); // pid 0 — 2/3 of emission
        mining.addPool(INyxIERC20(lpB), 50); // pid 1 — 1/3 of emission

        _stake(alice, lpA, 0, 100 ether);
        _stake(bob, lpB, 1, 100 ether);

        vm.warp(block.timestamp + 150);

        uint256 totalReward = NYX_PER_SECOND * 150;
        assertEq(mining.pendingNyx(0, alice), (totalReward * 100) / 150);
        assertEq(mining.pendingNyx(1, bob), (totalReward * 50) / 150);
    }

    function test_SetAllocPointChangesFutureSplit() public {
        mining.addPool(INyxIERC20(lpA), 100);
        mining.addPool(INyxIERC20(lpB), 100);
        _stake(alice, lpA, 0, 100 ether);
        _stake(bob, lpB, 1, 100 ether);

        vm.warp(block.timestamp + 100);
        // Equal alloc so far — 100 ether each pending.
        assertEq(mining.pendingNyx(0, alice), 50 ether);
        assertEq(mining.pendingNyx(1, bob), 50 ether);

        // Re-weight pool 0 to 3x pool 1's allocation going forward.
        mining.setAllocPoint(0, 300);
        assertEq(mining.totalAllocPoint(), 400);

        vm.warp(block.timestamp + 100);
        // Second 100s: pool 0 gets 75%, pool 1 gets 25% of the 100 ether emitted.
        assertEq(mining.pendingNyx(0, alice), 50 ether + 75 ether);
        assertEq(mining.pendingNyx(1, bob), 50 ether + 25 ether);
    }

    function test_PendingIsZeroWithNoStakers() public {
        mining.addPool(INyxIERC20(lpA), 100);
        vm.warp(block.timestamp + 100);

        assertEq(mining.pendingNyx(0, alice), 0);
    }
}
