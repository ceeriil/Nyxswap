// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import { TestFtsoV2Interface } from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
import { INyxSwapPriceOracle } from "./interfaces/INyxSwapPriceOracle.sol";

/// @title NyxSwap Price Oracle
/// @notice Two price sources per token, FTSO always taking priority:
/// 1. Real FTSOv2 feed (setFeed) — live, pull-based, never goes stale, nothing to run.
/// 2. Manual push price (setManualPrice) — for tokens with no real FTSO feed (most
///    SeedTokenFactory mocks: PiCO, BUGO, JOULE, the Cyclo/Sceptre/SparkDEX derivatives,
///    etc.). A keeper script periodically pushes an off-chain-sourced USD price
///    on-chain. Unlike FTSO, this CAN go stale if the keeper stops running, so a pushed
///    price older than `maxManualPriceAge` is treated as if it doesn't exist — fails
///    open the same as an unconfigured token, rather than trusting frozen data forever.
/// @dev Not every token has either kind of price — a handful of the mocks (cUSDX, yUSDX)
/// have no real-world reference anywhere. Callers must handle hasFeed() returning false.
contract NyxSwapPriceOracle is INyxSwapPriceOracle {
    struct ManualPrice {
        uint256 value;
        int8 decimals;
        uint64 timestamp;
        bool exists;
    }

    address public owner;
    uint256 public immutable maxManualPriceAge;

    mapping(address => bytes21) public feedIdFor;
    mapping(address => ManualPrice) public manualPriceFor;

    event FeedSet(address indexed token, bytes21 feedId);
    event ManualPriceSet(address indexed token, uint256 value, int8 decimals, uint64 timestamp);
    event ManualPriceCleared(address indexed token);
    event OwnerTransferred(address indexed previous, address indexed next);

    modifier onlyOwner() {
        require(msg.sender == owner, "NyxSwap: caller not owner");
        _;
    }

    constructor(address _owner, uint256 _maxManualPriceAge) {
        require(_owner != address(0), "NyxSwap: owner zero");
        require(_maxManualPriceAge > 0, "NyxSwap: max age zero");
        owner = _owner;
        maxManualPriceAge = _maxManualPriceAge;
        emit OwnerTransferred(address(0), _owner);
    }

    /// @notice Sets (or clears, with feedId == 0) the FTSO feed for `token`. Takes
    /// priority over any manual price set for the same token.
    function setFeed(address token, bytes21 feedId) external onlyOwner {
        require(token != address(0), "NyxSwap: token zero");
        feedIdFor[token] = feedId;
        emit FeedSet(token, feedId);
    }

    /// @notice Push-oracle path for tokens with no real FTSO feed — a keeper script
    /// calls this periodically with an off-chain-sourced USD price. No-op on the
    /// deviation check once `maxManualPriceAge` elapses without a fresh call.
    function setManualPrice(address token, uint256 value, int8 decimals) external onlyOwner {
        require(token != address(0), "NyxSwap: token zero");
        require(value > 0, "NyxSwap: value zero");
        require(decimals >= 0, "NyxSwap: negative decimals unsupported");
        manualPriceFor[token] =
            ManualPrice({ value: value, decimals: decimals, timestamp: uint64(block.timestamp), exists: true });
        emit ManualPriceSet(token, value, decimals, uint64(block.timestamp));
    }

    function clearManualPrice(address token) external onlyOwner {
        delete manualPriceFor[token];
        emit ManualPriceCleared(token);
    }

    function transferOwner(address next) external onlyOwner {
        require(next != address(0), "NyxSwap: next owner zero");
        emit OwnerTransferred(owner, next);
        owner = next;
    }

    /// @inheritdoc INyxSwapPriceOracle
    function hasFeed(address token) public view returns (bool) {
        if (feedIdFor[token] != bytes21(0)) return true;
        ManualPrice memory manual = manualPriceFor[token];
        return manual.exists && block.timestamp - manual.timestamp <= maxManualPriceAge;
    }

    /// @inheritdoc INyxSwapPriceOracle
    function getPrice(address token) external view returns (uint256 value, int8 decimals, uint64 timestamp) {
        bytes21 feedId = feedIdFor[token];
        if (feedId != bytes21(0)) {
            TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
            return ftsoV2.getFeedById(feedId);
        }

        ManualPrice memory manual = manualPriceFor[token];
        require(manual.exists, "NyxSwap: no feed for token");
        require(block.timestamp - manual.timestamp <= maxManualPriceAge, "NyxSwap: manual price stale");
        return (manual.value, manual.decimals, manual.timestamp);
    }
}
