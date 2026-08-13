// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IWETH } from "../interfaces/IWETH.sol";

contract WETH9 is ERC20, IWETH {
    event Deposit(address indexed sender, uint256 amount);
    event Withdrawal(address indexed sender, uint256 amount);

    constructor() ERC20("Wrapped Ether", "WETH") { }

    receive() external payable {
        deposit();
    }

    function deposit() public payable override {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external override {
        _burn(msg.sender, amount);
        emit Withdrawal(msg.sender, amount);
        (bool success,) = msg.sender.call{ value: amount }("");
        require(success, "WETH9: ETH transfer failed");
    }
}
