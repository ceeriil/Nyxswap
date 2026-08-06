"use client";

import type { TokenSymbol } from "../_lib/tokens";
import type { SubmitPhase } from "../_lib/useSwapForm";
import { Button } from "~~/components/landing/Button";

type Props = {
  phase: SubmitPhase;
  sendToken: TokenSymbol;
  onApprove: () => void;
  onSwap: () => void;
  onReset: () => void;
};

const FULL_WIDTH = "w-full justify-center font-medium";

export const SwapSubmitButton = ({ phase, sendToken, onApprove, onSwap, onReset }: Props) => {
  switch (phase) {
    case "enter-amount":
      return (
        <Button as="button" disabled silver className={FULL_WIDTH}>
          Enter an amount
        </Button>
      );
    case "needs-approval":
      return (
        <Button as="button" onClick={onApprove} silver className={FULL_WIDTH}>
          Approve {sendToken}
        </Button>
      );
    case "approving":
      return (
        <Button as="button" disabled silver className={FULL_WIDTH}>
          <span className="loading loading-spinner loading-xs" />
          Approving {sendToken}…
        </Button>
      );
    case "ready":
      return (
        <Button as="button" onClick={onSwap} silver className={FULL_WIDTH}>
          Swap
        </Button>
      );
    case "confirming":
      return (
        <Button as="button" disabled silver className={FULL_WIDTH}>
          <span className="loading loading-spinner loading-xs" />
          Confirming in enclave…
        </Button>
      );
    case "settled":
      return (
        <Button as="button" onClick={onReset} silver className={FULL_WIDTH}>
          Settled — swap again
        </Button>
      );
    case "failed":
      return (
        <Button as="button" onClick={onReset} silver className={FULL_WIDTH}>
          Swap failed — try again
        </Button>
      );
    default:
      return null;
  }
};
