import type { NextPage } from "next";
import { Button } from "~~/components/landing/Button";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Vault",
  description: "Deposit and withdraw collateral for NyxSwap.",
});

const Vault: NextPage = () => {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="card bg-base-100 shadow-xl w-full max-w-md">
        <div className="card-body">
          <h1 className="card-title">Vault</h1>
          <p className="text-sm text-base-content/70">
            Deposit collateral before trading, and withdraw it once you&apos;re done. Escrow balances will show here.
          </p>
          <div className="card-actions justify-end mt-4">
            <Button as="button" disabled className="rounded-lg">
              Deposit
            </Button>
            <Button as="button" disabled className="rounded-lg bg-transparent hover:bg-landing-button-bg">
              Withdraw
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vault;
