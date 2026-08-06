"use client";

import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

export const SwapHistoryEmptyState = ({ connected }: { connected: boolean }) => (
  <div className="flex flex-col items-center gap-3 py-16 text-center">
    <p className="text-sm text-base-content/60">{connected ? "No swaps yet." : "Connect wallet to get started."}</p>
    {!connected && <RainbowKitCustomConnectButton />}
  </div>
);
