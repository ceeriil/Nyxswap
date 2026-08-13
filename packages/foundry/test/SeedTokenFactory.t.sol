// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { SeedTokenFactory } from "../contracts/token/SeedTokenFactory.sol";
import { SeedToken } from "../contracts/token/SeedToken.sol";

contract SeedTokenFactoryTest is Test {
    SeedTokenFactory factory;

    function setUp() public {
        factory = new SeedTokenFactory();
    }

    function test_DeployTokenMintsInitialSupplyToCaller() public {
        address token = factory.deployToken("Wrapped Flare", "WFLR");

        assertEq(SeedToken(token).name(), "Wrapped Flare");
        assertEq(SeedToken(token).symbol(), "WFLR");
        assertEq(SeedToken(token).decimals(), 18);
        assertEq(SeedToken(token).balanceOf(address(this)), factory.INITIAL_SUPPLY());
        assertEq(SeedToken(token).totalSupply(), factory.INITIAL_SUPPLY());
    }

    function test_DeployTokenRegistersInFactory() public {
        address token = factory.deployToken("Wrapped Flare", "WFLR");

        assertEq(factory.tokenBySymbol("WFLR"), token);
        assertEq(factory.tokenCount(), 1);

        SeedTokenFactory.TokenInfo[] memory all = factory.allTokens();
        assertEq(all.length, 1);
        assertEq(all[0].token, token);
        assertEq(all[0].symbol, "WFLR");
        assertEq(all[0].name, "Wrapped Flare");
    }

    function test_DeployTokenRevertsOnDuplicateSymbol() public {
        factory.deployToken("Wrapped Flare", "WFLR");

        vm.expectRevert("symbol already deployed");
        factory.deployToken("Wrapped Flare Duplicate", "WFLR");
    }

    function test_DifferentCallersGetIndependentBalances() public {
        address tokenA = factory.deployToken("Token A", "AAA");
        vm.prank(address(0xBEEF));
        address tokenB = factory.deployToken("Token B", "BBB");

        assertEq(SeedToken(tokenA).balanceOf(address(this)), factory.INITIAL_SUPPLY());
        assertEq(SeedToken(tokenB).balanceOf(address(0xBEEF)), factory.INITIAL_SUPPLY());
        assertEq(SeedToken(tokenB).balanceOf(address(this)), 0);
    }

    function test_ClonesArePubliclyMintable() public {
        address token = factory.deployToken("Wrapped Flare", "WFLR");

        vm.prank(address(0xCAFE));
        SeedToken(token).mint(123 ether);

        assertEq(SeedToken(token).balanceOf(address(0xCAFE)), 123 ether);
    }

    function test_ImplementationCannotBeInitialized() public {
        address impl = factory.implementation();

        vm.expectRevert();
        SeedToken(impl).initialize("x", "x", 1, address(this));
    }

    function test_CloneCannotBeReinitialized() public {
        address token = factory.deployToken("Wrapped Flare", "WFLR");

        vm.expectRevert();
        SeedToken(token).initialize("Other", "OTH", 1, address(this));
    }
}
