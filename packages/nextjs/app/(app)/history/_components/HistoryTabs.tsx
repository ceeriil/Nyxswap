"use client";

import { useState } from "react";
import { useSwapHistory } from "../_lib/useSwapHistory";
import { PoolActivityStats } from "./PoolActivityStats";
import { SwapHistoryEmptyState } from "./SwapHistoryEmptyState";
import { SwapHistoryTable } from "./SwapHistoryTable";
import { TabGroup } from "~~/components/TabGroup";

type Tab = "mine" | "pool";

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "mine", label: "My Swaps" },
  { value: "pool", label: "Pool Activity" },
];

export const HistoryTabs = () => {
  const [tab, setTab] = useState<Tab>("mine");
  const { mySwaps, poolActivity, highlightId, isConnected } = useSwapHistory();

  return (
    <div className="card w-full shadow-xl">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="card-title">History</h1>
          <TabGroup options={TAB_OPTIONS} value={tab} onChange={setTab} />
        </div>

        {tab === "mine" ? (
          mySwaps.length === 0 ? (
            <SwapHistoryEmptyState connected={isConnected} />
          ) : (
            <SwapHistoryTable records={mySwaps} />
          )
        ) : (
          <>
            <PoolActivityStats records={poolActivity} />
            <SwapHistoryTable records={poolActivity} showTrader highlightId={highlightId} />
          </>
        )}
      </div>
    </div>
  );
};
