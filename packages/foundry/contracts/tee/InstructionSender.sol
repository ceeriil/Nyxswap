// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// TODO: Replace local interfaces with imports from flare-smart-contracts-v2 once published as a package.
import { ITeeExtensionRegistry } from "./interfaces/ITeeExtensionRegistry.sol";
import { ITeeMachineRegistry } from "./interfaces/ITeeMachineRegistry.sol";
import { NyxSwapMessages } from "./NyxSwapMessages.sol";
import { INyxSwapAllowList } from "../access/interfaces/INyxSwapAllowList.sol";
import { INyxSwapVault } from "../interfaces/INyxSwapVault.sol";
import { IERC20 } from "../interfaces/IERC20.sol";

/// @title NyxSwapInstructionSender
/// @author NyxSwap
/// @notice On-chain entry point for NyxSwap's dark-pool order flow.
///
/// DEPOSIT and WITHDRAW are plain ABI-encoded structs (see NyxSwapMessages.sol), and
/// that's fine: the deposit already happened on-chain, the withdrawal will happen
/// on-chain (via NyxSwapVault.withdraw, once the TEE signs a release), so there's
/// nothing to hide about either one. Both have a relay path for accounts that can't
/// submit their own transactions (depositFor, and requestWithdraw's `to` param) — see
/// each function's docs. Order placement, cancellation, and matching normally never touch
/// this contract at all — they go through the TEE's encrypted off-chain direct-action
/// channel (PLACE_ORDER/CANCEL_ORDER), and matches are never broadcast (see
/// NyxSwapVault's header for why). FSA_OP is the one exception: an on-chain wrapper
/// carrying that same encrypted payload, for callers who want an on-chain audit trail
/// without revealing what the instruction does — see submitEncryptedOp().
///
/// Message payload structs live in NyxSwapMessages.sol, not here.
///
/// DO NOT MODIFY: constructor, setExtensionId(), _getExtensionId()
contract NyxSwapInstructionSender {
    /// @notice Operation type for trading actions (DEPOSIT, WITHDRAW).
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_TYPE_TRADING = bytes32("TRADING");

    /// @notice Command for the DEPOSIT action.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_DEPOSIT = bytes32("DEPOSIT");

    /// @notice Command for the WITHDRAW action.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_WITHDRAW = bytes32("WITHDRAW");

    /// @notice Command for the FSA_OP action.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_FSA_OP = bytes32("FSA_OP");

    /// @notice Reference to the TEE extension registry contract.
    ITeeExtensionRegistry public immutable TEE_EXTENSION_REGISTRY;
    /// @notice Reference to the TEE machine registry contract.
    ITeeMachineRegistry public immutable TEE_MACHINE_REGISTRY;

    /// @notice The vault deposits are custodied in and withdrawals are released from.
    INyxSwapVault public immutable VAULT;
    address public immutable VAULT_ADDRESS;

    /// @notice Gates who may deposit or request a withdrawal.
    INyxSwapAllowList public immutable ALLOW_LIST;

    /// @notice First public extension ID. The registry reserves IDs below this
    /// for system/reserved extensions; public extensions are assigned from here up.
    uint256 private constant FIRST_PUBLIC_EXTENSION_ID = 0x10000; // 65536

    uint256 private _extensionId;

    /// @notice Initializes the contract with registry, vault, and allow-list addresses.
    /// @param _teeExtensionRegistry Address of the TEE extension registry.
    /// @param _teeMachineRegistry Address of the TEE machine registry.
    /// @param _vault Address of the NyxSwap vault deposits/withdrawals move through.
    /// @param _allowList Address of the deposit/withdraw allow-list.
    constructor(
        ITeeExtensionRegistry _teeExtensionRegistry,
        ITeeMachineRegistry _teeMachineRegistry,
        INyxSwapVault _vault,
        INyxSwapAllowList _allowList
    ) {
        require(address(_teeExtensionRegistry) != address(0), "TeeExtensionRegistry cannot be zero address");
        require(address(_teeMachineRegistry) != address(0), "TeeMachineRegistry cannot be zero address");
        require(address(_vault) != address(0), "Vault cannot be zero address");
        require(address(_allowList) != address(0), "AllowList cannot be zero address");
        require(address(_teeExtensionRegistry).code.length > 0, "TeeExtensionRegistry has no code");
        require(address(_teeMachineRegistry).code.length > 0, "TeeMachineRegistry has no code");
        require(address(_vault).code.length > 0, "Vault has no code");
        require(address(_allowList).code.length > 0, "AllowList has no code");
        TEE_EXTENSION_REGISTRY = _teeExtensionRegistry;
        TEE_MACHINE_REGISTRY = _teeMachineRegistry;
        VAULT = _vault;
        VAULT_ADDRESS = address(_vault);
        ALLOW_LIST = _allowList;
    }

    /// @notice Finds and sets this contract's extension id. Can only be set once.
    /// DO NOT MODIFY this function.
    function setExtensionId() external {
        require(_extensionId == 0, "Extension ID already set.");

        uint256 c = TEE_EXTENSION_REGISTRY.nextPublicExtensionId();
        for (uint256 i = FIRST_PUBLIC_EXTENSION_ID; i < c; ++i) {
            if (TEE_EXTENSION_REGISTRY.getTeeExtensionInstructionsSender(i) == address(this)) {
                _extensionId = i;
                return;
            }
        }
        revert("Extension ID not found.");
    }

    /// @notice Deposit `token` into the vault. Caller must have approved this contract
    /// for `amount` of `token` first.
    /// @dev Tokens move straight to the vault via transferFrom — the vault has no
    /// deposit entrypoint of its own (see NyxSwapVault's header).
    /// @param token The ERC20 to deposit — must be on the vault's allow-list.
    /// @param amount The amount to deposit.
    function deposit(IERC20 token, uint256 amount) external payable {
        require(ALLOW_LIST.isAllowed(msg.sender), "caller not allowed");
        require(VAULT.isAllowedToken(address(token)), "token not allowed");
        require(amount > 0, "amount zero");

        require(token.transferFrom(msg.sender, VAULT_ADDRESS, amount), "transferFrom failed");

        _sendDeposit(msg.sender, token, amount);
    }

    /// @notice Deposit `token` on behalf of `user` — the relay entry point for accounts
    /// that can't submit their own Flare transactions (e.g. Flare Smart Accounts).
    /// Permissionless and safe by construction: tokens only ever move FROM `user`'s own
    /// approval INTO the vault, credited back TO that same `user` — the caller can only
    /// ever spend their own gas, never redirect anyone's funds.
    /// @param user The account whose tokens are pulled and whose balance is credited.
    /// @param token The ERC20 to deposit — must be on the vault's allow-list.
    /// @param amount The amount to deposit.
    function depositFor(address user, IERC20 token, uint256 amount) external payable {
        require(user != address(0), "user zero");
        require(ALLOW_LIST.isAllowed(user), "user not allowed");
        require(VAULT.isAllowedToken(address(token)), "token not allowed");
        require(amount > 0, "amount zero");

        require(token.transferFrom(user, VAULT_ADDRESS, amount), "transferFrom failed");

        _sendDeposit(user, token, amount);
    }

    /// @notice Requests a withdrawal from the TEE. The TEE debits `msg.sender`'s
    /// internal balance and hands back a signed release; submit that to
    /// NyxSwapVault.withdraw() to actually receive the tokens — this call only starts
    /// that process.
    /// @param token The ERC20 to withdraw.
    /// @param amount The amount to withdraw.
    /// @param to Destination for the released funds — may differ from msg.sender, e.g.
    /// a Flare Smart Account requesting a payout to its owner's real EOA.
    function requestWithdraw(address token, uint256 amount, address to) external payable {
        require(ALLOW_LIST.isAllowed(msg.sender), "caller not allowed");
        require(amount > 0, "amount zero");
        require(to != address(0), "to zero");

        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_TRADING,
            opCommand: OP_COMMAND_WITHDRAW,
            message: abi.encode(
                NyxSwapMessages.WithdrawMessage({ user: msg.sender, token: token, amount: amount, to: to })
            ),
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        TEE_EXTENSION_REGISTRY.sendInstructions{ value: msg.value }(teeIds, params);
    }

    /// @dev Shared DEPOSIT-instruction relay for deposit() and depositFor().
    function _sendDeposit(address user, IERC20 token, uint256 amount) internal {
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_TRADING,
            opCommand: OP_COMMAND_DEPOSIT,
            message: abi.encode(NyxSwapMessages.DepositMessage({ user: user, token: address(token), amount: amount })),
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        TEE_EXTENSION_REGISTRY.sendInstructions{ value: msg.value }(teeIds, params);
    }

    /// @notice FSA-routed encrypted op. The encrypted blob carries the inner-signed
    /// payload — same shape a Direct off-chain action would use, just wrapped in an
    /// on-chain call for callers (Flare Smart Accounts, custodial wallets, programmatic
    /// flows) that want an on-chain audit trail without revealing what the instruction
    /// does. On-chain observers see only (innerCommand, ciphertext).
    /// @param innerCommand The wrapped off-chain-style op command (e.g. PLACE_ORDER).
    /// @param encryptedBlob ECIES-encrypted payload, opaque on-chain.
    function submitEncryptedOp(bytes32 innerCommand, bytes calldata encryptedBlob) external payable {
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_TRADING,
            opCommand: OP_COMMAND_FSA_OP,
            message: abi.encode(
                NyxSwapMessages.FsaOpMessage({ innerCommand: innerCommand, encryptedBlob: encryptedBlob })
            ),
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        TEE_EXTENSION_REGISTRY.sendInstructions{ value: msg.value }(teeIds, params);
    }

    /// @notice Returns the cached extension ID, reverting if not yet set.
    /// @return The extension ID assigned to this contract.
    function _getExtensionId() internal view returns (uint256) {
        require(_extensionId != 0, "Extension ID is not set.");
        return _extensionId;
    }
}
