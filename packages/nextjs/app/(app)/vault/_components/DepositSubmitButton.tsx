"use client";

import type { TokenSymbol } from "../../app/_lib/tokens";
import type { DepositPhase } from "../_lib/useDepositForm";
import { Button } from "~~/components/landing/Button";

type Props = {
  phase: DepositPhase;
  tokenA: TokenSymbol;
  tokenB: TokenSymbol;
  onApproveA: () => void;
  onApproveB: () => void;
  onDeposit: () => void;
  onReset: () => void;
};

const FULL_WIDTH = "w-full justify-center font-medium";

export const DepositSubmitButton = ({ phase, tokenA, tokenB, onApproveA, onApproveB, onDeposit, onReset }: Props) => {
  switch (phase) {
    case "enter-amounts":
      return (
        <Button as="button" disabled silver className={FULL_WIDTH}>
          Enter amounts
        </Button>
      );
    case "needs-approval-a":
      return (
        <Button as="button" onClick={onApproveA} silver className={FULL_WIDTH}>
          Approve {tokenA}
        </Button>
      );
    case "approving-a":
      return (
        <Button as="button" disabled silver className={FULL_WIDTH}>
          <span className="loading loading-spinner loading-xs" />
          Approving {tokenA}…
        </Button>
      );
    case "needs-approval-b":
      return (
        <Button as="button" onClick={onApproveB} silver className={FULL_WIDTH}>
          Approve {tokenB}
        </Button>
      );
    case "approving-b":
      return (
        <Button as="button" disabled silver className={FULL_WIDTH}>
          <span className="loading loading-spinner loading-xs" />
          Approving {tokenB}…
        </Button>
      );
    case "ready":
      return (
        <Button as="button" onClick={onDeposit} silver className={FULL_WIDTH}>
          Add liquidity
        </Button>
      );
    case "confirming":
      return (
        <Button as="button" disabled silver className={FULL_WIDTH}>
          <span className="loading loading-spinner loading-xs" />
          Confirming — waiting on TEE credit…
        </Button>
      );
    case "settled":
      return (
        <Button as="button" onClick={onReset} silver className={FULL_WIDTH}>
          Settled — deposit again
        </Button>
      );
    case "failed":
      return (
        <Button as="button" onClick={onReset} silver className={FULL_WIDTH}>
          Deposit failed — try again
        </Button>
      );
    default:
      return null;
  }
};
