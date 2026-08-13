// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { SeedToken } from "./SeedToken.sol";

contract SeedTokenFactory {
    struct TokenInfo {
        address token;
        string symbol;
        string name;
    }

    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    address public immutable implementation;

    TokenInfo[] private _deployedTokens;
    mapping(string symbol => address token) public tokenBySymbol;

    event TokenDeployed(address indexed token, string symbol, string name);

    constructor() {
        implementation = address(new SeedToken());
    }

    function deployToken(string calldata name_, string calldata symbol_) public returns (address token) {
        require(tokenBySymbol[symbol_] == address(0), "symbol already deployed");

        token = Clones.clone(implementation);
        SeedToken(token).initialize(name_, symbol_, INITIAL_SUPPLY, msg.sender);

        tokenBySymbol[symbol_] = token;
        _deployedTokens.push(TokenInfo({ token: token, symbol: symbol_, name: name_ }));

        emit TokenDeployed(token, symbol_, name_);
    }

    function allTokens() external view returns (TokenInfo[] memory) {
        return _deployedTokens;
    }

    function tokenCount() external view returns (uint256) {
        return _deployedTokens.length;
    }
}
