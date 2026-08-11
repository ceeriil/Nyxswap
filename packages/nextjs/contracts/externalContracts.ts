import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * @example
 * const externalContracts = {
 *   1: {
 *     DAI: {
 *       address: "0x...",
 *       abi: [...],
 *     },
 *   },
 * } as const;
 */
const externalContracts = {
  114: {
    // Flare TEE Diamond proxy (packages/tee-extension/config/coston2/deployed-addresses.json).
    // Only the MachineManager facet's read used for the TEE status indicator is included here —
    // NyxSwapInstructionSender already talks to this same address for the write paths.
    FlareTeeManager: {
      address: "0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE",
      abi: [
        {
          type: "function",
          name: "getRandomTeeIds",
          stateMutability: "view",
          inputs: [
            { name: "_extensionId", type: "uint256" },
            { name: "_count", type: "uint256" },
          ],
          outputs: [{ name: "", type: "address[]" }],
        },
      ],
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
