// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { INyxSwapPool } from "./interfaces/INyxSwapPool.sol";
import { IERC20 } from "./interfaces/IERC20.sol";

/// @title NyxSwap Vault
/// @notice Custody only — balances live in TEE memory, never on-chain. This contract
/// takes deposits via a direct token transfer (see NyxSwapInstructionSender.deposit(),
/// which is the actual user-facing entry point — there's nothing to hide about a
/// deposit itself, see brief.md/the shielded-transfers precedent) and releases funds
/// only when the TEE authorizes it. There is deliberately no on-chain balance ledger
/// and no on-chain record of who matched with whom: matching happens off-chain, inside
/// the TEE, and is never broadcast. Everything this contract releases — a user
/// withdrawal, or a pool fill for an order the TEE couldn't match peer-to-peer — is
/// authorized by a single TEE signature and is not bound to any trader identity
/// on-chain.
contract NyxSwapVault {
    address public owner;
    address public teeAuthority;

    mapping(address => bool) public isAllowedToken;
    mapping(bytes32 => bool) public usedWithdrawals;
    mapping(bytes32 => bool) public usedFills;

    event Withdrawn(address indexed recipient, address indexed token, uint256 amount, bytes32 indexed withdrawalId);
    event PoolFillExecuted(
        bytes32 indexed fillId, address indexed pool, bool aToB, uint256 amountIn, uint256 amountOut
    );
    event AllowedTokenUpdated(address indexed token, bool allowed);
    event TeeAuthoritySet(address indexed tee);
    event OwnerTransferred(address indexed previous, address indexed next);

    modifier onlyOwner() {
        require(msg.sender == owner, "NyxSwap: caller not owner");
        _;
    }

    constructor(address _owner) {
        require(_owner != address(0), "NyxSwap: owner zero");
        owner = _owner;
        emit OwnerTransferred(address(0), _owner);
    }

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        require(token != address(0), "NyxSwap: token zero");
        isAllowedToken[token] = allowed;
        emit AllowedTokenUpdated(token, allowed);
    }

    /// @notice Records the TEE's signing address. Settable once.
    function setTeeAuthority(address tee) external onlyOwner {
        require(teeAuthority == address(0), "NyxSwap: tee authority already set");
        require(tee != address(0), "NyxSwap: tee zero");
        teeAuthority = tee;
        emit TeeAuthoritySet(tee);
    }

    function transferOwner(address next) external onlyOwner {
        require(next != address(0), "NyxSwap: next owner zero");
        emit OwnerTransferred(owner, next);
        owner = next;
    }

    /// @notice Releases `amount` of `token` to `recipient`. Anyone may submit this on
    /// the recipient's behalf, as long as they hold a TEE-signed authorization for this
    /// exact (recipient, token, amount, withdrawalId) tuple. `withdrawalId` is
    /// single-use. Same shape as ShieldedVault.executeWithdraw — the signature is the
    /// authorization, not the caller.
    /// @param signature EIP-191 signature over keccak256(abi.encodePacked(
    ///                      address(this), recipient, token, amount, withdrawalId))
    function withdraw(address recipient, address token, uint256 amount, bytes32 withdrawalId, bytes calldata signature)
        external
    {
        require(teeAuthority != address(0), "NyxSwap: tee authority not set");
        require(isAllowedToken[token], "NyxSwap: token not allowed");
        require(amount > 0, "NyxSwap: amount zero");
        require(!usedWithdrawals[withdrawalId], "NyxSwap: withdrawal already used");

        // forge-lint: disable-next-line(asm-keccak256)
        bytes32 hash = keccak256(abi.encodePacked(address(this), recipient, token, amount, withdrawalId));
        // forge-lint: disable-next-line(asm-keccak256)
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        require(_recover(ethSignedHash, signature) == teeAuthority, "NyxSwap: invalid signature");

        usedWithdrawals[withdrawalId] = true;

        require(IERC20(token).transfer(recipient, amount), "NyxSwap: transfer failed");
        emit Withdrawn(recipient, token, amount, withdrawalId);
    }

    /// @notice Pulls `amountIn` of one side of `pool`'s pair out of this vault's own
    /// custody, swaps it, and keeps the proceeds in the vault. Used when the TEE
    /// couldn't match an order peer-to-peer and needs the pool to fill the remainder
    /// instead. Not bound to any trader on-chain — the TEE tracks who the fill is for
    /// entirely in its own memory, the same way it tracks who owns what after a
    /// deposit. `fillId` is single-use.
    /// @param signature EIP-191 signature over keccak256(abi.encodePacked(
    ///                      address(this), fillId, pool, aToB, amountIn, minAmountOut))
    function fillFromPool(
        bytes32 fillId,
        INyxSwapPool pool,
        bool aToB,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata signature
    ) external returns (uint256 amountOut) {
        require(teeAuthority != address(0), "NyxSwap: tee authority not set");
        require(!usedFills[fillId], "NyxSwap: fill already used");

        // forge-lint: disable-next-line(asm-keccak256)
        bytes32 hash = keccak256(abi.encodePacked(address(this), fillId, address(pool), aToB, amountIn, minAmountOut));
        // forge-lint: disable-next-line(asm-keccak256)
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        require(_recover(ethSignedHash, signature) == teeAuthority, "NyxSwap: invalid signature");

        usedFills[fillId] = true;

        IERC20 tokenIn = aToB ? pool.tokenA() : pool.tokenB();
        require(isAllowedToken[address(tokenIn)], "NyxSwap: token not allowed");

        // Fresh per-call approval, consumed immediately by pool.swap()'s transferFrom.
        require(tokenIn.approve(address(pool), amountIn), "NyxSwap: approve failed");
        amountOut = pool.swap(aToB, amountIn, minAmountOut);

        emit PoolFillExecuted(fillId, address(pool), aToB, amountIn, amountOut);
    }

    /// @dev Lifts a 65-byte (r||s||v) signature into ecrecover-friendly form.
    function _recover(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "NyxSwap: invalid sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        bytes memory sigMem = sig;
        assembly {
            r := mload(add(sigMem, 32))
            s := mload(add(sigMem, 64))
            v := byte(0, mload(add(sigMem, 96)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "NyxSwap: invalid v");
        return ecrecover(hash, v, r, s);
    }
}
