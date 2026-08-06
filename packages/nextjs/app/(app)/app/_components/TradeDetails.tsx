"use client";

import type { ReactNode } from "react";
import { SWAP_FEE_BPS } from "../_lib/mockPool";
import type { TokenSymbol } from "../_lib/tokens";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

type Props = {
  sendToken: TokenSymbol;
  receiveToken: TokenSymbol;
  amountIn: number;
  priceImpactPct: number;
  executionPrice: number;
  ftsoReferencePrice: number;
  ftsoDeviationPct: number;
  ftsoDeviationExceeded: boolean;
  minimumReceived: number;
};

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-base-content/60">{label}</span>
    <span className="font-medium text-base-content/90">{value}</span>
  </div>
);

export const TradeDetails = ({
  sendToken,
  receiveToken,
  amountIn,
  priceImpactPct,
  executionPrice,
  ftsoReferencePrice,
  ftsoDeviationPct,
  ftsoDeviationExceeded,
  minimumReceived,
}: Props) => {
  if (!amountIn) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-base-300 bg-base-200/40 p-4">
      <Row
        label="Price impact"
        value={<span className={priceImpactPct > 3 ? "text-warning" : undefined}>{priceImpactPct.toFixed(2)}%</span>}
      />

      {/* Kept visible by default (not tucked in an expandable section) — this is
          the field that concretely justifies "why Flare" in the trading UI itself. */}
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-base-content/60">
          FTSO reference vs. execution
          {ftsoDeviationExceeded && <ExclamationTriangleIcon className="h-3 w-3 text-warning" />}
        </span>
        <span className={ftsoDeviationExceeded ? "font-medium text-warning" : "font-medium text-base-content/90"}>
          {executionPrice.toFixed(6)} / {ftsoReferencePrice.toFixed(6)} {receiveToken}
          <span className="ml-1 text-base-content/50">
            ({ftsoDeviationPct >= 0 ? "+" : ""}
            {ftsoDeviationPct.toFixed(2)}%)
          </span>
        </span>
      </div>

      <Row label="Minimum received" value={`${minimumReceived.toFixed(6)} ${receiveToken}`} />
      <Row label="Swap fee" value={`${(SWAP_FEE_BPS / 100).toFixed(2)}%`} />
      <Row label="Ratio" value={`1 ${sendToken} = ${executionPrice.toFixed(6)} ${receiveToken}`} />
    </div>
  );
};
