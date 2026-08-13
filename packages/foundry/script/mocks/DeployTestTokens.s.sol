//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../deploy/DeployHelpers.s.sol";
import { SeedTokenFactory } from "../../contracts/token/SeedTokenFactory.sol";
import { Faucet } from "../../contracts/token/Faucet.sol";

/**
 * @notice Deploys a SeedTokenFactory, then clones one SeedToken per entry in
 * script/mocks/tokens.json via SeedTokenFactory.deployToken(name, symbol),
 * then deploys a Faucet and registers every cloned token as claimable on it.
 * Every SeedToken clone is a fixed 18 decimals (ERC20 default, not
 * overridden by SeedToken) regardless of tokens.json's `decimals` field —
 * that field is metadata only here, kept for parity with any frontend token
 * list reading the same JSON.
 * @dev Run via scripts-js/deployTestTokens.js, not `yarn deploy` directly.
 */
contract DeployTestTokens is ScaffoldETHDeploy {
    // Fields must stay alphabetical: abi.decode(vm.parseJson(...), (T[]))
    // maps JSON object keys onto struct members by alphabetical order, not
    // declaration order.
    struct TokenConfig {
        uint8 decimals;
        string key;
        string logoURI;
        string name;
        string symbol;
    }

    function run() external ScaffoldEthDeployerRunner {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/script/mocks/tokens.json"));
        TokenConfig[] memory tokens = abi.decode(vm.parseJson(json), (TokenConfig[]));

        SeedTokenFactory factory = new SeedTokenFactory();
        deployments.push(Deployment("SeedTokenFactory", address(factory)));

        address[] memory tokenAddresses = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = factory.deployToken(tokens[i].name, tokens[i].symbol);
            tokenAddresses[i] = token;
            deployments.push(Deployment(tokens[i].key, token));
        }

        Faucet faucet = new Faucet(deployer);
        faucet.setSupportedTokens(tokenAddresses, true);
        deployments.push(Deployment("Faucet", address(faucet)));
    }
}
