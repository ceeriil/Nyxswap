// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract SeedToken is Initializable, ERC20 {
    string private _tokenName;
    string private _tokenSymbol;

    constructor() ERC20("", "") {
        _disableInitializers();
    }

    function initialize(string calldata name_, string calldata symbol_, uint256 initialSupply, address recipient)
        external
        initializer
    {
        _tokenName = name_;
        _tokenSymbol = symbol_;
        _mint(recipient, initialSupply);
    }

    // Testnet faucet - these tokens only ever exist behind SeedTokenFactory
    // on local/Base Sepolia deploys, so anyone being able to mint to
    // themselves is intentional, not a bug.
    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function name() public view override returns (string memory) {
        return _tokenName;
    }

    function symbol() public view override returns (string memory) {
        return _tokenSymbol;
    }
}
