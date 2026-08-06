"use client";

import { TokenPairRow } from "../../app/_components/TokenPairRow";
import { useDepositForm } from "../_lib/useDepositForm";
import { DepositDetails } from "./DepositDetails";
import { DepositSubmitButton } from "./DepositSubmitButton";

export const DepositForm = () => {
  const form = useDepositForm();
  const isSettled = form.phase === "settled" || form.phase === "failed";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <TokenPairRow
          label="Token A"
          token={form.tokenA}
          onTokenChange={form.selectTokenA}
          amount={form.amountA}
          onAmountChange={form.setAmountA}
          readOnly={isSettled}
        />
        <TokenPairRow
          label="Token B"
          token={form.tokenB}
          onTokenChange={form.selectTokenB}
          amount={form.amountB}
          onAmountChange={form.setAmountB}
          readOnly={isSettled}
        />
      </div>

      <DepositDetails
        tokenA={form.tokenA}
        tokenB={form.tokenB}
        bPerA={form.ratio.bPerA}
        amountA={Number(form.amountA) || 0}
      />

      {/* Compliance state (open/KYC-gated) intentionally omitted — no policy
          decision has been made yet on whether this product gates deposits
          at all. See brief.md's unresolved architecture questions. */}

      <DepositSubmitButton
        phase={form.phase}
        tokenA={form.tokenA}
        tokenB={form.tokenB}
        onApproveA={form.approveA}
        onApproveB={form.approveB}
        onDeposit={form.submitDeposit}
        onReset={form.reset}
      />
    </div>
  );
};
