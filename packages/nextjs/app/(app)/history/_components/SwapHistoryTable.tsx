"use client";

import { TokenIcon } from "../../app/_components/TokenIcon";
import { TOKENS } from "../../app/_lib/tokens";
import type { SwapRecord } from "../_lib/mockSwapHistory";
import { TxHashLink } from "./TxHashLink";
import { Address } from "@scaffold-ui/components";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

type Props = {
  records: SwapRecord[];
  showTrader?: boolean;
  highlightId?: string | null;
};

// No persistent Status column: every row here is a settled swap (the mock
// feed has no pending/failed state to show), so a column that would always
// read "Settled" carries no information — see history spec.
export const SwapHistoryTable = ({ records, showTrader, highlightId }: Props) => {
  const { targetNetwork } = useTargetNetwork();

  return (
    <div className="overflow-x-auto rounded-2xl border border-base-300">
      <table className="table table-sm">
        <thead>
          <tr className="text-xs text-base-content/60">
            <th>Time</th>
            <th>Pair</th>
            <th>Amount in → out</th>
            <th>Execution price</th>
            {showTrader && <th>Trader</th>}
            <th>Tx</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr
              key={r.id}
              className={`text-sm transition-colors duration-1000 ${r.id === highlightId ? "bg-primary/10" : ""}`}
            >
              <td className="whitespace-nowrap text-base-content/60">{new Date(r.timestamp).toLocaleString()}</td>
              <td>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <TokenIcon symbol={r.tokenIn} colorClassName={TOKENS[r.tokenIn].avatarClassName} size="sm" />
                  {r.tokenIn}
                  <span className="text-base-content/40">→</span>
                  <TokenIcon symbol={r.tokenOut} colorClassName={TOKENS[r.tokenOut].avatarClassName} size="sm" />
                  {r.tokenOut}
                </span>
              </td>
              <td className="whitespace-nowrap tabular-nums">
                {r.amountIn.toFixed(4)} → {r.amountOut.toFixed(4)}
              </td>
              <td className="whitespace-nowrap tabular-nums text-base-content/70">
                1 {r.tokenIn} = {(r.amountOut / r.amountIn).toFixed(6)} {r.tokenOut}
              </td>
              {showTrader && (
                <td>
                  <Address address={r.trader} size="sm" onlyEnsOrAddress chain={targetNetwork} />
                </td>
              )}
              <td>
                <TxHashLink hash={r.txHash} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
