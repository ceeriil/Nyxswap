"use client";

import { useState } from "react";
import { useSwapForm } from "../_lib/useSwapForm";
import { PrivacyIndicator } from "./PrivacyIndicator";
import { SwapDirectionToggle } from "./SwapDirectionToggle";
import { SwapSettingsModal } from "./SwapSettingsModal";
import { SwapSubmitButton } from "./SwapSubmitButton";
import { TokenPairRow } from "./TokenPairRow";
import { TradeDetails } from "./TradeDetails";
import { RiSettings5Fill } from "react-icons/ri";

export const SwapCard = () => {
  const form = useSwapForm();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const amountIn = Number(form.sendAmount) || 0;
  const receiveAmount = form.quote.amountOut ? form.quote.amountOut.toFixed(6) : "";
  const isSettled = form.phase === "settled" || form.phase === "failed";

  return (
    <div className="card  shadow-xl w-full max-w-xl">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between">
          <h1 className="card-title">Swap</h1>
          <button
            type="button"
            aria-label="Swap settings"
            className="btn btn-ghost btn-circle btn-sm border border-base-300 text-neutral-500"
            onClick={() => setSettingsOpen(true)}
          >
            <RiSettings5Fill size={20} />
          </button>
          <SwapSettingsModal
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            slippageOption={form.slippageOption}
            onSlippageOptionChange={form.setSlippageOption}
            customSlippage={form.customSlippage}
            onCustomSlippageChange={form.setCustomSlippage}
            deadlineMinutes={form.deadlineMinutes}
            onDeadlineMinutesChange={form.setDeadlineMinutes}
          />
        </div>

        <div className="flex flex-col">
          <TokenPairRow
            label="Send"
            token={form.sendToken}
            onTokenChange={form.selectSendToken}
            amount={form.sendAmount}
            onAmountChange={form.setSendAmount}
            readOnly={isSettled}
          />
          <SwapDirectionToggle onClick={form.swapTokens} />
          <TokenPairRow
            label="Receive"
            token={form.receiveToken}
            onTokenChange={form.selectReceiveToken}
            amount={receiveAmount}
            readOnly
          />
        </div>

        <TradeDetails
          sendToken={form.sendToken}
          receiveToken={form.receiveToken}
          amountIn={amountIn}
          priceImpactPct={form.quote.priceImpactPct}
          executionPrice={form.quote.executionPrice}
          ftsoReferencePrice={form.ftsoReferencePrice}
          ftsoDeviationPct={form.ftsoDeviationPct}
          ftsoDeviationExceeded={form.ftsoDeviationExceeded}
          minimumReceived={form.minimumReceived}
        />

   {/*      <div className="flex justify-center">
          <PrivacyIndicator />
        </div> */}

        <SwapSubmitButton
          phase={form.phase}
          sendToken={form.sendToken}
          onApprove={form.approve}
          onSwap={form.submitSwap}
          onReset={form.reset}
        />
      </div>
    </div>
  );
};
