// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { NyxSwapPriceOracle } from "../contracts/NyxSwapPriceOracle.sol";

// Exercises registry mechanics (setFeed/hasFeed/ownership) and the manual push-price
// path fully — none of that needs live FTSO. getPrice()'s FTSO-backed branch (when a
// feedId IS set) still isn't testable here — that calls out to Flare's live
// ContractRegistry/FTSOv2, only verifiable against a real Flare network (Coston2), the
// same limitation FlrPriceReader.sol already has.
contract NyxSwapPriceOracleTest is Test {
    NyxSwapPriceOracle oracle;
    address owner = address(this);
    address token = address(0xA11CE);
    uint256 constant MAX_AGE = 1 hours;

    function setUp() public {
        oracle = new NyxSwapPriceOracle(owner, MAX_AGE);
    }

    function test_HasFeedFalseByDefault() public view {
        assertFalse(oracle.hasFeed(token));
    }

    function test_SetFeedMarksTokenAsHavingAFeed() public {
        bytes21 feedId = bytes21(uint168(0x01464c522f55534400000000000000000000000000));
        oracle.setFeed(token, feedId);

        assertTrue(oracle.hasFeed(token));
        assertEq(oracle.feedIdFor(token), feedId);
    }

    function test_SetFeedToZeroClearsIt() public {
        bytes21 feedId = bytes21(uint168(0x01464c522f55534400000000000000000000000000));
        oracle.setFeed(token, feedId);
        oracle.setFeed(token, bytes21(0));

        assertFalse(oracle.hasFeed(token));
    }

    function test_SetFeedRevertsForNonOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("NyxSwap: caller not owner");
        oracle.setFeed(token, bytes21(uint168(1)));
    }

    function test_SetFeedRevertsForZeroToken() public {
        vm.expectRevert("NyxSwap: token zero");
        oracle.setFeed(address(0), bytes21(uint168(1)));
    }

    function test_TransferOwnerMovesAdminRights() public {
        address nextOwner = address(0xB0B);
        oracle.transferOwner(nextOwner);

        vm.expectRevert("NyxSwap: caller not owner");
        oracle.setFeed(token, bytes21(uint168(1)));

        vm.prank(nextOwner);
        oracle.setFeed(token, bytes21(uint168(1)));
        assertTrue(oracle.hasFeed(token));
    }

    function test_GetPriceRevertsWhenNoFeedConfigured() public {
        vm.expectRevert("NyxSwap: no feed for token");
        oracle.getPrice(token);
    }

    function test_ConstructorRevertsForZeroMaxAge() public {
        vm.expectRevert("NyxSwap: max age zero");
        new NyxSwapPriceOracle(owner, 0);
    }

    // --- manual (push) price path ---

    function test_SetManualPriceMarksTokenAsHavingAFeed() public {
        oracle.setManualPrice(token, 1_23456, 5);

        assertTrue(oracle.hasFeed(token));
        (uint256 value, int8 decimals, uint64 timestamp) = oracle.getPrice(token);
        assertEq(value, 1_23456);
        assertEq(decimals, 5);
        assertEq(timestamp, block.timestamp);
    }

    function test_SetManualPriceRevertsForNonOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("NyxSwap: caller not owner");
        oracle.setManualPrice(token, 100, 5);
    }

    function test_SetManualPriceRevertsForZeroValue() public {
        vm.expectRevert("NyxSwap: value zero");
        oracle.setManualPrice(token, 0, 5);
    }

    function test_SetManualPriceRevertsForNegativeDecimals() public {
        vm.expectRevert("NyxSwap: negative decimals unsupported");
        oracle.setManualPrice(token, 100, -1);
    }

    function test_ClearManualPriceRemovesFeed() public {
        oracle.setManualPrice(token, 100, 5);
        oracle.clearManualPrice(token);

        assertFalse(oracle.hasFeed(token));
    }

    function test_ManualPriceBecomesStaleAfterMaxAge() public {
        oracle.setManualPrice(token, 100, 5);
        assertTrue(oracle.hasFeed(token));

        vm.warp(block.timestamp + MAX_AGE + 1);

        assertFalse(oracle.hasFeed(token));
        vm.expectRevert("NyxSwap: manual price stale");
        oracle.getPrice(token);
    }

    function test_ManualPriceStillFreshRightAtBoundary() public {
        oracle.setManualPrice(token, 100, 5);
        vm.warp(block.timestamp + MAX_AGE);

        assertTrue(oracle.hasFeed(token));
        (uint256 value,,) = oracle.getPrice(token);
        assertEq(value, 100);
    }

    function test_FeedTakesPriorityOverManualPriceForHasFeed() public {
        // Real FTSO feed and a manual push price both configured for the same token —
        // hasFeed() should be true regardless (getPrice()'s FTSO branch isn't testable
        // here, but the priority is enforced by feedId being checked first).
        oracle.setManualPrice(token, 100, 5);
        oracle.setFeed(token, bytes21(uint168(0x01464c522f55534400000000000000000000000000)));

        assertTrue(oracle.hasFeed(token));
    }
}
