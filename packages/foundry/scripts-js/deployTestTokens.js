#!/usr/bin/env node
/**
 * Deploys USDT/BTC/ETH test tokens via script/DeployTestTokens.s.sol (which
 * deploys the single MintableTestToken contract three times, once per
 * symbol), then writes ../nextjs/contracts/deployedContracts.ts with one
 * named entry per deployment, all sharing MintableTestToken's ABI.
 *
 * One generic contract, deployed N times with different constructor args —
 * mirrors fce-orderbook's tools/cmd/test-setup pattern (a single TestToken.sol
 * deployed once per symbol via a Go loop). This is the same idea via a
 * Foundry script since this repo's tooling is Node/Foundry, not Go.
 *
 * `forge create` was tried first (simpler, one call per token) but throws
 * "Device not configured (os error 6)" in this sandbox — some TTY probe it
 * does that `forge script` doesn't. Hence `forge script` + parsing the
 * broadcast log instead.
 *
 * generateTsAbis.js can't be reused for this: it dedupes deployments by
 * `${chainId}-${contractName}`, so multiple instances of the same Solidity
 * contract class collapse to just the last one. Hence this separate script,
 * which keys entries by the caller-supplied token key instead — matched to
 * the broadcast's CREATE transactions *by order*, since every deployment
 * shares the literal contract name "MintableTestToken" and can't be told
 * apart by name. TOKENS_TO_DEPLOY's order must match
 * DeployTestTokens.s.sol's deployment order exactly.
 *
 * FLR was deployed separately (as its own FlrTestToken contract, before this
 * script existed) and isn't touched here — its address is carried forward
 * from the existing deployedContracts.ts so this script stays safe to re-run.
 *
 * IMPORTANT: generateTsAbis.js (run by `yarn deploy`, e.g. for
 * DeployFlrPriceReader.s.sol) fully REGENERATES deployedContracts.ts from its
 * own broadcast scan and has no idea about the entries this script writes —
 * running it clobbers FlrTestToken/UsdtTestToken/BtcTestToken/EthTestToken
 * (and collapses MintableTestToken's 3 deployments into one, under the
 * literal class name). Re-run this script afterward to restore them.
 *
 * Usage:
 *   node scripts-js/deployTestTokens.js --network coston2 --keystore coston2-deployer [--password-file <path>]
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { format } from "prettier";

const __dirname = dirname(fileURLToPath(import.meta.url));
const foundryRoot = join(__dirname, "..");
const deployedContractsPath = join(foundryRoot, "../nextjs/contracts/deployedContracts.ts");

const CHAIN_IDS = { coston2: 114 };

// Order must match script/DeployTestTokens.s.sol's deployment order.
const TOKENS_TO_DEPLOY = [
  { key: "UsdtTestToken", name: "Tether USD (Test)", symbol: "USDT", decimals: 6 },
  { key: "BtcTestToken", name: "Bitcoin (Test)", symbol: "BTC", decimals: 8 },
  { key: "EthTestToken", name: "Ether (Test)", symbol: "ETH", decimals: 18 },
];

function getArg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function readExistingEntries(chainId) {
  if (!existsSync(deployedContractsPath)) return {};
  const source = readFileSync(deployedContractsPath, "utf-8");
  // deployedContracts.ts is generated code, not hand-authored — safe to eval
  // as a module body here rather than hand-parsing its object literal.
  const objectLiteral = source
    .replace(/^[\s\S]*const deployedContracts = /, "")
    .replace(/\s*as const;[\s\S]*$/, "");
  // eslint-disable-next-line no-eval
  const parsed = (0, eval)(`(${objectLiteral})`);
  const chainEntries = parsed[chainId] ?? {};
  // TestToken is a dead orphan from an earlier mis-named deploy — drop it.
  delete chainEntries.TestToken;
  return chainEntries;
}

async function main() {
  const network = getArg("network", "coston2");
  const keystore = getArg("keystore");
  const passwordFile = getArg("password-file");
  if (!keystore) {
    console.error("Usage: node deployTestTokens.js --network <net> --keystore <name> [--password-file <path>]");
    process.exit(1);
  }
  const chainId = CHAIN_IDS[network];
  if (!chainId) {
    console.error(`Unknown network "${network}" — add it to CHAIN_IDS in this script`);
    process.exit(1);
  }

  const artifactPath = join(foundryRoot, "out/MintableTestToken.sol/MintableTestToken.json");
  if (!existsSync(artifactPath)) {
    console.error(`Missing build artifact at ${artifactPath} — run \`forge build\` first`);
    process.exit(1);
  }
  const abi = JSON.parse(readFileSync(artifactPath, "utf-8")).abi;

  console.log(`Deploying ${TOKENS_TO_DEPLOY.map(t => t.symbol).join(", ")} via DeployTestTokens.s.sol...`);
  const forgeArgs = [
    "script",
    "script/DeployTestTokens.s.sol",
    "--rpc-url",
    network,
    "--account",
    keystore,
    "--broadcast",
    "--ffi",
  ];
  if (passwordFile) forgeArgs.push("--password-file", passwordFile);

  const result = spawnSync("forge", forgeArgs, { cwd: foundryRoot, encoding: "utf-8", stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(1);
  }

  const broadcastPath = join(foundryRoot, `broadcast/DeployTestTokens.s.sol/${chainId}/run-latest.json`);
  const broadcast = JSON.parse(readFileSync(broadcastPath, "utf-8"));
  const createTxs = broadcast.transactions.filter(tx => tx.transactionType === "CREATE");
  if (createTxs.length !== TOKENS_TO_DEPLOY.length) {
    console.error(
      `Expected ${TOKENS_TO_DEPLOY.length} CREATE txs in ${broadcastPath}, found ${createTxs.length}. ` +
        `Did DeployTestTokens.s.sol change without updating TOKENS_TO_DEPLOY here?`,
    );
    process.exit(1);
  }
  const blockByAddress = Object.fromEntries(
    broadcast.receipts.map(r => [r.contractAddress, parseInt(r.blockNumber, 16)]),
  );

  const entries = readExistingEntries(chainId);
  TOKENS_TO_DEPLOY.forEach((token, i) => {
    const address = createTxs[i].contractAddress;
    entries[token.key] = { address, abi, deployedOnBlock: blockByAddress[address] };
    console.log(`  ${token.key} -> ${address}`);
  });

  const fileContent = `
    /**
     * This file is autogenerated by scripts-js/deployTestTokens.js.
     * You should not edit it manually or your changes might be overwritten.
     */
    import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

    const deployedContracts = {${chainId}: ${JSON.stringify(entries)}} as const;

    export default deployedContracts satisfies GenericContractsDeclaration;
  `;

  writeFileSync(deployedContractsPath, await format(fileContent, { parser: "typescript", printWidth: 120 }));
  console.log(`\nWrote ${deployedContractsPath}`);
}

main();
