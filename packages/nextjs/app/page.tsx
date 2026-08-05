import type { NextPage } from "next";
import { CursorTrailProvider } from "~~/components/landing/CursorTrail";
import { Footer } from "~~/components/landing/Footer";
import { LandingBackground } from "~~/components/landing/LandingBackground";
import { LandingHeader } from "~~/components/landing/LandingHeader";
import { Compliance } from "~~/components/landing/sections/Compliance";
import { Faq } from "~~/components/landing/sections/Faq";
import { FeaturesGrid } from "~~/components/landing/sections/FeaturesGrid";
import { FinalCta } from "~~/components/landing/sections/FinalCta";
import { Hero } from "~~/components/landing/sections/Hero";
import { HowItWorks } from "~~/components/landing/sections/HowItWorks";
import { Problem } from "~~/components/landing/sections/Problem";
import { SecurityTrust } from "~~/components/landing/sections/SecurityTrust";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "NyxSwap — Trade Size Without Showing Your Hand",
  description:
    "NyxSwap matches large trades inside a confidential compute enclave on Flare — no visible order book, no mempool exposure, no front-running.",
});

const LandingPage: NextPage = () => {
  return (
    <CursorTrailProvider>
      <div className="relative min-h-screen bg-landing-bg">
        <LandingBackground />
        <div className="relative z-10">
          <LandingHeader />
          <main>
            <Hero />
            <Problem />
            <HowItWorks />
            <FeaturesGrid />
            <Compliance />
            <SecurityTrust />
            <Faq />
            <FinalCta />
          </main>
          <Footer />
        </div>
      </div>
    </CursorTrailProvider>
  );
};

export default LandingPage;
