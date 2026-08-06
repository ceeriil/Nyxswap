"use client";

import type { ReactNode } from "react";
import type { TokenSymbol } from "../../app/_lib/tokens";

type Props = {
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  bPerA: number;
  amountA: number;
};

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-base-content/60">{label}</span>
    <span className="font-medium text-base-content/90">{value}</span>
  </div>
);

export const DepositDetails = ({ tokenA, tokenB, bPerA, amountA }: Props) => {
  if (!amountA) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-base-300 bg-base-200/40 p-4">
      <Row label="Pool ratio" value={`1 ${tokenA} = ${bPerA.toFixed(6)} ${tokenB}`} />
      {/* LP representation (internal ledger % vs. minted LP token) is still
          unresolved (see brief.md) — a real number here would be a guess. */}
      <Row label="Pool share" value={<span className="text-base-content/50">Pending LP design decision</span>} />
      <Row label="Protocol fee" value={<span className="text-base-content/50">Not yet decided</span>} />
      <Row label="Network fee" value="Paid at broadcast" />
    </div>
  );
};
