import { Button } from "~~/components/landing/Button";

export const SecurityTrust = () => {
  return (
    <section className="w-full px-4 lg:px-12 py-20 md:py-28 max-w-3xl">
      <h2 className="PageTitle mb-6">Verify it yourself</h2>
      <p className="LandingParagraph mb-8">
        NyxSwap runs on Flare Confidential Compute. The matching code&apos;s hash is registered on-chain — changing it
        means a public, governable update, not a quiet server swap.
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <span className="text-landing-muted">Audit status: pending</span>
        <span className="text-landing-border">·</span>
        <a
          href="https://github.com/ceeriil/Nyxswap"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white hover:text-landing-muted underline transition-colors"
        >
          View source on GitHub
        </a>
      </div>

      <div className="mt-8">
        <Button as="link" href="/docs">
          Read the Docs
        </Button>
      </div>
    </section>
  );
};
