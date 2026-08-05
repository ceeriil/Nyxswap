import { HistoryTabs } from "./_components/HistoryTabs";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "History",
  description: "Your orders and past settled batches on NyxSwap.",
});

const History: NextPage = () => {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <HistoryTabs />
    </div>
  );
};

export default History;
