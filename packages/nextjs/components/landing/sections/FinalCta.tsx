import { Button } from "~~/components/landing/Button";
import { LineSweepText } from "~~/components/landing/LineSweepText";

export const FinalCta = () => {
  return (
    <section className="w-full px-4 lg:px-12 py-24 md:py-32 flex flex-col items-center text-center">
      <h2 className="HeroHeader mb-10">
        <LineSweepText duration={6}>Trade without an audience.</LineSweepText>
      </h2>
      <Button glint as="link" href="/app" speed={3} proximityIntensity maxDistance={220}>
        Launch App
      </Button>
    </section>
  );
};
