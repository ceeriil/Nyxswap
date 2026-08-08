"use client";

import { useState } from "react";
import { DepositForm } from "./DepositForm";
import { WithdrawForm } from "./WithdrawForm";
import { TabGroup } from "~~/components/TabGroup";

type Tab = "deposit" | "withdraw";

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "deposit", label: "Deposit" },
  { value: "withdraw", label: "Withdraw" },
];

export const VaultCard = () => {
  const [tab, setTab] = useState<Tab>("deposit");

  return (
    <div className="card shadow-xl w-full max-w-xl">
      <div className="card-body gap-4">
        <h1 className="card-title">Vault</h1>

        <TabGroup options={TAB_OPTIONS} value={tab} onChange={setTab} />

        {tab === "deposit" ? <DepositForm /> : <WithdrawForm />}
      </div>
    </div>
  );
};
