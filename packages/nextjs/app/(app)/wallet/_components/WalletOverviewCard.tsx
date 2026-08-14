"use client";

import { useAccount } from "wagmi";
import { Address, Balance } from "@scaffold-ui/components";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useFaucetModal } from "~~/components/Wallet/FaucetModalProvider";
import { Button } from "~~/components/landing/Button";

export const WalletOverviewCard = () => {
  const { address } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { openFaucet } = useFaucetModal();

  return (
    <div className="card shadow-xl w-full bg-base-100">
      <div className="card-body gap-5">
        <h1 className="card-title">Wallet</h1>

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-base-content/50">Address</span>
          <Address address={address} chain={targetNetwork} size="lg" />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-base-content/50">Balance</span>
          <div className="text-2xl font-semibold">
            <Balance address={address} chain={targetNetwork} />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-base-content/60">
          <span className="h-2 w-2 rounded-full bg-success" />
          {targetNetwork.name}
        </div>

        <div className="divider my-0" />

        <div className="flex flex-col gap-2">
          <p className="text-sm text-base-content/60">
            Deposit into the vault on the right to fund your trading balance - swaps execute against what's
            deposited, not your wallet balance.
          </p>
          <Button as="button" onClick={openFaucet} className="w-fit px-6! py-2! text-sm">
            Get test tokens
          </Button>
        </div>
      </div>
    </div>
  );
};
