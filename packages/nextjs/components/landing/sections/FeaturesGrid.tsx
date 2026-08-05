import { FeatureShowcaseCard } from "~~/components/landing/FeatureShowcaseCard";

export const FeaturesGrid = () => {
  return (
    <section id="features" className="w-full px-4 lg:px-12 py-20 md:py-28">
      <h2 className="PageTitle mb-12">Built to leave nothing behind</h2>

      <FeatureShowcaseCard />
    </section>
  );
};
