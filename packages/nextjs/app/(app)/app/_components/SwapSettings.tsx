"use client";

import { SLIPPAGE_OPTIONS, type SlippageOption } from "../_lib/useSwapForm";

type Props = {
  slippageOption: SlippageOption;
  onSlippageOptionChange: (option: SlippageOption) => void;
  customSlippage: string;
  onCustomSlippageChange: (value: string) => void;
  deadlineMinutes: string;
  onDeadlineMinutesChange: (value: string) => void;
};

const SEGMENTS: { value: SlippageOption; label: string }[] = [
  ...SLIPPAGE_OPTIONS.map(value => ({ value, label: value === "auto" ? "Auto" : `${value}%` })),
  { value: "custom", label: "Custom" },
];

export const SwapSettings = ({
  slippageOption,
  onSlippageOptionChange,
  customSlippage,
  onCustomSlippageChange,
  deadlineMinutes,
  onDeadlineMinutesChange,
}: Props) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Slippage tolerance</span>
        <div className="flex items-center gap-2">
          <div className="join">
            {SEGMENTS.map(segment => (
              <button
                key={segment.value}
                type="button"
                className={`btn btn-xs join-item ${segment.value === slippageOption ? "btn-active" : ""}`}
                onClick={() => onSlippageOptionChange(segment.value)}
              >
                {segment.label}
              </button>
            ))}
          </div>
          {slippageOption === "custom" && (
            <input
              className="input input-xs input-bordered w-16"
              placeholder="0.5"
              inputMode="decimal"
              value={customSlippage}
              onChange={e => {
                if (/^\d*\.?\d*$/.test(e.target.value)) onCustomSlippageChange(e.target.value);
              }}
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-base-300 pt-4">
        <span className="text-sm font-medium">Transaction deadline</span>
        <div className="flex items-center gap-1.5">
          <input
            className="input input-xs input-bordered w-14 text-right"
            inputMode="numeric"
            value={deadlineMinutes}
            onChange={e => {
              if (/^\d*$/.test(e.target.value)) onDeadlineMinutesChange(e.target.value);
            }}
          />
          <span className="text-xs text-base-content/60">min</span>
        </div>
      </div>
    </div>
  );
};
