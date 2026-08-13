// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { Faucet } from "../contracts/token/Faucet.sol";
import { SeedTokenFactory } from "../contracts/token/SeedTokenFactory.sol";
import { SeedToken } from "../contracts/token/SeedToken.sol";

contract FaucetTest is Test {
    Faucet faucet;
    SeedTokenFactory factory;
    address token;
    address owner = address(this);
    address alice = address(0xA11CE);

    function setUp() public {
        factory = new SeedTokenFactory();
        token = factory.deployToken("Wrapped Flare", "WFLR");
        faucet = new Faucet(owner);

        address[] memory tokens = new address[](1);
        tokens[0] = token;
        faucet.setSupportedTokens(tokens, true);
    }

    function test_ClaimMintsAndTransfersClaimAmount() public {
        vm.prank(alice);
        faucet.claim(token);

        assertEq(SeedToken(token).balanceOf(alice), faucet.CLAIM_AMOUNT());
    }

    function test_ClaimRevertsOnUnsupportedToken() public {
        address other = factory.deployToken("Other", "OTH");

        vm.expectRevert(abi.encodeWithSelector(Faucet.UnsupportedToken.selector, other));
        vm.prank(alice);
        faucet.claim(other);
    }

    function test_ClaimRevertsDuringCooldown() public {
        vm.startPrank(alice);
        faucet.claim(token);

        vm.expectRevert("Faucet: cooldown");
        faucet.claim(token);
        vm.stopPrank();
    }

    function test_ClaimSucceedsAfterCooldownElapses() public {
        vm.startPrank(alice);
        faucet.claim(token);
        vm.warp(block.timestamp + faucet.COOLDOWN());
        faucet.claim(token);
        vm.stopPrank();

        assertEq(SeedToken(token).balanceOf(alice), faucet.CLAIM_AMOUNT() * 2);
    }

    function test_ClaimManySkipsCooldownTokensInsteadOfReverting() public {
        address token2 = factory.deployToken("Second", "SEC");
        address[] memory newlySupported = new address[](1);
        newlySupported[0] = token2;
        faucet.setSupportedTokens(newlySupported, true);

        address[] memory claimTokens = new address[](2);
        claimTokens[0] = token;
        claimTokens[1] = token2;

        vm.startPrank(alice);
        faucet.claimMany(claimTokens);
        // token is now on cooldown; claimMany should skip it, not revert.
        faucet.claimMany(claimTokens);
        vm.stopPrank();

        assertEq(SeedToken(token).balanceOf(alice), faucet.CLAIM_AMOUNT());
        assertEq(SeedToken(token2).balanceOf(alice), faucet.CLAIM_AMOUNT());
    }

    function test_ClaimManyRevertsOnUnsupportedToken() public {
        address other = factory.deployToken("Other", "OTH");
        address[] memory claimTokens = new address[](1);
        claimTokens[0] = other;

        vm.expectRevert(abi.encodeWithSelector(Faucet.UnsupportedToken.selector, other));
        vm.prank(alice);
        faucet.claimMany(claimTokens);
    }

    function test_ClaimManyRevertsWhenBatchTooLarge() public {
        address[] memory claimTokens = new address[](faucet.MAX_BATCH() + 1);

        vm.expectRevert(abi.encodeWithSelector(Faucet.TooManyTokens.selector, claimTokens.length));
        vm.prank(alice);
        faucet.claimMany(claimTokens);
    }

    function test_ClaimableAtReturnsZeroBeforeFirstClaim() public {
        address[] memory tokens = new address[](1);
        tokens[0] = token;

        uint256[] memory result = faucet.claimableAt(alice, tokens);
        assertEq(result[0], 0);
    }

    function test_ClaimableAtReturnsCooldownEndAfterClaim() public {
        vm.prank(alice);
        faucet.claim(token);

        address[] memory tokens = new address[](1);
        tokens[0] = token;
        uint256[] memory result = faucet.claimableAt(alice, tokens);

        assertEq(result[0], block.timestamp + faucet.COOLDOWN());
    }

    function test_SetSupportedTokensRevertsForNonOwner() public {
        address[] memory tokens = new address[](1);
        tokens[0] = token;

        vm.prank(alice);
        vm.expectRevert();
        faucet.setSupportedTokens(tokens, false);
    }

    function test_RescueTransfersOutStrandedBalance() public {
        vm.prank(address(faucet));
        SeedToken(token).mint(100 ether);

        uint256 ownerBalanceBefore = SeedToken(token).balanceOf(owner);
        faucet.rescue(token, owner, 100 ether);

        assertEq(SeedToken(token).balanceOf(owner), ownerBalanceBefore + 100 ether);
        assertEq(SeedToken(token).balanceOf(address(faucet)), 0);
    }

    function test_RescueRevertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        faucet.rescue(token, alice, 0);
    }
}
