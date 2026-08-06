"use client";

import { useState } from "react";
import { DepositForm } from "./DepositForm";
import { WithdrawForm } from "./WithdrawForm";

type Tab = "deposit" | "withdraw";

export const VaultCard = () => {
  const [tab, setTab] = useState<Tab>("deposit");

  return (
    <div className="card shadow-xl w-full max-w-xl">
      <div className="card-body gap-4">
        <h1 className="card-title">Vault</h1>

        <div role="tablist" className="tabs tabs-box w-fit">
          <button
            type="button"
            role="tab"
            className={`tab ${tab === "deposit" ? "tab-active" : ""}`}
            onClick={() => setTab("deposit")}
          >
            Deposit
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${tab === "withdraw" ? "tab-active" : ""}`}
            onClick={() => setTab("withdraw")}
          >
            Withdraw
          </button>
        </div>

        {tab === "deposit" ? <DepositForm /> : <WithdrawForm />}
      </div>
    </div>
  );
};
