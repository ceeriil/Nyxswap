"use client";

import { useState } from "react";
import { useSwapHistory } from "../_lib/useSwapHistory";
import { PoolActivityStats } from "./PoolActivityStats";
import { SwapHistoryEmptyState } from "./SwapHistoryEmptyState";
import { SwapHistoryTable } from "./SwapHistoryTable";

type Tab = "mine" | "pool";

export const HistoryTabs = () => {
  const [tab, setTab] = useState<Tab>("mine");
  const { mySwaps, poolActivity, highlightId, isConnected } = useSwapHistory();

  return (
    <div className="card shadow-xl w-full max-w-4xl">
      <div className="card-body gap-4">
        <h1 className="card-title">History</h1>

        <div role="tablist" className="tabs tabs-box w-fit">
          <button
            type="button"
            role="tab"
            className={`tab ${tab === "mine" ? "tab-active" : ""}`}
            onClick={() => setTab("mine")}
          >
            My Swaps
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${tab === "pool" ? "tab-active" : ""}`}
            onClick={() => setTab("pool")}
          >
            Pool Activity
          </button>
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
