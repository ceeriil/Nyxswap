import { VaultCard } from "./_components/VaultCard";
import type { NextPage } from "next";
import { BackgroundLayer } from "~~/components/landing/BackgroundLayer";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Vault",
  description: "Add or remove liquidity on NyxSwap's confidential-execution AMM.",
});

const Vault: NextPage = () => {
  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-16">
      <BackgroundLayer />
      <div className="relative z-10">
        <VaultCard />
      </div>
    </div>
  );
};

export default Vault;
