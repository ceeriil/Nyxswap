"use client";


import { useEffect } from "react";
import { TokenIcon } from "~~/components/assets/TokenIcon";
import { useTokenBalance } from "~~/hooks/wallet/useTokenBalance";
import { fmtUsdFull } from "~~/shared/format";
import type { TestToken } from "~~/utils/testTokens";

interface TokenBalanceRowProps {
  token: TestToken;
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
    <li className={`flex items-center justify-between gap-3 ${compact ? "py-1.5" : "px-3 py-2"}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <TokenIcon symbol={token.symbol} logoURI={token.logoURI} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm text-body">{token.symbol.toUpperCase()}</p>
          {!compact && <p className="truncate font-mono text-xs text-muted/50">{token.name}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="font-mono text-xs tabular-nums text-body">
          {isLoading ? "…" : (balance ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </span>
        {usdPrice !== undefined && !isLoading && (
          <span className="font-mono text-xs tabular-nums text-muted/50">
            {usdPrice == null ? "-" : fmtUsdFull((balance ?? 0) * usdPrice)}
          </span>
        )}
      </div>
    </li>
  );
}
