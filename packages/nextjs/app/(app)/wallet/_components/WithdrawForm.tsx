"use client";

import { useWithdrawForm } from "../_lib/useWithdrawForm";
import { BundlerToggle } from "./BundlerToggle";
import { WithdrawSubmitButton } from "./WithdrawSubmitButton";
import { WithdrawTokenRow } from "./WithdrawTokenRow";
import { AddressInput } from "@scaffold-ui/components";

export const WithdrawForm = () => {
  const form = useWithdrawForm();
  const isLocked = form.phase !== "select-amount" && form.phase !== "needs-destination" && form.phase !== "ready";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <WithdrawTokenRow
          label="Token A"
          token={form.tokenA}
          onTokenChange={form.selectTokenA}
          amount={form.amountA}
          onAmountChange={form.setAmountA}
          available={form.position.amountA}
          readOnly={isLocked}
        />
        <WithdrawTokenRow
          label="Token B"
          token={form.tokenB}
          onTokenChange={form.selectTokenB}
          amount={form.amountB}
          onAmountChange={form.setAmountB}
          available={form.position.amountB}
          readOnly={isLocked}
        />
      </div>

      <div className="rounded-2xl border border-base-300 bg-base-200/60 p-4">
        <span className="text-[0.9rem] text-base-content/60">To</span>
        <div className="mt-1">
          <AddressInput
            placeholder="Flare address"
            value={form.destination}
            onChange={form.setDestination}
            disabled={isLocked}
          />
        </div>
      </div>

      <BundlerToggle enabled={form.bundlerEnabled} onChange={form.setBundlerEnabled} disabled={isLocked} />

      <WithdrawSubmitButton phase={form.phase} onWithdraw={form.submitWithdraw} onReset={form.reset} />
    </div>
  );
};
