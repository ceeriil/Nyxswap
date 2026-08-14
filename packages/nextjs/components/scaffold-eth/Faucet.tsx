"use client";

import { BanknotesIcon } from "@heroicons/react/24/outline";
import { useFaucetModal } from "~~/components/Wallet/FaucetModalProvider";
import { BUTTON_STYLES } from "~~/constants/landing";
import { cn } from "~~/utils/cn";

/**
 * Footer faucet trigger — opens the shared FaucetModal (claims every test
 * token in one claimMany() transaction) instead of owning its own
 * single-token mint flow.
 */
export const Faucet = () => {
  const { openFaucet } = useFaucetModal();

  return (
    <button
      type="button"
      onClick={openFaucet}
      className={cn(BUTTON_STYLES.base, "rounded-full px-2.5 py-1 sm:px-2.5 sm:py-1 text-xs font-normal gap-1")}
    >
      <BanknotesIcon className="h-3.5 w-3.5" />
      <span>Faucet</span>
    </button>
  );
};
