import { useCallback, useMemo, useRef, useState } from "react";
import type { TokenSymbol } from "../../app/_lib/tokens";
import { getPositionRatio, getUserPosition } from "./mockVaultPosition";

export type WithdrawPhase =
  | "select-amount"
  | "needs-destination"
  | "ready"
  | "confirming"
  | "ready-to-broadcast"
  | "settled"
  | "failed";

export const useWithdrawForm = () => {
  const [tokenA, setTokenAState] = useState<TokenSymbol>("FXRP");
  const [tokenB, setTokenBState] = useState<TokenSymbol>("FLR");

  // Ratio-linked, same mechanism as Deposit: only the side the user last
  // typed into is stored, the other side is always derived from the
  // position's current ratio.
  const [rawAmount, setRawAmount] = useState("");
  const [lastEdited, setLastEdited] = useState<"A" | "B">("A");

  const [destination, setDestination] = useState("");
  const [bundlerEnabled, setBundlerEnabled] = useState(true);
  const [phase, setPhase] = useState<WithdrawPhase>("select-amount");
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const position = useMemo(() => getUserPosition(tokenA, tokenB), [tokenA, tokenB]);
  const ratio = useMemo(() => getPositionRatio(tokenA, tokenB), [tokenA, tokenB]);

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

  const derivedPhase: WithdrawPhase = useMemo(() => {
    if (["confirming", "ready-to-broadcast", "settled", "failed"].includes(phase)) return phase;
    if (!amountA || !amountB || Number(amountA) <= 0 || Number(amountB) <= 0) return "select-amount";
    if (!destination.trim()) return "needs-destination";
    return "ready";
  }, [phase, amountA, amountB, destination]);

  const submitWithdraw = useCallback(() => {
    setPhase("confirming");
    settleTimer.current = setTimeout(() => {
      const succeeded = Math.random() > 0.15;
      if (!succeeded) {
        setPhase("failed");
        return;
      }
      // Bundler on: TEE hands back a signed authorization for anyone to
      // broadcast, so there's no wallet-confirms step left for this user.
      setPhase(bundlerEnabled ? "ready-to-broadcast" : "settled");
    }, 2000);
  }, [bundlerEnabled]);

  const reset = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setRawAmount("");
    setLastEdited("A");
    setDestination("");
    setPhase("select-amount");
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
    position,

    destination,
    setDestination,
    bundlerEnabled,
    setBundlerEnabled,

    phase: derivedPhase,
    submitWithdraw,
    reset,
  };
};
