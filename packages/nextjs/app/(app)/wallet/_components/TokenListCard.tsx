"use client";

import { TokenBalanceRow } from "~~/components/Wallet/TokenBalanceRow";
import { useDepositableTokens } from "~~/hooks/wallet/useDepositableTokens";
import { useLazyReveal } from "~~/hooks/wallet/useLazyReveal";
import { useTokenPrices } from "~~/hooks/wallet/useTokenPrices";

export const TokenListCard = () => {
  const { tokens, isLoading } = useDepositableTokens();
  const { prices } = useTokenPrices();
  const { count: visibleCount, sentinelRef, hasMore } = useLazyReveal(tokens.length);

  return (
    <div className="card glass-panel shadow-xl w-full">
      <div className="card-body gap-3 p-5 px-8">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-base">Your tokens</h2>
          <span className="text-xs text-base-content/50">{tokens.length} tokens</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-10 text-center">
            <span className="text-sm text-base-content/60">No faucet tokens deployed on this network yet.</span>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto px-1 py-3">
            <ul className="flex flex-col gap-0.5">
              {tokens.map((t, i) => (
                <TokenBalanceRow
                  key={t.address}
                  token={t}
                  render={i < visibleCount}
                  usdPrice={prices[t.address.toLowerCase()]}
                />
              ))}
            </ul>
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-3">
                <span className="loading loading-spinner loading-sm" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
