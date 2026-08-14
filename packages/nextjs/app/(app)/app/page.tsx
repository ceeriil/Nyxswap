import { SwapCard } from "./_components/SwapCard";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";
import { BackgroundLayer } from "~~/components/landing/BackgroundLayer";


export const metadata = getMetadata({
  title: "Trade",
  description:
    "Swap on NyxSwap's confidential-execution AMM — pending swaps are routed through the enclave and hidden until settlement.",
});

const Trade: NextPage = () => {
  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-16">
      < BackgroundLayer/>
      <div className="relative z-10">
        <SwapCard />
      </div>
    </div>
  );
};

export default Trade;
