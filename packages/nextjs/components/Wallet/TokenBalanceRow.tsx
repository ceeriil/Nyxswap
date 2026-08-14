"use client";

import { useEffect } from "react";
import { TokenIcon } from "~~/components/assets/TokenIcon";
import type { DeployedTestToken } from "~~/hooks/wallet/useDeployedTestTokens";
import { useTokenBalance } from "~~/hooks/wallet/useTokenBalance";
import { fmtUsdFull } from "~~/shared/format";

interface TokenBalanceRowProps {
  token: DeployedTestToken;
  onBalance?: (address: string, balance: number | null) => void;
  compact?: boolean;
  render?: boolean;
  /** Omit to hide the USD line entirely; null renders "-" (price not resolved). */
  usdPrice?: number | null;
}

export function TokenBalanceRow({ token, onBalance, compact = false, render = true, usdPrice }: TokenBalanceRowProps) {
  const { balance, isLoading } = useTokenBalance(token.address);

  useEffect(() => {
    if (!isLoading) onBalance?.(token.address, balance);
  }, [balance, isLoading, token.address, onBalance]);

  if (!render) return null;

  return (
    <li
      className={`group flex items-center justify-between gap-3 rounded-xl ring-1 ring-transparent transition-all duration-200 hover:bg-base-200 hover:ring-primary/25 ${
        compact ? "px-2 py-1.5" : "px-3 py-2.5"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="transition-transform duration-200 group-hover:scale-110">
          <TokenIcon symbol={token.symbol} logoURI={token.logoURI} size={compact ? "sm" : "md"} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm transition-colors group-hover:text-primary">{token.symbol.toUpperCase()}</p>
          {!compact && <p className="truncate text-xs text-base-content/50">{token.name}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-xs tabular-nums">
          {isLoading ? "…" : (balance ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </span>
        {usdPrice !== undefined && !isLoading && (
          <span className="text-xs tabular-nums text-base-content/50">
            {usdPrice == null ? "-" : fmtUsdFull((balance ?? 0) * usdPrice)}
          </span>
        )}
      </div>
    </li>
  );
}
