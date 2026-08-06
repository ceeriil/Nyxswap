"use client";

import { useState } from "react";
import { DepositForm } from "./DepositForm";
import { WithdrawForm } from "./WithdrawForm";
import { Button } from "~~/components/landing/Button";

type Tab = "deposit" | "withdraw";

const TAB_CLASSES = "rounded-full px-4 py-1 h-8 text-sm";
const INACTIVE_CLASSES = "border-transparent bg-transparent hover:bg-landing-button-bg";

export const VaultCard = () => {
  const [tab, setTab] = useState<Tab>("deposit");

  return (
    <div className="card shadow-xl w-full max-w-xl">
      <div className="card-body gap-4">
        <h1 className="card-title">Vault</h1>

        <div className="inline-flex w-fit items-center gap-1 rounded-full border border-base-300 bg-base-200/60 p-1">
          <Button
            as="button"
            onClick={() => setTab("deposit")}
            silver={tab === "deposit"}
            className={`${TAB_CLASSES} ${tab === "deposit" ? "" : INACTIVE_CLASSES}`}
          >
            Deposit
          </Button>
          <Button
            as="button"
            onClick={() => setTab("withdraw")}
            silver={tab === "withdraw"}
            className={`${TAB_CLASSES} ${tab === "withdraw" ? "" : INACTIVE_CLASSES}`}
          >
            Withdraw
          </Button>
        </div>

        {tab === "deposit" ? <DepositForm /> : <WithdrawForm />}
      </div>
    </div>
  );
};
