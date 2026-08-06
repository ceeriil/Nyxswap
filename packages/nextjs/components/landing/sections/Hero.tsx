import { Button } from "~~/components/landing/Button";
import { LineSweepText } from "~~/components/landing/LineSweepText";
import { ScrollCue } from "~~/components/landing/ScrollCue";
import { VortexTwist } from "~~/components/landing/VortexTwist";

export const Hero = () => {
  return (
    <section className="relative w-full px-4 lg:px-12 pt-20 pb-24 md:pt-28 md:pb-32 min-h-[600px] md:min-h-[780px] flex flex-col items-center text-center overflow-hidden">
      <VortexTwist className="absolute inset-0 -z-10 h-full w-full " />
      <span className="font-nord text-landing-muted text-xs md:text-sm tracking-[0.2em] uppercase mb-6 mt-16">
        Confidential order flow on Flare
      </span>

      <h1 className="HeroHeader max-w-5xl mb-6 text-4xl sm:text-5xl md:text-5xl 2xl:text-5xl">
        <LineSweepText duration={8}>Trade in size. Show nothing.</LineSweepText>
      </h1>

      <p className="LandingParagraph max-w-xl mb-10">
        NyxSwap matches orders inside a trusted execution environment — not on a public book, not in a mempool. The
        market finds out after the trade is done, not before.
      </p>

      <div className="flex flex-wrap justify-center gap-4 md:gap-6">
        <Button glint as="link" href="/app" speed={3}>
          Launch App
        </Button>
        <Button as="link" href="/docs" silver>
          Read the Docs
        </Button>
      </div>

      <ScrollCue className="absolute bottom-[6rem] right-4 lg:right-12" />
    </section>
  );
};
