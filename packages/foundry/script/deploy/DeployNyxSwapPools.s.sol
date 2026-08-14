//SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./DeployHelpers.s.sol";
import { NyxSwapRouter } from "../../contracts/NyxSwapRouter.sol";
import { NyxSwapPriceOracle } from "../../contracts/NyxSwapPriceOracle.sol";
import { IERC20 } from "../../contracts/interfaces/IERC20.sol";

/**
 * @notice Deploys NyxSwapRouter (wired to NyxSwapPriceOracle, 300bps deviation
 * tolerance) and creates a pool for every SeedTokenFactory token against WFLR — a hub
 * pattern (19 pools instead of a full 190-pair mesh), same idea as Uniswap hubbing
 * through WETH. Every token reaches every other token in at most 2 hops via the router.
 *
 * Pools are created empty (zero reserves) — this only wires up the structure. Funding
 * them with actual liquidity is a separate, deliberate step (NyxSwapPool.addReserves),
 * left for whenever real amounts are decided, not invented here.
 * @dev Run with: yarn deploy --file deploy/DeployNyxSwapPools.s.sol --network coston2
 * Run DeployNyxSwapPriceOracle.s.sol FIRST and fill in its deployed address below.
 */
contract DeployNyxSwapPools is ScaffoldETHDeploy {
    // Fill in after running DeployNyxSwapPriceOracle.s.sol.
    address constant PRICE_ORACLE = address(0);

    uint256 constant MAX_DEVIATION_BPS = 300;

    address constant WFLR_TEST_TOKEN = 0x6E9AB7ad2c35E4235Ab97d7BD99699B63d8E1267;

    // All other SeedTokenFactory clones on Coston2 — hubbed against WFLR above.
    address constant SFLR_TEST_TOKEN = 0x72667b24415D6d2eA732117077554B58c05AE119;
    address constant STFLR_TEST_TOKEN = 0x5b0F56659117d035D83Eb0296FAbD6133e786cbe;
    address constant SPRK_TEST_TOKEN = 0xd84f47474dcA53Cc03d77BeF58ee4C983F1f00ce;
    address constant FLRETH_TEST_TOKEN = 0xD02B73F8181AFD9C9A34D7a92BB1933244e9fAA4;
    address constant STXRP_TEST_TOKEN = 0x455E56B5761997Cd01eEaFf718461f77EB4E4e86;
    address constant FXRP_TEST_TOKEN = 0x23f186F13Cc30926eAd941e517c223A0d6082fc4;
    address constant USDX_TEST_TOKEN = 0x1Cb07C68dDE906f0ac047a4Ab655dE89Ecd506C5;
    address constant CUSDX_TEST_TOKEN = 0xF96f68aa6f282380dE422587Bc789f838c3d1F8b;
    address constant YUSDX_TEST_TOKEN = 0x16a6030ea92E4570ca5F700404147F96b021134f;
    address constant USDT0_TEST_TOKEN = 0x0ef71449cFe4Eb201caD3DB6b46e0b5f5Ce79177;
    address constant USDCE_TEST_TOKEN = 0xa1190CA2B6C5356b5645cf0a4d4F982ce8ec89bc;
    address constant USDT_TEST_TOKEN = 0x0187290186B88c45E6BbA1eE797d156270564A4A;
    address constant WETH_TEST_TOKEN = 0xC6DB5396CCea7792E1911Bb6A6838b77Df8ac47f;
    address constant CYWETH_TEST_TOKEN = 0xF80a9D8c33062F9Eff3eb6d6A41ca401e3620656;
    address constant CYSFLR_TEST_TOKEN = 0x01FC5022DFa3797DFDce9565DD1B71fA474fA1Ee;
    address constant DINERO_TEST_TOKEN = 0x544954D24fCF570e97D24B81D4820e2DBD54A45E;
    address constant BUGO_TEST_TOKEN = 0xBd36d5410b875e18a0a78f511a42B30b5c3B6bf1;
    address constant PICO_TEST_TOKEN = 0x970DC594ed3CcCd841E612bee050605B6Ee74F19;
    address constant JOULE_TEST_TOKEN = 0xb08CF22FfC1ca3b084761D61b25D32F53d210277;

    function run() external ScaffoldEthDeployerRunner {
        require(PRICE_ORACLE != address(0), "Fill in PRICE_ORACLE first (run DeployNyxSwapPriceOracle.s.sol)");

        NyxSwapRouter router = new NyxSwapRouter(NyxSwapPriceOracle(PRICE_ORACLE), MAX_DEVIATION_BPS);
        deployments.push(Deployment("NyxSwapRouter", address(router)));

        address[19] memory spokes = [
            SFLR_TEST_TOKEN,
            STFLR_TEST_TOKEN,
            SPRK_TEST_TOKEN,
            FLRETH_TEST_TOKEN,
            STXRP_TEST_TOKEN,
            FXRP_TEST_TOKEN,
            USDX_TEST_TOKEN,
            CUSDX_TEST_TOKEN,
            YUSDX_TEST_TOKEN,
            USDT0_TEST_TOKEN,
            USDCE_TEST_TOKEN,
            USDT_TEST_TOKEN,
            WETH_TEST_TOKEN,
            CYWETH_TEST_TOKEN,
            CYSFLR_TEST_TOKEN,
            DINERO_TEST_TOKEN,
            BUGO_TEST_TOKEN,
            PICO_TEST_TOKEN,
            JOULE_TEST_TOKEN
        ];

        for (uint256 i = 0; i < spokes.length; i++) {
            router.createPool(IERC20(WFLR_TEST_TOKEN), IERC20(spokes[i]));
        }
    }
}
