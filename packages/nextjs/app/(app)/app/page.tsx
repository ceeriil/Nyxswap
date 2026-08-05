import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Trade",
  description: "Submit orders into NyxSwap's confidential dark pool.",
});

const Trade: NextPage = () => {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card bg-base-100 shadow-xl w-full max-w-md">
        <div className="card-body">
          <h1 className="card-title">Trade</h1>
          <p className="text-sm text-base-content/70">
            Order form and batching status will live here. Orders are hidden while pending and only revealed after
            settlement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Trade;
