import type { NextPage } from "next";
import { Button } from "~~/components/landing/Button";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Verify",
  description: "TEE attestation, code hash, and compliance proof generation for NyxSwap.",
});

const Verify: NextPage = () => {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex flex-col gap-6 w-full max-w-2xl">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h1 className="card-title">Attestation</h1>
            <p className="text-sm text-base-content/70">
              The TEE code hash, attestation report, and a link to the on-chain measurement registry will be shown here,
              so trust in the matching engine doesn&apos;t rely on taking anyone&apos;s word for it.
            </p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Proofs</h2>
            <p className="text-sm text-base-content/70">
              Generate a compliance proof for a settled trade (e.g. &quot;under size X&quot;) without revealing the
              trade itself, and verify a proof someone else has shared with you.
            </p>
            <div className="card-actions justify-end mt-4">
              <Button as="button" disabled className="rounded-lg">
                Generate proof
              </Button>
              <Button as="button" disabled className="rounded-lg bg-transparent hover:bg-landing-button-bg">
                Verify a proof
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Verify;
