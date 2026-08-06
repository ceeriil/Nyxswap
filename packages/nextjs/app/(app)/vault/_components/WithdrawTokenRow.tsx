"use client";

import { TokenSelect } from "../../app/_components/TokenSelect";
import { formatUsd } from "../../app/_lib/format";
import { getUsdPrice } from "../../app/_lib/mockPool";
import { type TokenSymbol } from "../../app/_lib/tokens";

const AMOUNT_PATTERN = /^\d*\.?\d*$/;

type Props = {
  label: string;
  token: TokenSymbol;
  onTokenChange: (token: TokenSymbol) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  /** Amount of this token in the user's LP position — not a wallet balance. */
  available: number;
  readOnly?: boolean;
};

// Same card shape as TokenPairRow, but the "available" figure comes from the
// mock LP position (see mockVaultPosition.ts) rather than useBalance — a
// withdrawal redeems the pool position, not the connected wallet.
export const WithdrawTokenRow = ({
  label,
  token,
  onTokenChange,
  amount,
  onAmountChange,
  available,
  readOnly,
}: Props) => {
  const usdEstimate = amount && Number(amount) > 0 ? formatUsd(Number(amount) * getUsdPrice(token)) : null;

  return (
    <div className="rounded-2xl border border-base-300 bg-base-200/60 p-4">
      <span className="text-[0.9rem] text-base-content/60">{label}</span>

      <div className="mt-1 flex items-center justify-between gap-3">
        <input
          className="w-full bg-transparent text-3xl font-medium outline-none placeholder:text-base-content/30 disabled:text-base-content/50"
          placeholder="0.0"
          inputMode="decimal"
          autoComplete="off"
          readOnly={readOnly}
          disabled={readOnly}
          value={amount}
          onChange={e => {
            const next = e.target.value;
            if (AMOUNT_PATTERN.test(next)) onAmountChange(next);
          }}
        />
        <TokenSelect value={token} onChange={onTokenChange} />
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-base-content/50">
        <span>{usdEstimate ? `≈ ${usdEstimate}` : null}</span>
        <span className="flex items-center gap-2">
          <span>
            {available.toFixed(4)} {token} in pool
          </span>
          {!readOnly && available > 0 && (
            <button
              type="button"
              className="font-semibold text-base-content/80 hover:text-base-content"
              onClick={() => onAmountChange(String(available))}
            >
              Max
            </button>
          )}
        </span>
      </div>
    </div>
  );
};
