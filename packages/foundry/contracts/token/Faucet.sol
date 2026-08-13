// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Minimal interface for SeedToken's testnet-only mint(uint256) - mints to
// whichever address calls it (msg.sender), so Faucet mints to itself first
// and forwards the same amount to the claimer.
interface ISeedTokenMintable {
    function mint(uint256 amount) external;
}

// Testnet faucet for the SeedToken clones deployed by SeedTokens.s.sol.
// Mints CLAIM_AMOUNT fresh on every claim rather than paying out of a
// pre-funded balance - no funding step needed at deploy time, and supply
// is never a constraint no matter how many tokens or claimers there are.
contract Faucet is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant CLAIM_AMOUNT = 1_000 ether;
    uint256 public constant COOLDOWN = 1 hours;
    // Bounds claimMany's loop so a caller can't grief gas estimation/block
    // limits with an oversized array - comfortably above the current
    // 40-token set.
    uint256 public constant MAX_BATCH = 64;

    // token => user => last claim timestamp.
    mapping(address => mapping(address => uint256)) public lastClaimed;
    mapping(address => bool) public isSupportedToken;

    event Claimed(address indexed user, address indexed token, uint256 amount);
    event Skipped(address indexed user, address indexed token, uint256 availableAt);
    event TokensSupported(address[] tokens, bool supported);
    event Rescued(address indexed token, address indexed to, uint256 amount);

    error UnsupportedToken(address token);
    error TooManyTokens(uint256 count);

    constructor(address owner_) Ownable(owner_) { }

    function setSupportedTokens(address[] calldata tokens, bool supported) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            isSupportedToken[tokens[i]] = supported;
        }
        emit TokensSupported(tokens, supported);
    }

    // Reverts on cooldown (unlike claimMany) - a direct single-token claim
    // is a caller mistake, not a batch where skipping keeps things moving.
    function claim(address token) external nonReentrant {
        if (!isSupportedToken[token]) revert UnsupportedToken(token);
        uint256 last = lastClaimed[token][msg.sender];
        require(last == 0 || block.timestamp >= last + COOLDOWN, "Faucet: cooldown");

        lastClaimed[token][msg.sender] = block.timestamp;
        ISeedTokenMintable(token).mint(CLAIM_AMOUNT);
        IERC20(token).safeTransfer(msg.sender, CLAIM_AMOUNT);
        emit Claimed(msg.sender, token, CLAIM_AMOUNT);
    }

    // Every requested token must be supported (an unsupported address is an
    // integration error, so it reverts the whole call) but a token still on
    // cooldown is just skipped - emits Skipped instead of failing the rest
    // of the batch, so the frontend can read one receipt's logs to see
    // exactly what was sent vs. skipped.
    function claimMany(address[] calldata tokens) external nonReentrant {
        if (tokens.length > MAX_BATCH) revert TooManyTokens(tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (!isSupportedToken[token]) revert UnsupportedToken(token);

            uint256 last = lastClaimed[token][msg.sender];
            if (last != 0 && block.timestamp < last + COOLDOWN) {
                emit Skipped(msg.sender, token, last + COOLDOWN);
                continue;
            }

            lastClaimed[token][msg.sender] = block.timestamp;
            ISeedTokenMintable(token).mint(CLAIM_AMOUNT);
            IERC20(token).safeTransfer(msg.sender, CLAIM_AMOUNT);
            emit Claimed(msg.sender, token, CLAIM_AMOUNT);
        }
    }

    // 0 or a past timestamp means claimable now - lets the frontend render
    // cooldown state for every token in one call instead of one-per-token.
    function claimableAt(address user, address[] calldata tokens) external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 last = lastClaimed[tokens[i]][user];
            result[i] = last == 0 ? 0 : last + COOLDOWN;
        }
        return result;
    }

    // Safety valve only - normal operation mints and forwards in the same
    // tx, so this contract shouldn't hold a balance between calls.
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit Rescued(token, to, amount);
    }
}
