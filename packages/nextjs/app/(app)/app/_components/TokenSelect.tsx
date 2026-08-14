"use client";

import { useState } from "react";
import type { TokenSymbol } from "../_lib/tokens";
import { TokenSelectModal } from "./TokenSelectModal";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { TokenIcon } from "~~/components/assets/TokenIcon";
import { useDeployedTestTokens } from "~~/hooks/wallet/useDeployedTestTokens";

export const TokenSelect = ({ value, onChange }: { value: TokenSymbol; onChange: (token: TokenSymbol) => void }) => {
  const [open, setOpen] = useState(false);
  const { tokens } = useDeployedTestTokens();
  const logoURI = tokens.find(t => t.symbol === value)?.logoURI;

  return (
    <>
      <button
        type="button"
        className="btn btn-md rounded-full gap-1.5 pl-1.5 pr-2.5 border-base-300 bg-base-200 hover:bg-base-200"
        onClick={() => setOpen(true)}
      >
        <TokenIcon symbol={value} logoURI={logoURI} size="md" />
        <span className="font-semibold">{value}</span>
        <ChevronDownIcon className="h-4 w-4 opacity-60" />
      </button>

      <TokenSelectModal open={open} onOpenChange={setOpen} value={value} onChange={onChange} />
    </>
  );
};
