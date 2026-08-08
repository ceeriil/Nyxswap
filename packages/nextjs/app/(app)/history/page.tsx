import { HistoryTabs } from "./_components/HistoryTabs";
import type { NextPage } from "next";
import { BackgroundLayer } from "~~/components/landing/BackgroundLayer";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "History",
  description: "Your swaps and live pool activity on NyxSwap.",
});

const History: NextPage = () => {
  return (
    <div className="relative flex flex-1 justify-center px-4 py-10 lg:py-16">
      <BackgroundLayer />
      <div className="relative z-10 w-full max-w-6xl">
        <HistoryTabs />
      </div>
    </div>
  );
};

export default History;
