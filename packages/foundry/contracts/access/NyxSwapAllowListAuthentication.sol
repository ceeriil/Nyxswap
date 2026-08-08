// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { INyxSwapAllowList } from "./interfaces/INyxSwapAllowList.sol";

/// @title NyxSwap Allow List Authentication
/// @notice Ported from CoW Protocol's GPv2AllowListAuthentication — a manager-controlled
/// address allow list. CoW uses this to gate who may call `settle()`; NyxSwap has no
/// solver/settlement concept, so this gates deposit/withdraw instead — see
/// NyxSwapInstructionSender, which checks `isAllowed(msg.sender)` before either.
///
/// Dropped from the original during the port: the EIP-1967 proxy-admin fallback
/// (`onlyManagerOrOwner`) and the `Initializable` proxy-initializer pattern — neither
/// applies here since this contract isn't deployed behind a proxy (plain constructor,
/// same as every other contract in this package).
contract NyxSwapAllowListAuthentication is INyxSwapAllowList {
    /// @notice The address that can add/remove allow-listed accounts.
    address public manager;

    /// @notice The set of allow-listed accounts.
    mapping(address => bool) private allowedAccounts;

    /// @notice Emitted when the manager changes.
    event ManagerChanged(address indexed newManager, address indexed oldManager);

    /// @notice Emitted when an account is added to the allow list.
    event AccountAllowed(address indexed account);

    /// @notice Emitted when an account is removed from the allow list.
    event AccountDisallowed(address indexed account);

    constructor(address _manager) {
        manager = _manager;
        emit ManagerChanged(_manager, address(0));
    }

    /// @notice Restricts a function to the current manager.
    modifier onlyManager() {
        require(msg.sender == manager, "NyxSwap: caller not manager");
        _;
    }

    /// @notice Reassigns the manager role.
    /// @param _manager The new manager address.
    function setManager(address _manager) external onlyManager {
        address oldManager = manager;
        manager = _manager;
        emit ManagerChanged(_manager, oldManager);
    }

    /// @notice Adds an address to the allow list. Idempotent.
    /// @param account The address to allow.
    function addToAllowlist(address account) external onlyManager {
        allowedAccounts[account] = true;
        emit AccountAllowed(account);
    }

    /// @notice Removes an address from the allow list. Idempotent.
    /// @param account The address to disallow.
    function removeFromAllowlist(address account) external onlyManager {
        allowedAccounts[account] = false;
        emit AccountDisallowed(account);
    }

    /// @inheritdoc INyxSwapAllowList
    function isAllowed(address account) external view override returns (bool) {
        return allowedAccounts[account];
    }
}
