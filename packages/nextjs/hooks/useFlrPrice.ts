import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

/**
 * Live FLR/USD price, read from Flare's own FTSOv2 oracle via FlrPriceReader
 * (packages/foundry/contracts/FlrPriceReader.sol) instead of a Uniswap pair —
 * FLR has no meaningful mainnet Uniswap liquidity for the default SE-2 price hook to use.
 */
export function useFlrPrice() {
  const { data, isLoading, isError } = useScaffoldReadContract({
    contractName: "FlrPriceReader",
    functionName: "getFlrUsdPrice",
  });

  const [value, decimals] = data ?? [];
  const price = value !== undefined && decimals !== undefined ? Number(value) / 10 ** decimals : 0;

  return { price, isLoading, isError };
}
