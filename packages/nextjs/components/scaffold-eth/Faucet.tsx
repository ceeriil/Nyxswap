"use client";

import { useState } from "react";
import { AddressInput } from "@scaffold-ui/components";
import { Address as AddressType, formatUnits, parseUnits } from "viem";
import { flareTestnet } from "viem/chains";
import { useAccount } from "wagmi";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { Button } from "~~/components/landing/Button";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const FLR_DECIMALS = 18;

/**
 * Faucet modal which mints FLR test tokens to any address on Coston2.
 */
export const Faucet = () => {
  const [inputAddress, setInputAddress] = useState<AddressType>();
  const [sendValue, setSendValue] = useState("");
  const { address, chain: ConnectedChain } = useAccount();

  const { data: balance } = useScaffoldReadContract({
    contractName: "FlrTestToken",
    functionName: "balanceOf",
    args: [address],
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "FlrTestToken" });

  const mintFlr = async () => {
    if (!inputAddress || !sendValue) return;
    try {
      await writeContractAsync({
        functionName: "mint",
        args: [inputAddress, parseUnits(sendValue as `${number}`, FLR_DECIMALS)],
      });
      setInputAddress(undefined);
      setSendValue("");
    } catch (error) {
      console.error("⚡️ ~ file: Faucet.tsx:mintFlr ~ error", error);
    }
  };

  // Render only on Coston2
  if (ConnectedChain?.id !== flareTestnet.id) {
    return null;
  }

  return (
    <div>
      <label htmlFor="faucet-modal" className="btn btn-primary btn-sm font-normal gap-1">
        <BanknotesIcon className="h-4 w-4" />
        <span>Faucet</span>
      </label>
      <input type="checkbox" id="faucet-modal" className="modal-toggle" />
      <label htmlFor="faucet-modal" className="modal cursor-pointer">
        <label className="modal-box relative">
          {/* dummy input to capture event onclick on modal box */}
          <input className="h-0 w-0 absolute top-0 left-0" />
          <h3 className="text-xl font-bold mb-3">FLR Test Token Faucet</h3>
          <label htmlFor="faucet-modal" className="btn btn-ghost btn-sm absolute right-3 top-3">
            ✕
          </label>
          <div className="space-y-3">
            <div className="flex space-x-4">
              <div>
                <span className="text-sm font-bold">Your FLR balance:</span>{" "}
                <span>{balance !== undefined ? formatUnits(balance, FLR_DECIMALS) : "—"}</span>
              </div>
            </div>
            <div className="flex flex-col space-y-3">
              <AddressInput
                placeholder="Destination Address"
                value={inputAddress ?? ""}
                onChange={value => setInputAddress(value as AddressType)}
              />
              <input
                type="number"
                min="0"
                placeholder="Amount of FLR to mint"
                className="input input-bordered w-full"
                value={sendValue}
                onChange={e => setSendValue(e.target.value)}
              />
              <Button
                as="button"
                onClick={mintFlr}
                disabled={isMining || !inputAddress || !sendValue}
                silver
                className="w-full justify-center font-medium"
              >
                {isMining && <span className="loading loading-spinner loading-xs" />}
                <span>Mint</span>
              </Button>
            </div>
          </div>
        </label>
      </label>
    </div>
  );
};
