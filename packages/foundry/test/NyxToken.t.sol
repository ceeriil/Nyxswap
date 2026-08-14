// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { NyxToken } from "../contracts/token/NyxToken.sol";

contract NyxTokenTest is Test {
    NyxToken token;
    address owner = address(this);
    address minter = address(0xBEEF);
    address recipient = address(0xCAFE);

    function setUp() public {
        token = new NyxToken(owner);
    }

    function test_NameAndSymbol() public view {
        assertEq(token.name(), "NYX");
        assertEq(token.symbol(), "NYX");
    }

    function test_NoInitialSupply() public view {
        assertEq(token.totalSupply(), 0);
    }

    function test_MintRevertsBeforeMinterIsSet() public {
        vm.expectRevert("NyxSwap: caller not minter");
        token.mint(recipient, 100 ether);
    }

    function test_SetMinterThenMintSucceeds() public {
        token.setMinter(minter);

        vm.prank(minter);
        token.mint(recipient, 100 ether);

        assertEq(token.balanceOf(recipient), 100 ether);
        assertEq(token.totalSupply(), 100 ether);
    }

    function test_MintRevertsForNonMinter() public {
        token.setMinter(minter);

        vm.prank(address(0xBAD));
        vm.expectRevert("NyxSwap: caller not minter");
        token.mint(recipient, 100 ether);
    }

    function test_SetMinterRevertsForNonOwner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert("NyxSwap: caller not owner");
        token.setMinter(minter);
    }

    function test_SetMinterCanRepointToANewMinter() public {
        token.setMinter(minter);
        address newMinter = address(0xF00D);
        token.setMinter(newMinter);

        vm.prank(minter);
        vm.expectRevert("NyxSwap: caller not minter");
        token.mint(recipient, 1 ether);

        vm.prank(newMinter);
        token.mint(recipient, 1 ether);
        assertEq(token.balanceOf(recipient), 1 ether);
    }

    function test_TransferOwnerMovesAdminRights() public {
        address nextOwner = address(0xB0B);
        token.transferOwner(nextOwner);

        vm.expectRevert("NyxSwap: caller not owner");
        token.setMinter(minter);

        vm.prank(nextOwner);
        token.setMinter(minter);
        assertEq(token.minter(), minter);
    }

    function test_ConstructorRevertsForZeroOwner() public {
        vm.expectRevert("NyxSwap: owner zero");
        new NyxToken(address(0));
    }
}
