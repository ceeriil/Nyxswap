"use client";

import { TokenIcon } from "../../app/_components/TokenIcon";
import { TOKENS } from "../../app/_lib/tokens";
import type { SwapRecord } from "../_lib/mockSwapHistory";
import { TxHashLink } from "./TxHashLink";
import { Address } from "@scaffold-ui/components";
import { createColumnHelper } from "@tanstack/react-table";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

const columnHelper = createColumnHelper<SwapRecord>();

const PairCell = ({ tokenIn, tokenOut }: Pick<SwapRecord, "tokenIn" | "tokenOut">) => (
  <span className="flex items-center gap-1 whitespace-nowrap">
    <TokenIcon symbol={tokenIn} colorClassName={TOKENS[tokenIn].avatarClassName} size="sm" />
    {tokenIn}
    <span className="text-base-content/40">→</span>
    <TokenIcon symbol={tokenOut} colorClassName={TOKENS[tokenOut].avatarClassName} size="sm" />
    {tokenOut}
  </span>
);

const TraderCell = ({ address }: { address: SwapRecord["trader"] }) => {
  const { targetNetwork } = useTargetNetwork();
  return <Address address={address} size="sm" onlyEnsOrAddress chain={targetNetwork} />;
};

export const timeColumn = columnHelper.accessor("timestamp", {
  id: "time",
  header: "Time",
  size: 190,
  cell: info => (
    <span className="whitespace-nowrap text-base-content/60">{new Date(info.getValue()).toLocaleString()}</span>
  ),
});

export const pairColumn = columnHelper.accessor(r => `${r.tokenIn}/${r.tokenOut}`, {
  id: "pair",
  header: "Pair",
  size: 150,
  cell: info => <PairCell tokenIn={info.row.original.tokenIn} tokenOut={info.row.original.tokenOut} />,
});

export const amountColumn = columnHelper.accessor("amountIn", {
  id: "amount",
  header: "Amount in → out",
  size: 220,
  cell: info => {
    const r = info.row.original;
    return (
      <span className="whitespace-nowrap tabular-nums">
        {r.amountIn.toFixed(4)} → {r.amountOut.toFixed(4)}
      </span>
    );
  },
});

export const priceColumn = columnHelper.accessor(r => r.amountOut / r.amountIn, {
  id: "price",
  header: "Execution price",
  size: 220,
  cell: info => {
    const r = info.row.original;
    return (
      <span className="whitespace-nowrap tabular-nums text-base-content/70">
        1 {r.tokenIn} = {info.getValue().toFixed(6)} {r.tokenOut}
      </span>
    );
  },
});

export const traderColumn = columnHelper.accessor("trader", {
  id: "trader",
  header: "Trader",
  size: 170,
  enableSorting: false,
  cell: info => <TraderCell address={info.getValue()} />,
});

export const txColumn = columnHelper.display({
  id: "tx",
  header: "Tx",
  size: 160,
  cell: info => <TxHashLink hash={info.row.original.txHash} />,
});
