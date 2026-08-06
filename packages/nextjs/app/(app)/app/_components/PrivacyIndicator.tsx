"use client";

import { ShieldCheckIcon } from "@heroicons/react/24/outline";

export const PrivacyIndicator = () => (
  <div
    className="tooltip"
    data-tip="Routed through Flare Confidential Compute — direction, amount, and trader stay hidden from the mempool until the swap settles on-chain."
  >
    <div className="badge   gap-1.5 cursor-default">
      <ShieldCheckIcon className="h-3 w-3" />
      Hidden until settlement
    </div>
  </div>
);
