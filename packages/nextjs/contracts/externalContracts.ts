import deployedContracts from "./deployedContracts";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

// Placeholder ERC20 test tokens for the wallet modal's UI, not deployed yet —
// address is the zero address on purpose (no bytecode there, so scaffold-eth's
// contract-existence check resolves them to "not deployed" and the UI degrades
// gracefully). Once these are actually deployed via a Foundry script, DELETE
// the matching entry here: deployedContracts.ts will define the real one, and
// leaving the stub in place would shadow it (externalContracts wins merge ties).
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const flrTestTokenAbi = deployedContracts[114].FlrTestToken.abi;

const externalContracts = {
  114: {
    UsdtTestToken: { address: ZERO_ADDRESS, abi: flrTestTokenAbi },
    BtcTestToken: { address: ZERO_ADDRESS, abi: flrTestTokenAbi },
    EthTestToken: { address: ZERO_ADDRESS, abi: flrTestTokenAbi },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
