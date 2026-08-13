// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { DeployTestTokens } from "../script/mocks/DeployTestTokens.s.sol";
import { SeedTokenFactory } from "../contracts/token/SeedTokenFactory.sol";
import { SeedToken } from "../contracts/token/SeedToken.sol";
import { Faucet } from "../contracts/token/Faucet.sol";

contract DeployTestTokensTest is Test {
    // Mirrors DeployTestTokens.s.sol's TokenConfig — fields must stay
    // alphabetical for the same reason they do there.
    struct TokenConfig {
        uint8 decimals;
        string key;
        string logoURI;
        string name;
        string symbol;
    }

    // Runs the real deploy script end-to-end (SeedTokenFactory + every
    // tokens.json entry + Faucet wiring) and checks the result against
    // tokens.json directly, so this test stays correct even if the token
    // list changes.
    function test_RunDeploysFactoryAllTokensAndWiresFaucet() public {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/script/mocks/tokens.json"));
        TokenConfig[] memory tokens = abi.decode(vm.parseJson(json), (TokenConfig[]));

        DeployTestTokens deployScript = new DeployTestTokens();
        deployScript.run();

        (string memory factoryName, address factoryAddress) = deployScript.deployments(0);
        assertEq(factoryName, "SeedTokenFactory");
        SeedTokenFactory factory = SeedTokenFactory(factoryAddress);
        assertEq(factory.tokenCount(), tokens.length);

        address[] memory tokenAddresses = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            (string memory key, address tokenAddress) = deployScript.deployments(i + 1);
            assertEq(key, tokens[i].key);
            assertEq(factory.tokenBySymbol(tokens[i].symbol), tokenAddress);

            SeedToken deployedToken = SeedToken(tokenAddress);
            assertEq(deployedToken.name(), tokens[i].name);
            assertEq(deployedToken.symbol(), tokens[i].symbol);
            assertEq(deployedToken.decimals(), 18);
            assertEq(deployedToken.totalSupply(), factory.INITIAL_SUPPLY());

            tokenAddresses[i] = tokenAddress;
        }

        (string memory faucetName, address faucetAddress) = deployScript.deployments(tokens.length + 1);
        assertEq(faucetName, "Faucet");
        Faucet faucet = Faucet(faucetAddress);
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            assertTrue(faucet.isSupportedToken(tokenAddresses[i]));
        }
    }
}
