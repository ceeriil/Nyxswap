//SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./DeployHelpers.s.sol";
import { NyxSwapPriceOracle } from "../../contracts/NyxSwapPriceOracle.sol";

/**
 * @notice Deploys NyxSwapPriceOracle and configures FTSOv2 feeds for the handful of
 * SeedTokenFactory tokens (see script/mocks/tokens.json) that mock a real, FTSO-priced
 * asset. The other 13 tokens with a real off-chain price (CoinGecko-listed, just no FTSO
 * feed) get theirs pushed on-chain instead — see scripts-js/pushPrices.js, which needs
 * to run periodically against this oracle's setManualPrice(). MAX_MANUAL_PRICE_AGE below
 * is how long a pushed price stays trusted before the deviation check fails open for it.
 * The remaining tokens (cUSDX, yUSDX) have no real-world reference anywhere and are
 * deliberately left unset — NyxSwapPool.swap()'s deviation check fails open for those.
 * @dev Run with: yarn deploy --file deploy/DeployNyxSwapPriceOracle.s.sol --network coston2
 */
contract DeployNyxSwapPriceOracle is ScaffoldETHDeploy {
    uint256 constant MAX_MANUAL_PRICE_AGE = 1 hours;

    // Already-deployed SeedTokenFactory clones on Coston2 (see deployments/114.json /
    // ../nextjs/contracts/deployedContracts.ts) that mock a token with a real FTSO feed.
    address constant WFLR_TEST_TOKEN = 0x6E9AB7ad2c35E4235Ab97d7BD99699B63d8E1267;
    address constant FXRP_TEST_TOKEN = 0x23f186F13Cc30926eAd941e517c223A0d6082fc4;
    address constant WETH_TEST_TOKEN = 0xC6DB5396CCea7792E1911Bb6A6838b77Df8ac47f;
    address constant USDT_TEST_TOKEN = 0x0187290186B88c45E6BbA1eE797d156270564A4A;
    address constant USDCE_TEST_TOKEN = 0xa1190CA2B6C5356b5645cf0a4d4F982ce8ec89bc;

    // FTSOv2 feed IDs: 0x01 (category: Crypto) + ASCII "<TICKER>/USD", zero-padded to 21
    // bytes. Matches FlrPriceReader.FLR_USD_FEED_ID's exact encoding.
    bytes21 constant FLR_USD_FEED_ID = 0x01464c522f55534400000000000000000000000000;
    bytes21 constant XRP_USD_FEED_ID = 0x015852502f55534400000000000000000000000000;
    bytes21 constant ETH_USD_FEED_ID = 0x014554482f55534400000000000000000000000000;
    bytes21 constant USDT_USD_FEED_ID = 0x01555344542f555344000000000000000000000000;
    bytes21 constant USDC_USD_FEED_ID = 0x01555344432f555344000000000000000000000000;

    function run() external ScaffoldEthDeployerRunner {
        NyxSwapPriceOracle oracle = new NyxSwapPriceOracle(deployer, MAX_MANUAL_PRICE_AGE);
        deployments.push(Deployment("NyxSwapPriceOracle", address(oracle)));

        oracle.setFeed(WFLR_TEST_TOKEN, FLR_USD_FEED_ID);
        oracle.setFeed(FXRP_TEST_TOKEN, XRP_USD_FEED_ID);
        oracle.setFeed(WETH_TEST_TOKEN, ETH_USD_FEED_ID);
        oracle.setFeed(USDT_TEST_TOKEN, USDT_USD_FEED_ID);
        oracle.setFeed(USDCE_TEST_TOKEN, USDC_USD_FEED_ID);
    }
}
