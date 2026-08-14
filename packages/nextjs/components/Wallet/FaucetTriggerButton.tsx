"use client";

import { PiDropSimpleLight } from "react-icons/pi";
import { useFaucetModal } from "~~/components/Wallet/FaucetModalProvider";

export function FaucetTriggerButton() {
  const { openFaucet } = useFaucetModal();

  return (
    <button
      type="button"
      onClick={openFaucet}
      aria-label="Get test tokens"
      title="Get test tokens"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-base-300 text-base-content/60 transition-colors hover:border-primary hover:text-primary"
    >
      <span className="h-4 w-4">
        <PiDropSimpleLight size={16} />
      </span>
    </button>
  );
}
