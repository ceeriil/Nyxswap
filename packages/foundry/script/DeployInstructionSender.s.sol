//SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./DeployHelpers.s.sol";
import { NyxSwapInstructionSender } from "../contracts/tee/InstructionSender.sol";
import { ITeeExtensionRegistry } from "../contracts/tee/interfaces/ITeeExtensionRegistry.sol";
import { ITeeMachineRegistry } from "../contracts/tee/interfaces/ITeeMachineRegistry.sol";
import { INyxSwapVault } from "../contracts/interfaces/INyxSwapVault.sol";
import { INyxSwapAllowList } from "../contracts/access/interfaces/INyxSwapAllowList.sol";

/**
 * @notice Redeploys NyxSwapInstructionSender only, pointing at the already-deployed
 * Vault/AllowList (unchanged, no need to redeploy those or re-wire allowed tokens /
 * allow-list entries). Needed after adding the extensionId() getter to
 * InstructionSender.sol, which changes its bytecode/address.
 * @dev Run with: yarn deploy --file DeployInstructionSender.s.sol --network coston2
 */
contract DeployInstructionSender is ScaffoldETHDeploy {
    address constant FLARE_TEE_MANAGER = 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE;
    address constant VAULT = 0x55D0B6F108c80e21300a730ea90b25891ef1E735;
    address constant ALLOW_LIST = 0x42a3926C196cc5a8FcE86209727c92ee71772f8D;

    function run() external ScaffoldEthDeployerRunner {
        NyxSwapInstructionSender instructionSender = new NyxSwapInstructionSender(
            ITeeExtensionRegistry(FLARE_TEE_MANAGER),
            ITeeMachineRegistry(FLARE_TEE_MANAGER),
            INyxSwapVault(VAULT),
            INyxSwapAllowList(ALLOW_LIST)
        );
        deployments.push(Deployment("NyxSwapInstructionSender", address(instructionSender)));
    }
}
