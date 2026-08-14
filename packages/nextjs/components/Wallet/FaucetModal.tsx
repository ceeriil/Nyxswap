"use client";

// ─────────────────────────────────────────────────────────────
// FaucetModal — lets a connected wallet claim test tokens (the live,
// on-chain-verified list from ~~/hooks/wallet/useDeployedTestTokens) from
// the Faucet contract in one batched claimMany() transaction. Controlled dialog (no
// own trigger) - opened from the header's FaucetTriggerButton / any
// WalletNotConnected panel, via FaucetModalProvider's useFaucetModal().
//
// The token list renders regardless of whether Faucet is deployed yet -
// only the cooldown lookup and the claim action need the live contract, and
// those degrade to "unknown cooldown" / a disabled button instead of
// hiding the whole list. CooldownFetcher below only mounts (and only then
// calls useReadContract) once a contract exists, so this never has to pass
// a null/undefined contract into a hook that requires a real one.
// ─────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAccount, useReadContract } from "wagmi";
import { TokenIcon } from "~~/components/assets/TokenIcon";
import { Button } from "~~/components/landing/Button";
import { useDepositableTokens } from "~~/hooks/wallet/useDepositableTokens";
import { useFaucet } from "~~/hooks/wallet/useFaucet";
import { type FaucetContract, useFaucetContract } from "~~/utils/faucetContract";
import { notification } from "~~/utils/scaffold-eth";

function cooldownLabel(availableAt: bigint): string {
  const remainingMs = Number(availableAt) * 1000 - Date.now();
  if (remainingMs <= 0) return "";
  const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
  return hours <= 1 ? "available in <1h" : `available in ${hours}h`;
}

