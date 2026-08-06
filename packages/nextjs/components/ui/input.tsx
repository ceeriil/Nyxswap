"use client";

import type * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "~~/utils/cn";

export type InputProps = Omit<InputPrimitive.Props & React.RefAttributes<HTMLInputElement>, "size"> & {
  size?: "sm" | "default" | "lg" | number;
  unstyled?: boolean;
  nativeInput?: boolean;
};

export function Input({
  className,
  size = "default",
  unstyled = false,
  nativeInput = false,
  style,
  ...props
}: InputProps): React.ReactElement {
  const inputClassName = cn(
    "h-8.5 w-full min-w-0 rounded-[inherit] px-[calc(--spacing(3)-1px)] text-oklch(0.145 0 0) leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] placeholder:text-oklch(0.556 0 0)/72 sm:h-7.5 sm:leading-7.5 autofill:[-webkit-text-fill-color:var(--foreground)] dark:text-oklch(0.985 0 0) dark:placeholder:text-oklch(0.708 0 0)/72",
    size === "sm" && "h-7.5 px-[calc(--spacing(2.5)-1px)] leading-7.5 sm:h-6.5 sm:leading-6.5",
    size === "lg" && "h-9.5 leading-9.5 sm:h-8.5 sm:leading-8.5",
    props.type === "search" &&
      "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
    props.type === "file" &&
      "text-oklch(0.556 0 0) file:me-3 file:bg-transparent file:font-medium file:text-oklch(0.145 0 0) file:text-sm dark:text-oklch(0.708 0 0) dark:file:text-oklch(0.985 0 0)",
  );

  return (
    <span
      className={
        cn(
          !unstyled &&
            "relative inline-flex w-full rounded-lg border border-oklch(0.922 0 0) bg-oklch(1 0 0) not-dark:bg-clip-padding text-base shadow-xs/5 ring-oklch(0.708 0 0)/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] has-focus-visible:has-aria-invalid:border-oklch(0.577 0.245 27.325)/64 has-focus-visible:has-aria-invalid:ring-oklch(0.577 0.245 27.325)/16 has-aria-invalid:border-oklch(0.577 0.245 27.325)/36 has-focus-visible:border-oklch(0.708 0 0) has-autofill:bg-oklch(0.145 0 0)/4 has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] sm:text-sm dark:bg-oklch(0.922 0 0)/32 dark:has-autofill:bg-oklch(0.145 0 0)/8 dark:has-aria-invalid:ring-oklch(0.577 0.245 27.325)/24 dark:not-has-disabled:not-has-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] dark:border-oklch(1 0 0 / 10%) dark:border-oklch(1 0 0 / 15%) dark:bg-oklch(0.145 0 0) dark:ring-oklch(0.556 0 0)/24 dark:has-focus-visible:has-aria-invalid:border-oklch(0.704 0.191 22.216)/64 dark:has-focus-visible:has-aria-invalid:ring-oklch(0.704 0.191 22.216)/16 dark:has-aria-invalid:border-oklch(0.704 0.191 22.216)/36 dark:has-focus-visible:border-oklch(0.556 0 0) dark:has-autofill:bg-oklch(0.985 0 0)/4 dark:dark:bg-oklch(1 0 0 / 15%)/32 dark:dark:has-autofill:bg-oklch(0.985 0 0)/8 dark:dark:has-aria-invalid:ring-oklch(0.704 0.191 22.216)/24",
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="input-control"
    >
      {nativeInput ? (
        <input
          className={inputClassName}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          style={typeof style === "function" ? undefined : style}
          {...props}
        />
      ) : (
        <InputPrimitive
          className={inputClassName}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          style={style}
          {...props}
        />
      )}
    </span>
  );
}

export { InputPrimitive };
