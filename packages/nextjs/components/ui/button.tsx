"use client";

import type * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { type VariantProps, cva } from "class-variance-authority";
import { Spinner } from "~~/components/ui/spinner";
import { cn } from "~~/utils/cn";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-oklch(0.922 0 0) font-medium text-base outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:ring-2 focus-visible:ring-oklch(0.708 0 0) focus-visible:ring-offset-1 focus-visible:ring-offset-oklch(1 0 0) disabled:pointer-events-none disabled:opacity-64 data-loading:select-none data-loading:text-transparent sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0 dark:border-oklch(1 0 0 / 10%) dark:focus-visible:ring-oklch(0.556 0 0) dark:focus-visible:ring-offset-oklch(0.145 0 0)",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 px-[calc(--spacing(3)-1px)] sm:h-8",
        icon: "size-9 sm:size-8",
        "icon-lg": "size-10 sm:size-9",
        "icon-sm": "size-8 sm:size-7",
        "icon-xl": "size-11 sm:size-10 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        "icon-xs":
          "size-7 rounded-md before:rounded-[calc(var(--radius-md)-1px)] sm:size-6 not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-4 sm:not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-[calc(--spacing(3.5)-1px)] sm:h-9",
        sm: "h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:h-7",
        xl: "h-11 px-[calc(--spacing(4)-1px)] text-lg sm:h-10 sm:text-base [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        xs: "h-7 gap-1 rounded-md px-[calc(--spacing(2)-1px)] text-sm before:rounded-[calc(var(--radius-md)-1px)] sm:h-6 sm:text-xs [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
      },
      variant: {
        default:
          "not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-oklch(0.205 0 0) bg-oklch(0.205 0 0) text-oklch(0.985 0 0) shadow-primary/24 shadow-xs hover:bg-oklch(0.205 0 0)/90 data-pressed:bg-oklch(0.205 0 0)/90 *:data-[slot=button-loading-indicator]:text-oklch(0.985 0 0) [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none dark:border-oklch(0.922 0 0) dark:bg-oklch(0.922 0 0) dark:text-oklch(0.205 0 0) dark:hover:bg-oklch(0.922 0 0)/90 dark:data-pressed:bg-oklch(0.922 0 0)/90 dark:*:data-[slot=button-loading-indicator]:text-oklch(0.205 0 0)",
        destructive:
          "not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-oklch(0.577 0.245 27.325) bg-oklch(0.577 0.245 27.325) text-white shadow-destructive/24 shadow-xs hover:bg-oklch(0.577 0.245 27.325)/90 data-pressed:bg-oklch(0.577 0.245 27.325)/90 *:data-[slot=button-loading-indicator]:text-white [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none dark:border-oklch(0.704 0.191 22.216) dark:bg-oklch(0.704 0.191 22.216) dark:hover:bg-oklch(0.704 0.191 22.216)/90 dark:data-pressed:bg-oklch(0.704 0.191 22.216)/90",
        "destructive-outline":
          "border-oklch(0.922 0 0) bg-oklch(1 0 0) not-dark:bg-clip-padding text-destructive-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:border-oklch(0.577 0.245 27.325)/32 hover:bg-oklch(0.577 0.245 27.325)/4 data-pressed:border-oklch(0.577 0.245 27.325)/32 data-pressed:bg-oklch(0.577 0.245 27.325)/4 *:data-[slot=button-loading-indicator]:text-oklch(0.145 0 0) dark:bg-oklch(0.922 0 0)/32 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [:disabled,:active,[data-pressed]]:shadow-none dark:border-oklch(1 0 0 / 15%) dark:bg-oklch(0.205 0 0) dark:hover:border-oklch(0.704 0.191 22.216)/32 dark:hover:bg-oklch(0.704 0.191 22.216)/4 dark:data-pressed:border-oklch(0.704 0.191 22.216)/32 dark:data-pressed:bg-oklch(0.704 0.191 22.216)/4 dark:*:data-[slot=button-loading-indicator]:text-oklch(0.985 0 0) dark:dark:bg-oklch(1 0 0 / 15%)/32",
        ghost:
          "border-transparent text-oklch(0.145 0 0) hover:bg-oklch(0.97 0 0) data-pressed:bg-oklch(0.97 0 0) *:data-[slot=button-loading-indicator]:text-oklch(0.145 0 0) dark:text-oklch(0.985 0 0) dark:hover:bg-oklch(0.269 0 0) dark:data-pressed:bg-oklch(0.269 0 0) dark:*:data-[slot=button-loading-indicator]:text-oklch(0.985 0 0)",
        link: "border-transparent text-oklch(0.145 0 0) underline-offset-4 hover:underline data-pressed:underline *:data-[slot=button-loading-indicator]:text-oklch(0.145 0 0) dark:text-oklch(0.985 0 0) dark:*:data-[slot=button-loading-indicator]:text-oklch(0.985 0 0)",
        outline:
          "border-oklch(0.922 0 0) bg-oklch(1 0 0) not-dark:bg-clip-padding text-oklch(0.145 0 0) shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:bg-oklch(0.97 0 0)/50 data-pressed:bg-oklch(0.97 0 0)/50 *:data-[slot=button-loading-indicator]:text-oklch(0.145 0 0) dark:bg-oklch(0.922 0 0)/32 dark:data-pressed:bg-oklch(0.922 0 0)/64 dark:hover:bg-oklch(0.922 0 0)/64 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [:disabled,:active,[data-pressed]]:shadow-none dark:border-oklch(1 0 0 / 15%) dark:bg-oklch(0.205 0 0) dark:text-oklch(0.985 0 0) dark:hover:bg-oklch(0.269 0 0)/50 dark:data-pressed:bg-oklch(0.269 0 0)/50 dark:*:data-[slot=button-loading-indicator]:text-oklch(0.985 0 0) dark:dark:bg-oklch(1 0 0 / 15%)/32 dark:dark:data-pressed:bg-oklch(1 0 0 / 15%)/64 dark:dark:hover:bg-oklch(1 0 0 / 15%)/64",
        secondary:
          "border-transparent bg-oklch(0.97 0 0) text-oklch(0.205 0 0) hover:bg-oklch(0.97 0 0)/90 data-pressed:bg-oklch(0.97 0 0)/90 *:data-[slot=button-loading-indicator]:text-oklch(0.205 0 0) [:active,[data-pressed]]:bg-oklch(0.97 0 0)/80 dark:bg-oklch(0.269 0 0) dark:text-oklch(0.985 0 0) dark:hover:bg-oklch(0.269 0 0)/90 dark:data-pressed:bg-oklch(0.269 0 0)/90 dark:*:data-[slot=button-loading-indicator]:text-oklch(0.985 0 0) dark:[:active,[data-pressed]]:bg-oklch(0.269 0 0)/80",
      },
    },
  },
);

export interface ButtonProps extends useRender.ComponentProps<"button"> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  render,
  children,
  loading = false,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement {
  const isDisabled: boolean = Boolean(loading || disabledProp);
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] = render ? undefined : "button";

  const defaultProps = {
    children: (
      <>
        {children}
        {loading && <Spinner className="pointer-events-none absolute" data-slot="button-loading-indicator" />}
      </>
    ),
    className: cn(buttonVariants({ className, size, variant })),
    "aria-disabled": loading || undefined,
    "data-loading": loading ? "" : undefined,
    "data-slot": "button",
    disabled: isDisabled,
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}
