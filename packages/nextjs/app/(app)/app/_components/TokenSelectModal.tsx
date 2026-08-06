"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatUsd } from "../_lib/format";
import { getUsdPrice } from "../_lib/mockPool";
import { TOKEN_LIST, type TokenSymbol } from "../_lib/tokens";
import { TokenIcon } from "./TokenIcon";
import { Address } from "@scaffold-ui/components";
import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { CheckIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

// No real search-loading source yet (see mockPool.ts) — this simulates the
// fetch a live price/balance feed would need, so the skeleton state is real.
const SIMULATED_LOAD_MS = 350;
const SKELETON_ROWS = 3;

const TokenRowSkeleton = () => (
  <div className="flex items-center gap-3 rounded-xl px-2 py-2.5">
    <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
    <div className="flex flex-1 flex-col gap-1.5">
      <div className="skeleton h-3.5 w-14 rounded" />
      <div className="skeleton h-3 w-24 rounded" />
      <div className="skeleton h-3 w-20 rounded" />
    </div>
    <div className="flex flex-col items-end gap-1.5">
      <div className="skeleton h-3.5 w-14 rounded" />
      <div className="skeleton h-3 w-10 rounded" />
    </div>
  </div>
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: TokenSymbol;
  onChange: (token: TokenSymbol) => void;
};

/** Reusable "select a token" modal: search + scrollable list, skeleton while (simulated) loading. */
export const TokenSelectModal = ({ open, onOpenChange, value, onChange }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const { address } = useAccount();
  const { data: nativeBalance } = useBalance({ address, query: { enabled: Boolean(address) && open } });
  const nativeBalanceAmount = nativeBalance ? Number(formatUnits(nativeBalance.value, nativeBalance.decimals)) : null;
  const { targetNetwork } = useTargetNetwork();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setLoading(true);
    const loadTimer = setTimeout(() => setLoading(false), SIMULATED_LOAD_MS);
    const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => {
      clearTimeout(loadTimer);
      clearTimeout(focusTimer);
    };
  }, [open]);

  const filteredTokens = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOKEN_LIST;
    return TOKEN_LIST.filter(token => token.symbol.toLowerCase().includes(q) || token.name.toLowerCase().includes(q));
  }, [query]);

  const handleSelect = (token: TokenSymbol) => {
    onChange(token);
    onOpenChange(false);
  };

  return (
    <dialog ref={dialogRef} className="modal" aria-labelledby="token-select-title" onClose={() => onOpenChange(false)}>
      <div className="modal-box flex max-h-112 w-full max-w-md flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-0 shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 id="token-select-title" className="text-lg font-semibold">
            Select a token
          </h3>
          <button
            type="button"
            aria-label="Close"
            className="btn btn-ghost btn-circle btn-sm"
            onClick={() => onOpenChange(false)}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5">
          <label className="flex items-center gap-2 rounded-xl border border-base-300 bg-base-200/60 px-3 py-2.5">
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-base-content/50" />
            <input
              ref={searchInputRef}
              type="text"
              className="w-full bg-transparent text-sm outline-none placeholder:text-base-content/40"
              placeholder="Search name or symbol"
              autoComplete="off"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">
          {loading ? (
            <div className="flex flex-col gap-1">
              {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <TokenRowSkeleton key={i} />
              ))}
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="py-10 text-center text-sm text-base-content/60">
              No tokens found{query ? ` for "${query}"` : ""}.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredTokens.map(token => {
                const isSelected = token.symbol === value;
                const balance = token.isNative ? nativeBalanceAmount : null;

                return (
                  // A <div> (not <button>) — Address below renders its own copy/explorer
                  // controls, and a button can't legally nest interactive children.
                  <div
                    key={token.symbol}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelect(token.symbol)}
                    onKeyDown={e => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      handleSelect(token.symbol);
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-base-200 focus-visible:bg-base-200 focus-visible:outline-none"
                  >
                    <TokenIcon symbol={token.symbol} colorClassName={token.avatarClassName} size="md" />
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 leading-tight">
                      <span className="font-semibold">{token.symbol}</span>
                      <span className="truncate text-xs text-base-content/60">{token.name}</span>
                      {token.address ? (
                        <span onClick={e => e.stopPropagation()}>
                          <Address address={token.address} chain={targetNetwork} format="short" size="xs" />
                        </span>
                      ) : (
                        <span className="text-xs text-base-content/40">Native token</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end leading-tight tabular-nums">
                      <span className="text-sm font-medium">{formatUsd(getUsdPrice(token.symbol))}</span>
                      <span className="text-xs text-base-content/50">
                        {balance !== null ? balance.toFixed(4) : "—"}
                      </span>
                    </div>
                    {isSelected && <CheckIcon className="h-4 w-4 shrink-0 text-base-content" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button type="button" aria-label="Close" onClick={() => onOpenChange(false)}>
          close
        </button>
      </form>
    </dialog>
  );
};
