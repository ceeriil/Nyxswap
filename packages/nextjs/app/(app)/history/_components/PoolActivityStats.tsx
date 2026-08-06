"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUsd } from "../../app/_lib/format";
import { getUsdPrice } from "../../app/_lib/mockPool";
import type { SwapRecord } from "../_lib/mockSwapHistory";

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 60_000;

// Real aggregates over the (mock) settled feed — unlike the landing page's
// stats bar caveat, this is legitimately derivable once actual swap events
// exist, not a number being invented for effect.
export const PoolActivityStats = ({ records }: { records: SwapRecord[] }) => {
  // Date.now() is impure and must not run during render — capture "now" in
  // an effect instead, refreshed periodically so the 24h window stays current.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const { count, volumeUsd } = useMemo(() => {
    if (now === null) return { count: 0, volumeUsd: 0 };
    const cutoff = now - DAY_MS;
    const last24h = records.filter(r => r.timestamp >= cutoff);
    return {
      count: last24h.length,
      volumeUsd: last24h.reduce((sum, r) => sum + r.amountIn * getUsdPrice(r.tokenIn), 0),
    };
  }, [records, now]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
        <span className="text-xs text-base-content/60">24h volume</span>
        <div className="text-xl font-medium tabular-nums">{formatUsd(volumeUsd)}</div>
      </div>
      <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
        <span className="text-xs text-base-content/60">24h swaps</span>
        <div className="text-xl font-medium tabular-nums">{count}</div>
      </div>
    </div>
  );
};
