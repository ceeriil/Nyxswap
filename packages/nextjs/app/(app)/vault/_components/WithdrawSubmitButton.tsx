"use client";

import type { WithdrawPhase } from "../_lib/useWithdrawForm";
import { Button } from "~~/components/landing/Button";

type Props = {
  phase: WithdrawPhase;
  onWithdraw: () => void;
  onReset: () => void;
};

const FULL_WIDTH = "w-full justify-center font-medium";

export const WithdrawSubmitButton = ({ phase, onWithdraw, onReset }: Props) => {
  switch (phase) {
    case "select-amount":
      return (
        <Button as="button" disabled silver className={FULL_WIDTH}>
          Select an amount
        </Button>
      );
    case "needs-destination":
      return (
        <Button as="button" disabled silver className={FULL_WIDTH}>
          Enter a destination address
        </Button>
      );
    case "ready":
      return (
        <Button as="button" onClick={onWithdraw} silver className={FULL_WIDTH}>
          Withdraw
        </Button>
      );
    case "confirming":
      return (
        <Button as="button" disabled silver className={FULL_WIDTH}>
          <span className="loading loading-spinner loading-xs" />
          Confirming — TEE signing authorization…
        </Button>
      );
    case "ready-to-broadcast":
      return (
        <Button as="button" onClick={onReset} silver className={FULL_WIDTH}>
          Ready to broadcast — bundler will submit this for you
        </Button>
      );
    case "settled":
      return (
        <Button as="button" onClick={onReset} silver className={FULL_WIDTH}>
          Settled — withdraw again
        </Button>
      );
    case "failed":
      return (
        <Button as="button" onClick={onReset} silver className={FULL_WIDTH}>
          Withdrawal failed — try again
        </Button>
      );
    default:
      return null;
  }
};
