"use client";

import { useState } from "react";
import { TOKENS, type TokenSymbol } from "../_lib/tokens";
import { TokenIcon } from "./TokenIcon";
import { TokenSelectModal } from "./TokenSelectModal";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export const TokenSelect = ({ value, onChange }: { value: TokenSymbol; onChange: (token: TokenSymbol) => void }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-md rounded-full gap-1.5 pl-1.5 pr-2.5 border-base-300 bg-base-200 hover:bg-base-200"
        onClick={() => setOpen(true)}
      >
        <TokenIcon symbol={value} colorClassName={TOKENS[value].avatarClassName} size="md" />
        <span className="font-semibold">{value}</span>
        <ChevronDownIcon className="h-4 w-4 opacity-60" />
      </button>

      <TokenSelectModal open={open} onOpenChange={setOpen} value={value} onChange={onChange} />
    </>
  );
};
