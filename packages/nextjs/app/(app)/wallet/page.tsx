import { WalletPageBody } from "./_components/WalletPageBody";
import type { NextPage } from "next";
import { BackgroundLayer } from "~~/components/landing/BackgroundLayer";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Wallet",
  description: "Your balance and vault deposits on NyxSwap, plus the testnet faucet.",
});

const Wallet: NextPage = () => {
  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-16">
      <BackgroundLayer />
      <div className="relative z-10 flex w-full justify-center">
        <WalletPageBody />
      </div>
    </div>
  );
};

export default Wallet;
