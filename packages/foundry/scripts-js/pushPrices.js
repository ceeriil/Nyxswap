#!/usr/bin/env node
/**
 * Pushes CoinGecko-sourced USD prices on-chain for NyxSwap's SeedTokenFactory tokens
 * that mock a real project but have no Flare FTSO feed of their own — see
 * NyxSwapPriceOracle.sol's header. FTSO already covers WFLR/FXRP/WETH/USDT/USDC.e
 * (wired up by DeployNyxSwapPriceOracle.s.sol); this script covers the 13 remaining
 * tokens that at least have a genuine CoinGecko listing for the real project they mock.
 * cUSDX and yUSDX have no real-world price reference anywhere (verified against
 * CoinGecko's full coin list) and are permanently excluded — pushing a price for them
 * would just be inventing data, not sourcing it.
 *
 * Run this PERIODICALLY (cron, systemd timer, etc.) — it's a one-shot push per run, not
 * a daemon. Pushed prices go stale after NyxSwapPriceOracle's maxManualPriceAge (1 hour,
 * as deployed by DeployNyxSwapPriceOracle.s.sol) and NyxSwapPool's deviation check fails
 * open for a token once its price is stale, same as if it had none configured at all —
 * so a missed run degrades gracefully instead of trusting frozen data.
 *
 * Signs via `cast send --account <keystore>`, not a raw private key in Node — same
 * reason every other deploy script in this repo shells out to forge/cast for signing
 * instead of loading a decrypted key into JS.
 *
 * Usage:
 *   node scripts-js/pushPrices.js --oracle <address> --network coston2 --keystore deployer [--password-file <path>]
 */
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const foundryRoot = join(__dirname, "..");

// key = deployed SeedTokenFactory clone address on Coston2 (see deployments/114.json),
// value = CoinGecko id for the real project it mocks. Confirmed against CoinGecko's
// /coins/list — cUSDX/yUSDX came back with no listing and are intentionally absent here.
const TOKENS = {
  "0x72667b24415D6d2eA732117077554B58c05AE119": {
    symbol: "sFLR",
    coingeckoId: "sceptre-staked-flr",
  },
  "0x5b0F56659117d035D83Eb0296FAbD6133e786cbe": {
    symbol: "stFLR",
    coingeckoId: "sparkdex-staked-flr",
  },
  "0xd84f47474dcA53Cc03d77BeF58ee4C983F1f00ce": {
    symbol: "SPRK",
    coingeckoId: "sparkdex",
  },
  "0xD02B73F8181AFD9C9A34D7a92BB1933244e9fAA4": {
    symbol: "flrETH",
    coingeckoId: "flare-staked-ether",
  },
  "0x455E56B5761997Cd01eEaFf718461f77EB4E4e86": {
    symbol: "stXRP",
    coingeckoId: "firelight-staked-xrp",
  },
  "0x1Cb07C68dDE906f0ac047a4Ab655dE89Ecd506C5": {
    symbol: "USDX",
    coingeckoId: "hex-trust-usdx",
  },
  "0x0ef71449cFe4Eb201caD3DB6b46e0b5f5Ce79177": {
    symbol: "USDT0",
    coingeckoId: "usdt0",
  },
  "0xF80a9D8c33062F9Eff3eb6d6A41ca401e3620656": {
    symbol: "cyWETH",
    coingeckoId: "cyclo-cyweth",
  },
  "0x01FC5022DFa3797DFDce9565DD1B71fA474fA1Ee": {
    symbol: "cysFLR",
    coingeckoId: "cyclo-cysflr",
  },
  "0x544954D24fCF570e97D24B81D4820e2DBD54A45E": {
    symbol: "DINERO",
    coingeckoId: "dinero-2",
  },
  "0xBd36d5410b875e18a0a78f511a42B30b5c3B6bf1": {
    symbol: "BUGO",
    coingeckoId: "bugo",
  },
  "0x970DC594ed3CcCd841E612bee050605B6Ee74F19": {
    symbol: "PiCO",
    coingeckoId: "pico",
  },
  "0xb08CF22FfC1ca3b084761D61b25D32F53d210277": {
    symbol: "JOULE",
    coingeckoId: "joule-2",
  },
};

// Matches FTSOv2's typical precision — setManualPrice takes decimals explicitly per
// call, so this is just this script's own choice of scale, not a protocol constant.
const PRICE_DECIMALS = 8;

function getArg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

async function fetchPrices() {
  const ids = Object.values(TOKENS)
    .map((t) => t.coingeckoId)
    .join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
  );
  if (!res.ok) {
    throw new Error(
      `CoinGecko request failed: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

// Scales a decimal USD price (e.g. 0.0234) to an integer at PRICE_DECIMALS, the same
// fixed-point convention FTSOv2 feeds use (value / 10^decimals == the real price).
function scalePrice(price) {
  return BigInt(Math.round(price * 10 ** PRICE_DECIMALS));
}

function main() {
  const oracle = getArg("oracle");
  const network = getArg("network", "coston2");
  const keystore = getArg("keystore");
  const passwordFile = getArg("password-file");

  if (!oracle || !keystore) {
    console.error(
      "Usage: node pushPrices.js --oracle <address> --network <net> --keystore <name> [--password-file <path>]"
    );
    process.exit(1);
  }

  fetchPrices()
    .then((prices) => {
      let pushed = 0;
      let skipped = 0;

      for (const [tokenAddress, { symbol, coingeckoId }] of Object.entries(
        TOKENS
      )) {
        const usdPrice = prices[coingeckoId]?.usd;
        if (usdPrice === undefined) {
          console.error(
            `  ${symbol}: no CoinGecko price returned for "${coingeckoId}", skipping`
          );
          skipped++;
          continue;
        }

        const scaled = scalePrice(usdPrice);
        if (scaled <= 0n) {
          console.error(
            `  ${symbol}: price $${usdPrice} scaled to zero at ${PRICE_DECIMALS} decimals, skipping`
          );
          skipped++;
          continue;
        }

        const castArgs = [
          "send",
          oracle,
          "setManualPrice(address,uint256,int8)",
          tokenAddress,
          scaled.toString(),
          String(PRICE_DECIMALS),
          "--rpc-url",
          network,
          "--account",
          keystore,
        ];
        if (passwordFile) castArgs.push("--password-file", passwordFile);

        console.log(
          `  ${symbol}: pushing $${usdPrice} (${scaled} @ ${PRICE_DECIMALS} decimals)...`
        );
        const result = spawnSync("cast", castArgs, {
          cwd: foundryRoot,
          encoding: "utf-8",
          stdio: "inherit",
        });
        if (result.status !== 0) {
          console.error(
            `  ${symbol}: cast send failed, continuing with the rest`
          );
          skipped++;
          continue;
        }
        pushed++;
      }

      console.log(`\nDone: ${pushed} pushed, ${skipped} skipped.`);
      if (pushed === 0) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

main();
