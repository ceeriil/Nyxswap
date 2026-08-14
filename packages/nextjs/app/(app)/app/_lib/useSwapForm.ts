import { useCallback, useMemo, useRef, useState } from "react";
import { FTSO_DEVIATION_WARN_PCT, getFtsoReferencePrice, quoteSwap } from "./mockPool";
import type { TokenSymbol } from "./tokens";

export const SLIPPAGE_OPTIONS = ["auto", "0.1", "0.5", "1"] as const;
export type SlippageOption = (typeof SLIPPAGE_OPTIONS)[number] | "custom";

const AUTO_SLIPPAGE_PCT = 0.5;
const DEFAULT_DEADLINE_MINUTES = "20";

export type SubmitPhase =
  | "enter-amount"
  | "needs-approval"
  | "approving"
  | "ready"
  | "confirming"
  | "settled"
  | "failed";

export const useSwapForm = () => {
  const [sendToken, setSendToken] = useState<TokenSymbol>("FXRP");
  const [receiveToken, setReceiveToken] = useState<TokenSymbol>("WFLR");
  const [sendAmount, setSendAmount] = useState("");

  const [slippageOption, setSlippageOption] = useState<SlippageOption>("auto");
  const [customSlippage, setCustomSlippage] = useState("");
  const [deadlineMinutes, setDeadlineMinutes] = useState(DEFAULT_DEADLINE_MINUTES);

  const [approvedTokens, setApprovedTokens] = useState<Set<TokenSymbol>>(new Set());
  const [phase, setPhase] = useState<SubmitPhase>("enter-amount");
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const amountIn = Number(sendAmount) || 0;

  const quote = useMemo(() => quoteSwap(sendToken, receiveToken, amountIn), [sendToken, receiveToken, amountIn]);

  const ftsoReferencePrice = useMemo(() => getFtsoReferencePrice(sendToken, receiveToken), [sendToken, receiveToken]);

  const ftsoDeviationPct = useMemo(() => {
    if (!quote.executionPrice) return 0;
    return ((quote.executionPrice - ftsoReferencePrice) / ftsoReferencePrice) * 100;
  }, [quote.executionPrice, ftsoReferencePrice]);

  const ftsoDeviationExceeded = Math.abs(ftsoDeviationPct) > FTSO_DEVIATION_WARN_PCT;

  const slippagePct =
    slippageOption === "auto"
      ? AUTO_SLIPPAGE_PCT
      : Number(slippageOption === "custom" ? customSlippage : slippageOption) || 0;

  const minimumReceived = quote.amountOut * (1 - slippagePct / 100);

  // Every deployed test token is a real ERC20 (no native-token case
  // anymore), so approval is always required until granted.
  const needsApproval = !approvedTokens.has(sendToken);

  const derivedPhase: SubmitPhase = useMemo(() => {
    if (phase === "approving" || phase === "confirming" || phase === "settled" || phase === "failed") return phase;
    if (amountIn <= 0) return "enter-amount";
    if (needsApproval) return "needs-approval";
    return "ready";
  }, [phase, amountIn, needsApproval]);

  const swapTokens = useCallback(() => {
    setSendToken(receiveToken);
    setReceiveToken(sendToken);
    setSendAmount("");
  }, [sendToken, receiveToken]);

  const selectSendToken = useCallback(
    (token: TokenSymbol) => {
      if (token === receiveToken) {
        setReceiveToken(sendToken);
      }
      setSendToken(token);
    },
    [sendToken, receiveToken],
  );

  const selectReceiveToken = useCallback(
    (token: TokenSymbol) => {
      if (token === sendToken) {
        setSendToken(receiveToken);
      }
      setReceiveToken(token);
    },
    [sendToken, receiveToken],
  );

  const approve = useCallback(() => {
    setPhase("approving");
    settleTimer.current = setTimeout(() => {
      setApprovedTokens(prev => new Set(prev).add(sendToken));
      setPhase("ready");
    }, 1200);
  }, [sendToken]);

  const submitSwap = useCallback(() => {
    setPhase("confirming");
    settleTimer.current = setTimeout(() => {
      // Demo-only: occasionally show the Failed state so the full
      // state machine (spec'd in nyxswap-swap-form-spec.md) is reachable.
      const succeeded = Math.random() > 0.15;
      setPhase(succeeded ? "settled" : "failed");
    }, 2000);
  }, []);

  const reset = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setSendAmount("");
    setPhase("enter-amount");
  }, []);

  return {
    sendToken,
    receiveToken,
    sendAmount,
    setSendAmount,
    selectSendToken,
    selectReceiveToken,
    swapTokens,

    slippageOption,
    setSlippageOption,
    customSlippage,
    setCustomSlippage,
    slippagePct,
    deadlineMinutes,
    setDeadlineMinutes,

    quote,
    ftsoReferencePrice,
    ftsoDeviationPct,
    ftsoDeviationExceeded,
    minimumReceived,

    phase: derivedPhase,
    approve,
    submitSwap,
    reset,
  };
};
