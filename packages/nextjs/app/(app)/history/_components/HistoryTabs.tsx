"use client";

import { useState } from "react";

type HistoryTab = "orders" | "batches";

export const HistoryTabs = () => {
  const [activeTab, setActiveTab] = useState<HistoryTab>("orders");

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-2xl">
      <div className="card-body">
        <div role="tablist" className="tabs tabs-boxed w-fit">
          <button
            role="tab"
            className={`tab ${activeTab === "orders" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            My Orders
          </button>
          <button
            role="tab"
            className={`tab ${activeTab === "batches" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("batches")}
          >
            Settled Batches
          </button>
        </div>

        {activeTab === "orders" ? (
          <p className="text-sm text-base-content/70 mt-4">
            Orders placed by your connected wallet, hidden while pending and revealed once settled.
          </p>
        ) : (
          <p className="text-sm text-base-content/70 mt-4">
            Publicly visible matches from past settled batches, viewable by anyone.
          </p>
        )}
      </div>
    </div>
  );
};
