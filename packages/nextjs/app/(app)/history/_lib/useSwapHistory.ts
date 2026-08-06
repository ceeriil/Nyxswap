import { useEffect, useMemo, useState } from "react";
import { type SwapRecord, buildLiveRecord, buildSeedHistory } from "./mockSwapHistory";
import { useAccount } from "wagmi";

const LIVE_INTERVAL_MS = 7_000;
const HIGHLIGHT_DURATION_MS = 2_000;
const MAX_RECORDS = 60;
const PERSONALIZED_COUNT = 2;

/**
 * Mock stand-in for a real useScaffoldEventHistory({ eventName: "SwapExecuted",
 * watch: true }) call — no AMM contract is deployed yet (see brief.md). The
 * live-append interval mirrors what that hook's `watch` mode would do: new
 * settled swaps arrive without a manual refresh.
 */
export const useSwapHistory = () => {
  const { address } = useAccount();
  const [records, setRecords] = useState<SwapRecord[]>(() => buildSeedHistory());
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Demo-only: there's no real per-wallet history yet, so tag a couple of
  // seed rows with whichever wallet is connected so "My Swaps" has
  // something to show instead of always reading empty.
  useEffect(() => {
    if (!address) return;
    setRecords(prev => prev.map((r, i) => (i < PERSONALIZED_COUNT ? { ...r, trader: address } : r)));
  }, [address]);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = buildLiveRecord();
      setRecords(prev => [next, ...prev].slice(0, MAX_RECORDS));
      setHighlightId(next.id);
      setTimeout(() => setHighlightId(current => (current === next.id ? null : current)), HIGHLIGHT_DURATION_MS);
    }, LIVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const mySwaps = useMemo(
    () => (address ? records.filter(r => r.trader.toLowerCase() === address.toLowerCase()) : []),
    [records, address],
  );

  return {
    poolActivity: records,
    mySwaps,
    highlightId,
    isConnected: Boolean(address),
  };
};
