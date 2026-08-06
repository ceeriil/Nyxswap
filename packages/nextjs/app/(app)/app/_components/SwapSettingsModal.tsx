"use client";

import { useEffect, useRef } from "react";
import type { SlippageOption } from "../_lib/useSwapForm";
import { SwapSettings } from "./SwapSettings";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "~~/components/landing/Button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slippageOption: SlippageOption;
  onSlippageOptionChange: (option: SlippageOption) => void;
  customSlippage: string;
  onCustomSlippageChange: (value: string) => void;
  deadlineMinutes: string;
  onDeadlineMinutesChange: (value: string) => void;
};

export const SwapSettingsModal = ({ open, onOpenChange, ...settingsProps }: Props) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="modal" aria-labelledby="swap-settings-title" onClose={() => onOpenChange(false)}>
      <div className="modal-box flex w-full max-w-md flex-col gap-4 rounded-2xl border border-base-300 bg-base-100 p-0 shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 id="swap-settings-title" className="text-lg font-semibold">
            Swap settings
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
          <SwapSettings {...settingsProps} />
        </div>

        <div className="flex justify-end border-t border-base-300 px-5 py-4">
          <Button as="button" onClick={() => onOpenChange(false)} silver className="font-medium">
            Save
          </Button>
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
