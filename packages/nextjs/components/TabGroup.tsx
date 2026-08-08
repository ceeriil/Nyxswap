"use client";

import { Button } from "~~/components/landing/Button";

const TAB_CLASSES = "rounded-full px-4 py-1 h-8 text-sm";
const INACTIVE_CLASSES = "border-transparent bg-transparent hover:bg-landing-button-bg";

export type TabOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

// Shared segmented-tab pill, first built for Vault's Deposit/Withdraw switch —
// reused here so every tabbed page in the product looks like one system.
export const TabGroup = <T extends string>({ options, value, onChange, className }: Props<T>) => (
  <div
    className={`inline-flex w-fit items-center gap-1 rounded-full border border-base-300 bg-base-200/60 p-1 ${className ?? ""}`}
  >
    {options.map(option => (
      <Button
        key={option.value}
        as="button"
        onClick={() => onChange(option.value)}
        silver={value === option.value}
        className={`${TAB_CLASSES} ${value === option.value ? "" : INACTIVE_CLASSES}`}
      >
        {option.label}
      </Button>
    ))}
  </div>
);
