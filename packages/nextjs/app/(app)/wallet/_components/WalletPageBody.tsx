"use client";

import { useAccount } from "wagmi";
import { TokenListCard } from "./TokenListCard";
import { VaultCard } from "./VaultCard";
import { WalletOverviewCard } from "./WalletOverviewCard";
import { WalletNotConnected } from "~~/components/Wallet/WalletNotConnected";

export const WalletPageBody = () => {
  const { address } = useAccount();

  if (!address) {
    return <WalletNotConnected message="Connect a wallet to see your balance and deposit into the vault." />;
  }

  return (
    <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
      <div className="flex flex-col gap-6">
        <WalletOverviewCard />
        <TokenListCard />
      </div>
      <VaultCard />
    </div>
  );
};
