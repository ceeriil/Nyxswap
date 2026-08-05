import { Button } from "~~/components/landing/Button";
import { LineSweepText } from "~~/components/landing/LineSweepText";
import { ScrollCue } from "~~/components/landing/ScrollCue";

export const Hero = () => {
  return (
    <section className="relative w-full px-4 lg:px-12 pt-20 pb-24 md:pt-28 md:pb-32 min-h-[600px] md:min-h-[780px] flex flex-col items-start overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-[url('/hero.png')] bg-cover bg-right bg-no-repeat opacity-70"
        aria-hidden="true"
      />
      <span className="font-nord text-landing-muted text-xs md:text-sm tracking-[0.2em] uppercase mb-6">
        Confidential order flow on Flare
      </span>

      <h1 className="HeroHeader max-w-4xl mb-6">
        <LineSweepText duration={8}>Trade in size. Show nothing.</LineSweepText>
      </h1>

      <p className="LandingParagraph max-w-xl mb-10">
        NyxSwap matches orders inside a trusted execution environment — not on a public book, not in a mempool. The
        market finds out after the trade is done, not before.
      </p>

      <div className="flex flex-wrap gap-4 md:gap-6">
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
