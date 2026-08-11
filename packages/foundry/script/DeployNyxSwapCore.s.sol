//SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./DeployHelpers.s.sol";
import { NyxSwapVault } from "../contracts/NyxSwapVault.sol";
import { NyxSwapAllowListAuthentication } from "../contracts/access/NyxSwapAllowListAuthentication.sol";
import { NyxSwapInstructionSender } from "../contracts/tee/InstructionSender.sol";
import { ITeeExtensionRegistry } from "../contracts/tee/interfaces/ITeeExtensionRegistry.sol";
import { ITeeMachineRegistry } from "../contracts/tee/interfaces/ITeeMachineRegistry.sol";
import { INyxSwapVault } from "../contracts/interfaces/INyxSwapVault.sol";
import { INyxSwapAllowList } from "../contracts/access/interfaces/INyxSwapAllowList.sol";

/**
 * @notice Deploys NyxSwap's on-chain core (Vault, AllowList, InstructionSender) and
 * wires them together, on Coston2.
 * @dev Both TEE registry constructor args point at the same address — FlareTeeManager,
 * the Diamond proxy that routes ExtensionManager/MachineManager calls to the right
 * facet (see packages/tee-extension/tools/pkg/utils/instructions.go). Frontend-only
 * milestone: setExtensionId() is NOT called here, so deposit()/requestWithdraw() will
 * revert ("Extension ID is not set.") until the TEE registration pipeline
 * (pre-build.sh -> post-build.sh -> extension-post-setup.sh) is actually run.
 * @dev Run with: yarn deploy --file DeployNyxSwapCore.s.sol --network coston2
 */
contract DeployNyxSwapCore is ScaffoldETHDeploy {
    // FlareTeeManager Diamond proxy on Coston2 (packages/tee-extension/config/coston2/deployed-addresses.json)
    address constant FLARE_TEE_MANAGER = 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE;

    // Already-deployed test tokens (packages/nextjs/contracts/deployedContracts.ts)
    address constant FLR_TEST_TOKEN = 0x591B11abe90E8D832F04aa9E84fcEe6D3c394699;
    address constant USDT_TEST_TOKEN = 0xC5b806B354DBe263b2D567Ea162D3802F25E764e;
    address constant BTC_TEST_TOKEN = 0x8aefDDdC40CF83fC82A7dEB4bd3F1894e76c43cd;
    address constant ETH_TEST_TOKEN = 0x08cE174E493f9E62c82BbCB707991658c8f2AA39;

    function run() external ScaffoldEthDeployerRunner {
        NyxSwapVault vault = new NyxSwapVault(deployer);
        deployments.push(Deployment("NyxSwapVault", address(vault)));

        NyxSwapAllowListAuthentication allowList = new NyxSwapAllowListAuthentication(deployer);
        deployments.push(Deployment("NyxSwapAllowList", address(allowList)));

        NyxSwapInstructionSender instructionSender = new NyxSwapInstructionSender(
            ITeeExtensionRegistry(FLARE_TEE_MANAGER),
            ITeeMachineRegistry(FLARE_TEE_MANAGER),
            INyxSwapVault(address(vault)),
            INyxSwapAllowList(address(allowList))
        );
        deployments.push(Deployment("NyxSwapInstructionSender", address(instructionSender)));

        vault.setAllowedToken(FLR_TEST_TOKEN, true);
        vault.setAllowedToken(USDT_TEST_TOKEN, true);
        vault.setAllowedToken(BTC_TEST_TOKEN, true);
        vault.setAllowedToken(ETH_TEST_TOKEN, true);

        allowList.addToAllowlist(deployer);
    }
}
