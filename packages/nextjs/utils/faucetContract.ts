import { useMemo } from "react";
import { contracts } from "~~/utils/scaffold-eth/contract";

const CHAIN_ID = 114;

export const FAUCET_ABI = [
  {
    type: "function",
    name: "claimMany",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokens", type: "address[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimableAt",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "tokens", type: "address[]" },
    ],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Skipped",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "availableAt", type: "uint256", indexed: false },
    ],
  },
] as const;

export interface FaucetContract {
  address: `0x${string}`;
  abi: typeof FAUCET_ABI;
}

// Faucet's ABI is hardcoded here (not read off ~~/contracts/deployedContracts)
// so every caller compiles before DeployTestTokens.s.sol has ever run against
// this chain - only the address is optional, degrading to null ("Faucet not
// deployed") until a deploy registers it.
export function useFaucetContract(): FaucetContract | null {
  const address = contracts?.[CHAIN_ID]?.Faucet?.address;
  return useMemo(
    () => (address ? { address: address as `0x${string}`, abi: FAUCET_ABI } : null),
    [address],
  );
}
