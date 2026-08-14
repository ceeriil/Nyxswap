"use client";

// ─────────────────────────────────────────────────────────────
// FaucetModalProvider — mounts a single FaucetModal instance app-wide so
// any component (header icon, wallet page CTA, ConnectWallet's details
// footer) can open the same modal via useFaucetModal() instead of each
// owning its own open state and its own <FaucetModal> mount.
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useState, type ReactNode } from "react";
import { FaucetModal } from "~~/components/Wallet/FaucetModal";

interface FaucetModalContextValue {
  openFaucet: () => void;
}

const FaucetModalContext = createContext<FaucetModalContextValue>({ openFaucet: () => {} });

export function useFaucetModal(): FaucetModalContextValue {
  return useContext(FaucetModalContext);
}

export function FaucetModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <FaucetModalContext.Provider value={{ openFaucet: () => setOpen(true) }}>
      {children}
      <FaucetModal open={open} onOpenChange={setOpen} />
    </FaucetModalContext.Provider>
  );
}
