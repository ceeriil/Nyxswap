// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title NyxSwap Instruction Messages
/// @notice Payload structs for NyxSwapInstructionSender's on-chain instructions, kept
/// in their own file so they can be shared (e.g. by TEE-side handler/binding code)
/// without pulling in the sender contract itself.
library NyxSwapMessages {
    /// @notice Payload for the DEPOSIT instruction.
    struct DepositMessage {
        address user;
        address token;
        uint256 amount;
    }

    /// @notice Payload for the WITHDRAW instruction. `user` is whose balance gets
    /// debited (the requester); `to` is where the funds are ultimately released —
    /// they can differ, e.g. a Flare Smart Account requesting a payout to its owner's
    /// real EOA.
    struct WithdrawMessage {
        address user;
        address token;
        uint256 amount;
        address to;
    }

    /// @notice Payload for the FSA_OP instruction — an on-chain-triggered wrapper
    /// carrying the same encrypted payload an off-chain direct action would, for
    /// callers (Flare Smart Accounts, custodial wallets, programmatic flows) that want
    /// an on-chain audit trail without revealing what the instruction does. On-chain
    /// observers see only (innerCommand, ciphertext).
    struct FsaOpMessage {
        bytes32 innerCommand;
        bytes encryptedBlob;
    }
}
