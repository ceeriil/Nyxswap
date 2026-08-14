// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title NYX Token
/// @notice NyxSwap's liquidity-mining reward token. No fixed/pre-minted supply — minted
/// on demand by whichever contract holds `minter` (NyxSwapLiquidityMining), as LPs earn
/// it over time. Owner can repoint `minter` (e.g. if the mining contract is redeployed)
/// but cannot mint directly — the token has no special-cased owner mint path.
contract NyxToken is ERC20 {
    address public owner;
    address public minter;

    event MinterSet(address indexed previous, address indexed next);
    event OwnerTransferred(address indexed previous, address indexed next);

    modifier onlyOwner() {
        require(msg.sender == owner, "NyxSwap: caller not owner");
        _;
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "NyxSwap: caller not minter");
        _;
    }

    constructor(address _owner) ERC20("NYX", "NYX") {
        require(_owner != address(0), "NyxSwap: owner zero");
        owner = _owner;
        emit OwnerTransferred(address(0), _owner);
    }

    function setMinter(address next) external onlyOwner {
        emit MinterSet(minter, next);
        minter = next;
    }

    function transferOwner(address next) external onlyOwner {
        require(next != address(0), "NyxSwap: next owner zero");
        emit OwnerTransferred(owner, next);
        owner = next;
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
}
