"use client";

import { parseUnits } from "viem";
import { flareTestnet } from "viem/chains";
import { useAccount } from "wagmi";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

// Amount of FLR test token minted per faucet click
const FAUCET_AMOUNT = "10000";
const FLR_DECIMALS = 18;

/**
 * FaucetButton which mints FLR test tokens to the connected wallet on Coston2.
 */
export const FaucetButton = () => {
  const { address, chain: ConnectedChain } = useAccount();

  const { data: balance } = useScaffoldReadContract({
    contractName: "FlrTestToken",
    functionName: "balanceOf",
    args: [address],
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "FlrTestToken" });

  const mintFlr = async () => {
    if (!address) return;
    try {
      await writeContractAsync({
        functionName: "mint",
        args: [address, parseUnits(FAUCET_AMOUNT, FLR_DECIMALS)],
      });
    } catch (error) {
      console.error("⚡️ ~ file: FaucetButton.tsx:mintFlr ~ error", error);
    }
  };

  // Render only on Coston2
  if (ConnectedChain?.id !== flareTestnet.id) {
    return null;
  }

  const isBalanceZero = balance === 0n;

  return (
    <div
      className={
        !isBalanceZero
          ? "ml-1"
          : "ml-1 tooltip tooltip-bottom tooltip-primary tooltip-open font-bold before:left-auto before:right-0 before:transform-none before:translate-none before:content-[attr(data-tip)]"
      }
      data-tip="Grab funds from faucet"
    >
      <button className="btn btn-secondary btn-sm px-2" onClick={mintFlr} disabled={isMining}>
        {!isMining ? (
          <BanknotesIcon className="h-4 w-4" />
        ) : (
          <span className="loading loading-spinner loading-xs"></span>
        )}
      </button>
    </div>
  );
};
