"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { flareTestnet } from "viem/chains";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { notification } from "~~/utils/scaffold-eth";
import { contracts } from "~~/utils/scaffold-eth/contract";

type TokenSymbol = "FLR" | "USDT" | "BTC" | "ETH";
type Tab = "FAUCET" | "DEPOSIT" | "WITHDRAW" | "HISTORY";

// USDT/BTC/ETH test tokens aren't deployed yet — this UI is a working port for
// FLR only, with the others wired the same way so they light up once deployed.
const TOKENS: { symbol: TokenSymbol; contractName: string; faucetAmount: string; decimals: number }[] = [
  { symbol: "FLR", contractName: "FlrTestToken", faucetAmount: "10000", decimals: 18 },
  { symbol: "USDT", contractName: "UsdtTestToken", faucetAmount: "100000", decimals: 6 },
  { symbol: "BTC", contractName: "BtcTestToken", faucetAmount: "1", decimals: 8 },
  { symbol: "ETH", contractName: "EthTestToken", faucetAmount: "15", decimals: 18 },
];

type HistoryEntry = {
  id: string;
  type: "MINT" | "DEPOSIT" | "WITHDRAW";
  symbol: TokenSymbol;
  amount: string;
  timestamp: number;
};

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`.toLowerCase();
}

function formatAmount(balance: bigint | undefined, decimals: number): string {
  if (balance === undefined) return "—";
  return parseFloat(formatUnits(balance, decimals)).toFixed(4);
}

// Deployment addresses are static config, not chain-fetched state — plain lookup
// instead of a hook. Undefined until the matching Foundry deploy has run.
function getContractAddress(contractName: string): `0x${string}` | undefined {
  return contracts?.[flareTestnet.id]?.[contractName]?.address as `0x${string}` | undefined;
}

const INSTRUCTION_SENDER_ADDRESS = getContractAddress("NyxSwapInstructionSender");

type WalletModalProps = {
  open: boolean;
  onClose: () => void;
};

export const WalletModal = ({ open, onClose }: WalletModalProps) => {
  const { address } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  const [tab, setTab] = useState<Tab>("FAUCET");
  const [tokenIdx, setTokenIdx] = useState(0);
  const [amount, setAmount] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isMintingAll, setIsMintingAll] = useState(false);

  const flrBalance = useScaffoldReadContract({
    contractName: "FlrTestToken",
    functionName: "balanceOf",
    args: [address],
  });
  const usdtBalance = useScaffoldReadContract({
    contractName: "UsdtTestToken",
    functionName: "balanceOf",
    args: [address],
  });
  const btcBalance = useScaffoldReadContract({
    contractName: "BtcTestToken",
    functionName: "balanceOf",
    args: [address],
  });
  const ethBalance = useScaffoldReadContract({
    contractName: "EthTestToken",
    functionName: "balanceOf",
    args: [address],
  });

  const balances: Record<TokenSymbol, bigint | undefined> = {
    FLR: flrBalance.data,
    USDT: usdtBalance.data,
    BTC: btcBalance.data,
    ETH: ethBalance.data,
  };

  const flrAllowance = useScaffoldReadContract({
    contractName: "FlrTestToken",
    functionName: "allowance",
    args: [address, INSTRUCTION_SENDER_ADDRESS],
  });
  const usdtAllowance = useScaffoldReadContract({
    contractName: "UsdtTestToken",
    functionName: "allowance",
    args: [address, INSTRUCTION_SENDER_ADDRESS],
  });
  const btcAllowance = useScaffoldReadContract({
    contractName: "BtcTestToken",
    functionName: "allowance",
    args: [address, INSTRUCTION_SENDER_ADDRESS],
  });
  const ethAllowance = useScaffoldReadContract({
    contractName: "EthTestToken",
    functionName: "allowance",
    args: [address, INSTRUCTION_SENDER_ADDRESS],
  });

  const allowances: Record<TokenSymbol, bigint | undefined> = {
    FLR: flrAllowance.data,
    USDT: usdtAllowance.data,
    BTC: btcAllowance.data,
    ETH: ethAllowance.data,
  };

  const flrWrite = useScaffoldWriteContract({ contractName: "FlrTestToken" });
  const usdtWrite = useScaffoldWriteContract({ contractName: "UsdtTestToken" });
  const btcWrite = useScaffoldWriteContract({ contractName: "BtcTestToken" });
  const ethWrite = useScaffoldWriteContract({ contractName: "EthTestToken" });

  const writers: Record<TokenSymbol, ReturnType<typeof useScaffoldWriteContract>> = {
    FLR: flrWrite,
    USDT: usdtWrite,
    BTC: btcWrite,
    ETH: ethWrite,
  };

  const instructionSenderWrite = useScaffoldWriteContract({ contractName: "NyxSwapInstructionSender" });

  const [depositStep, setDepositStep] = useState<"idle" | "approving" | "depositing">("idle");

  const selectedToken = TOKENS[tokenIdx];

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    setAmount("");
  }, [tab, tokenIdx]);

  if (!open) return null;

  const addHistory = (type: HistoryEntry["type"], symbol: TokenSymbol, amt: string) => {
    setHistory(h => [
      { id: `${Date.now()}-${symbol}`, type, symbol, amount: amt, timestamp: Date.now() },
      ...h.slice(0, 49),
    ]);
  };

  const handleMintAll = async () => {
    if (!address) {
      notification.error("Connect your wallet first");
      return;
    }
    setIsMintingAll(true);
    let minted = 0;
    for (const token of TOKENS) {
      try {
        const tx = await writers[token.symbol].writeContractAsync({
          functionName: "mint",
          args: [address, parseUnits(token.faucetAmount, token.decimals)],
        });
        if (tx) {
          minted++;
          addHistory("MINT", token.symbol, token.faucetAmount);
        }
      } catch (error) {
        console.error(`⚡️ ~ file: WalletModal.tsx:handleMintAll ~ ${token.symbol} ~ error`, error);
      }
    }
    setIsMintingAll(false);
    if (minted > 0) {
      notification.success(`Minted ${minted}/${TOKENS.length} test tokens`);
    }
  };

  const handleDeposit = async () => {
    if (!address || !amount) return;
    const tokenAddress = getContractAddress(selectedToken.contractName);
    if (!INSTRUCTION_SENDER_ADDRESS || !tokenAddress) {
      notification.error("NyxSwapInstructionSender isn't deployed yet — did you forget to run `yarn deploy`?");
      return;
    }

    const rawAmount = parseUnits(amount, selectedToken.decimals);
    const currentAllowance = allowances[selectedToken.symbol] ?? 0n;

    try {
      if (currentAllowance < rawAmount) {
        setDepositStep("approving");
        const approveTx = await writers[selectedToken.symbol].writeContractAsync({
          functionName: "approve",
          args: [INSTRUCTION_SENDER_ADDRESS, rawAmount],
        });
        if (!approveTx) return;
      }

      setDepositStep("depositing");
      const depositTx = await instructionSenderWrite.writeContractAsync({
        functionName: "deposit",
        args: [tokenAddress, rawAmount],
      });
      if (depositTx) {
        addHistory("DEPOSIT", selectedToken.symbol, amount);
        setAmount("");
      }
    } catch (error) {
      console.error(`⚡️ ~ file: WalletModal.tsx:handleDeposit ~ ${selectedToken.symbol} ~ error`, error);
    } finally {
      setDepositStep("idle");
    }
  };

  const handleWithdraw = () => {
    notification.info("Withdrawals aren't wired up yet — coming soon");
  };

  const setMaxDeposit = () => {
    const balance = balances[selectedToken.symbol];
    if (balance !== undefined) {
      setAmount(parseFloat(formatUnits(balance, selectedToken.decimals)).toFixed(4));
    }
  };

  return (
    <div className="nyx-wallet-modal wallet-backdrop" onClick={onClose}>
      <div className="wallet-modal" onClick={e => e.stopPropagation()}>
        <div className="wallet-hdr">
          <div className="wallet-hdr-left">
            <div className="wallet-hdr-eyebrow">Flare · Testnet Wallet</div>
            <div className="wallet-hdr-addr">{address ? formatAddress(address) : "Not connected"}</div>
          </div>
          <div className="wallet-hdr-right">
            <span className="wallet-testnet-badge">Testnet</span>
            <button className="panel-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <aside className="wallet-side">
          <h3>Balances</h3>
          {TOKENS.map(t => (
            <div key={t.symbol} className="bal-row">
              <span className="symbol">{t.symbol}</span>
              <span className="amt">{formatAmount(balances[t.symbol], t.decimals)}</span>
            </div>
          ))}
          <div style={{ marginTop: "auto", paddingTop: 12 }}>
            <div
              style={{
                fontSize: 9,
                textTransform: "uppercase" as const,
                letterSpacing: "0.14em",
                color: "var(--w-fg-mute)",
                marginBottom: 4,
              }}
            >
              Network
            </div>
            <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
              <span className="dot" />
              <span>{targetNetwork.name.toUpperCase()}</span>
            </div>
          </div>
        </aside>

        <main className="wallet-main">
          <div className="wallet-tabs">
            {(["FAUCET", "DEPOSIT", "WITHDRAW", "HISTORY"] as Tab[]).map(t => (
              <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                <span>{t}</span>
                {t === "FAUCET" && <span className="sub">testnet only</span>}
                {t === "DEPOSIT" && <span className="sub">on-chain → tee</span>}
                {t === "WITHDRAW" && <span className="sub">tee → on-chain</span>}
              </button>
            ))}
          </div>

          <div className="wallet-content">
            {tab === "FAUCET" && (
              <>
                <div className="wallet-note">Mint test tokens directly to your wallet. No real value.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {TOKENS.map(t => (
                    <div
                      key={t.symbol}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: "var(--w-fg-dim)",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--w-fg)" }}>{t.symbol}</span>
                      <span>→ {t.faucetAmount} tokens</span>
                    </div>
                  ))}
                </div>
                <button className="wallet-submit" onClick={handleMintAll} disabled={isMintingAll || !address}>
                  {isMintingAll ? "Minting..." : "Mint all test tokens"}
                </button>
              </>
            )}

            {tab === "DEPOSIT" && (
              <>
                <div className="wallet-note">Deposit tokens from your wallet into the TEE exchange.</div>
                <div className="wallet-seg">
                  {TOKENS.map((t, i) => (
                    <button key={t.symbol} className={tokenIdx === i ? "active" : ""} onClick={() => setTokenIdx(i)}>
                      {t.symbol}
                    </button>
                  ))}
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--w-fg-dim)" }}
                >
                  <span style={{ textTransform: "uppercase" as const, letterSpacing: "0.12em" }}>Wallet balance</span>
                  <span style={{ color: "var(--w-fg)", fontWeight: 500 }}>
                    {formatAmount(balances[selectedToken.symbol], selectedToken.decimals)} {selectedToken.symbol}
                  </span>
                </div>
                <div className="wallet-field">
                  <label>Amount ({selectedToken.symbol})</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.0000"
                      style={{ flex: 1 }}
                    />
                    <button className="hdr-btn" onClick={setMaxDeposit}>
                      Max
                    </button>
                  </div>
                </div>
                <div className="wallet-preview">
                  <span className="label">Depositing</span>
                  <span className="value">
                    {amount || "0"} {selectedToken.symbol}
                  </span>
                </div>
                <button
                  className="wallet-submit"
                  onClick={handleDeposit}
                  disabled={!amount || !address || depositStep !== "idle"}
                >
                  {depositStep === "approving"
                    ? `Approving ${selectedToken.symbol}...`
                    : depositStep === "depositing"
                      ? "Depositing..."
                      : `Deposit ${selectedToken.symbol}`}
                </button>
              </>
            )}

            {tab === "WITHDRAW" && (
              <>
                <div className="wallet-note">Withdraw tokens from the TEE back to your wallet.</div>
                <div className="wallet-seg">
                  {TOKENS.map((t, i) => (
                    <button key={t.symbol} className={tokenIdx === i ? "active" : ""} onClick={() => setTokenIdx(i)}>
                      {t.symbol}
                    </button>
                  ))}
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--w-fg-dim)" }}
                >
                  <span style={{ textTransform: "uppercase" as const, letterSpacing: "0.12em" }}>Tee available</span>
                  <span style={{ color: "var(--w-fg)", fontWeight: 500 }}>— {selectedToken.symbol}</span>
                </div>
                <div className="wallet-field">
                  <label>Amount ({selectedToken.symbol})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.0000"
                  />
                </div>
                <div className="wallet-field">
                  <label>Destination (connected wallet)</label>
                  <input type="text" value={address ?? ""} readOnly disabled />
                </div>
                <button className="wallet-submit warn" onClick={handleWithdraw} disabled={!amount || !address}>
                  {`Withdraw ${selectedToken.symbol}`}
                </button>
              </>
            )}

            {tab === "HISTORY" && (
              <>
                {history.length === 0 ? (
                  <div className="empty-hint">No history yet</div>
                ) : (
                  history.map(h => (
                    <div key={h.id} className="wallet-history-row">
                      <span className="op">
                        {h.type} {h.amount} {h.symbol}
                      </span>
                      <span className="time">{new Date(h.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
