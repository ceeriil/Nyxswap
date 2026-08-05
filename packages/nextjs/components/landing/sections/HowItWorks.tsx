import { InfoCard } from "~~/components/landing/InfoCard";

const STEPS = [
  {
    eyebrow: "01",
    title: "Submit",
    description:
      "Your order goes straight into the enclave. It never touches the public chain and never sits in a mempool for anyone to read.",
  },
  {
    eyebrow: "02",
    title: "Match",
    description:
      "Matching happens inside the TEE, batched, not continuous. There's no live order book to watch — not for other traders, not for us.",
  },
  {
    eyebrow: "03",
    title: "Settle",
    description:
      "Funds move on-chain only once the match is final. The trade becomes visible after it's already happened — too late to react to.",
  },
];

export const HowItWorks = () => {
  return (
    <section id="how-it-works" className="w-full px-4 lg:px-12 py-20 md:py-28">
      <h2 className="PageTitle mb-2">Nothing to see until it&apos;s already done</h2>
      <p className="LandingParagraph mb-12 max-w-xl">How an order moves through NyxSwap, start to finish.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STEPS.map((step, i) => (
          <InfoCard
            key={step.title}
            eyebrow={step.eyebrow}
            title={step.title}
            description={step.description}
            backgroundSeed={i}
          />
        ))}
      </div>
    </section>
  );
};