interface FaucetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FaucetModal({ open, onOpenChange }: FaucetModalProps) {
  const contract = useFaucetContract();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex h-176 max-h-[90vh] w-lg max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-xl transition-all data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0">
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold leading-none">Get test tokens.</Dialog.Title>
              <p className="mt-1.5 text-xs text-base-content/60">
                {contract
                  ? "Testnet only - one signature claims every token selected below."
                  : "Testnet only - the faucet contract isn't deployed yet, so claiming is disabled for now."}
              </p>
            </div>
            <Dialog.Close aria-label="Close faucet" className="btn btn-ghost btn-circle btn-sm">
              <XMarkIcon className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <FaucetModalBody contract={contract} open={open} onClose={() => onOpenChange(false)} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CooldownFetcher({
  contract,
  account,
  tokenAddresses,
  open,
  onData,
}: {
  contract: FaucetContract;
  account: `0x${string}`;
  tokenAddresses: `0x${string}`[];
  open: boolean;
  onData: (data: readonly bigint[] | undefined) => void;
}) {
  const { data } = useReadContract({
    address: contract.address,
    abi: contract.abi,
    functionName: "claimableAt",
    args: [account, tokenAddresses],
    query: { enabled: open && tokenAddresses.length > 0 },
  });

  useEffect(() => {
    onData(data as readonly bigint[] | undefined);
  }, [data, onData]);

  return null;
}

function FaucetModalBody({
  contract,
  open,
  onClose,
}: {
  contract: FaucetContract | null;
  open: boolean;
  onClose: () => void;
}) {
  const { address: account } = useAccount();
  const { claimMany, isPending } = useFaucet();
  const { tokens, isLoading: tokensLoading } = useDepositableTokens();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [claimableAt, setClaimableAt] = useState<readonly bigint[] | undefined>();

  const tokenAddresses = useMemo(() => tokens.map(t => t.address), [tokens]);

  // Reset the selection to "everything claimable" each time the modal opens
  // (or once the deployed-token list resolves, since `tokens` starts empty).
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelected(new Set(tokens.map(t => t.address)));
  }, [open, tokens]);

  const visible = useMemo(
    () =>
      tokens.filter(
        t => t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [tokens, search],
  );

  const cooldowns = useMemo(() => {
    const map = new Map<string, string>();
    if (!claimableAt) return map;
    tokens.forEach((t, i) => {
      const label = cooldownLabel(claimableAt[i] ?? 0n);
      if (label) map.set(t.address, label);
    });
    return map;
  }, [tokens, claimableAt]);

  const toggle = (address: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  };

  const selectedClaimable = tokens.filter(t => selected.has(t.address) && !cooldowns.has(t.address));
  const selectableVisible = visible.filter(t => !cooldowns.has(t.address));
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every(t => selected.has(t.address));

  function toggleSelectAll() {
    setSelected(prev => {
      const next = new Set(prev);
      selectableVisible.forEach(t => (allVisibleSelected ? next.delete(t.address) : next.add(t.address)));
      return next;
    });
  }

  async function handleClaim() {
    try {
      await claimMany(selectedClaimable);
      onClose();
    } catch (e) {
      notification.error(e instanceof Error ? e.message : "Faucet claim failed");
    }
  }

  return (
    <>
      {contract && account && (
        <CooldownFetcher
          contract={contract}
          account={account as `0x${string}`}
          tokenAddresses={tokenAddresses}
          open={open}
          onData={setClaimableAt}
        />
      )}

      <div className="px-5 pb-3">
        <label className="flex items-center gap-2 rounded-xl border border-base-300 bg-base-200/60 px-3 py-2.5">
          <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-base-content/50" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tokens"
            aria-label="Search tokens"
            className="w-full bg-transparent text-sm outline-none placeholder:text-base-content/40"
          />
        </label>
      </div>

      <div className="flex items-center justify-between border-y border-base-300 px-5 py-2">
        <label
          className={`flex items-center gap-2 ${
            selectableVisible.length === 0 ? "cursor-not-allowed opacity-40" : "cursor-pointer"
          }`}
        >
          <input
            type="checkbox"
            checked={allVisibleSelected}
            disabled={selectableVisible.length === 0}
            onChange={toggleSelectAll}
            className="checkbox checkbox-sm rounded-md"
          />
          <span className="text-xs font-medium uppercase tracking-wide text-base-content/60">
            {allVisibleSelected ? "Deselect all" : "Select all"}
          </span>
        </label>
        <span className="text-xs text-base-content/50">
          {search ? `${visible.length} matching` : `${tokens.length} tokens`}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2">
        {tokensLoading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : visible.length === 0 ? (
          <span className="px-3 py-4 text-sm text-base-content/60">No matching tokens.</span>
        ) : (
          visible.map(t => {
            const cooldown = cooldowns.get(t.address);
            return (
              <label
                key={t.address}
                className={`group flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 ring-1 ring-transparent transition-all duration-200 ${
                  cooldown
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer hover:bg-base-200 hover:ring-primary/25"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="transition-transform duration-200 group-hover:scale-110">
                    <TokenIcon symbol={t.symbol} logoURI={t.logoURI} size="md" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm transition-colors group-hover:text-primary">{t.name}</p>
                    <p className="text-xs uppercase tracking-wide text-base-content/50">{cooldown ?? t.symbol}</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={selected.has(t.address) && !cooldown}
                  disabled={!!cooldown}
                  onChange={() => toggle(t.address)}
                  className="checkbox checkbox-sm shrink-0 rounded-md"
                />
              </label>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-base-300 px-5 py-4">
        <span className="text-xs font-medium uppercase tracking-wide text-base-content/60">
          {selectedClaimable.length} selected
        </span>
        <Button
          as="button"
          disabled={!contract || !account || isPending || selectedClaimable.length === 0}
          onClick={handleClaim}
          silver
          className="px-5! py-1.5! text-sm"
        >
          {!contract
            ? "Faucet not deployed"
            : !account
              ? "Connect wallet"
              : isPending
                ? "Claiming…"
                : "Claim selected"}
        </Button>
      </div>
    </>
  );
}
