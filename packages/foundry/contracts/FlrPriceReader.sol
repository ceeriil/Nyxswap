// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { ContractRegistry } from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import { TestFtsoV2Interface } from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";

/// @title FlrPriceReader — reads the FLR/USD price from Flare's FTSOv2 oracle.
/// @dev Looks up the live FtsoV2 address via Flare's ContractRegistry on every
/// call instead of a hardcoded address, so it keeps working across upgrades.
contract FlrPriceReader {
    bytes21 public constant FLR_USD_FEED_ID = 0x01464c522f55534400000000000000000000000000; // "FLR/USD"

    /// @return value The FLR/USD price, scaled by `decimals`.
    /// @return decimals Decimal places `value` is scaled by.
    /// @return timestamp Unix timestamp of the last FTSO update for this feed.
    function getFlrUsdPrice() external view returns (uint256 value, int8 decimals, uint64 timestamp) {
        TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
        return ftsoV2.getFeedById(FLR_USD_FEED_ID);
    }
}
