"use client";

import { formatUsd } from "../_lib/format";
import { getUsdPrice } from "../_lib/mockPool";
import { TOKENS, type TokenSymbol } from "../_lib/tokens";
import { TokenSelect } from "./TokenSelect";
import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";

const AMOUNT_PATTERN = /^\d*\.?\d*$/;

type Props = {
  label: string;
  token: TokenSymbol;
  onTokenChange: (token: TokenSymbol) => void;
  amount: string;
  onAmountChange?: (amount: string) => void;
  readOnly?: boolean;
};

export const TokenPairRow = ({ label, token, onTokenChange, amount, onAmountChange, readOnly }: Props) => {
  const { address } = useAccount();
  const isNative = TOKENS[token].isNative;
  const { data: nativeBalance } = useBalance({ address, query: { enabled: Boolean(address) && isNative } });

  // No pool/token contract deployed yet (see brief.md's open questions), so
  // only the connected wallet's native balance is real — everything else is
  // a placeholder until useScaffoldReadContract has something to read.
  const balance = isNative && nativeBalance ? Number(formatUnits(nativeBalance.value, nativeBalance.decimals)) : null;
  const balanceLabel = balance !== null ? balance.toFixed(4) : "0";

  const usdEstimate = amount && Number(amount) > 0 ? formatUsd(Number(amount) * getUsdPrice(token)) : null;

  return (
    <div className="glass-panel-inset p-4">
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
            if (AMOUNT_PATTERN.test(next)) onAmountChange?.(next);
          }}
        />
        <TokenSelect value={token} onChange={onTokenChange} />
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-base-content/50">
        <span>{usdEstimate ? `≈ ${usdEstimate}` : null}</span>
        <span className="flex items-center gap-2">
          <span>
            {balanceLabel} {token}
          </span>
          {!readOnly && balance !== null && balance > 0 && (
            <button
              type="button"
              className="font-semibold text-base-content/80 hover:text-base-content"
              onClick={() => onAmountChange?.(String(balance))}
            >
              Max
            </button>
          )}
        </span>
      </div>
    </div>
  );
};
