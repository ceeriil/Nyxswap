import { useCallback, useMemo, useRef, useState } from "react";
import { getPoolRatio } from "../../app/_lib/mockPool";
import type { TokenSymbol } from "../../app/_lib/tokens";

export type DepositPhase =
  | "enter-amounts"
  | "needs-approval-a"
  | "approving-a"
  | "needs-approval-b"
  | "approving-b"
  | "ready"
  | "confirming"
  | "settled"
  | "failed";

export const useDepositForm = () => {
  const [tokenA, setTokenAState] = useState<TokenSymbol>("FXRP");
  const [tokenB, setTokenBState] = useState<TokenSymbol>("WFLR");

  // Ratio-linked amounts: only the side the user last typed into is stored —
  // the other side is always derived from the current pool ratio, so the
  // two fields can never drift into an unbalanced ratio (see vault spec).
  const [rawAmount, setRawAmount] = useState("");
  const [lastEdited, setLastEdited] = useState<"A" | "B">("A");

  const [approvedTokens, setApprovedTokens] = useState<Set<TokenSymbol>>(new Set());
  const [phase, setPhase] = useState<DepositPhase>("enter-amounts");
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ratio = useMemo(() => getPoolRatio(tokenA, tokenB), [tokenA, tokenB]);

  const amountA = useMemo(() => {
    if (lastEdited === "A") return rawAmount;
    const n = Number(rawAmount);
    return rawAmount && n > 0 ? (n * ratio.aPerB).toFixed(6) : "";
  }, [lastEdited, rawAmount, ratio]);

  const amountB = useMemo(() => {
    if (lastEdited === "B") return rawAmount;
    const n = Number(rawAmount);
    return rawAmount && n > 0 ? (n * ratio.bPerA).toFixed(6) : "";
  }, [lastEdited, rawAmount, ratio]);

  const setAmountA = useCallback((value: string) => {
    setLastEdited("A");
    setRawAmount(value);
  }, []);

  const setAmountB = useCallback((value: string) => {
    setLastEdited("B");
    setRawAmount(value);
  }, []);

  const selectTokenA = useCallback(
    (token: TokenSymbol) => {
      if (token === tokenB) setTokenBState(tokenA);
      setTokenAState(token);
    },
    [tokenA, tokenB],
  );

  const selectTokenB = useCallback(
    (token: TokenSymbol) => {
      if (token === tokenA) setTokenAState(tokenB);
      setTokenBState(token);
    },
    [tokenA, tokenB],
  );

  // Every deployed test token is a real ERC20 (no native-token case
  // anymore), so approval is always required until granted.
  const needsApprovalA = !approvedTokens.has(tokenA);
  const needsApprovalB = !approvedTokens.has(tokenB);

  const derivedPhase: DepositPhase = useMemo(() => {
    if (["approving-a", "approving-b", "confirming", "settled", "failed"].includes(phase)) return phase;
    if (!amountA || !amountB || Number(amountA) <= 0 || Number(amountB) <= 0) return "enter-amounts";
    if (needsApprovalA) return "needs-approval-a";
    if (needsApprovalB) return "needs-approval-b";
    return "ready";
  }, [phase, amountA, amountB, needsApprovalA, needsApprovalB]);

  const approveA = useCallback(() => {
    setPhase("approving-a");
    settleTimer.current = setTimeout(() => {
      setApprovedTokens(prev => new Set(prev).add(tokenA));
      setPhase("ready");
    }, 1200);
  }, [tokenA]);

  const approveB = useCallback(() => {
    setPhase("approving-b");
    settleTimer.current = setTimeout(() => {
      setApprovedTokens(prev => new Set(prev).add(tokenB));
      setPhase("ready");
    }, 1200);
  }, [tokenB]);

  const submitDeposit = useCallback(() => {
    setPhase("confirming");
    settleTimer.current = setTimeout(() => {
      const succeeded = Math.random() > 0.15;
      setPhase(succeeded ? "settled" : "failed");
    }, 2000);
  }, []);

  const reset = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setRawAmount("");
    setLastEdited("A");
    setPhase("enter-amounts");
  }, []);

  return {
    tokenA,
    tokenB,
    selectTokenA,
    selectTokenB,

    amountA,
    amountB,
    setAmountA,
    setAmountB,
    ratio,

    phase: derivedPhase,
    approveA,
    approveB,
    submitDeposit,
    reset,
  };
};
