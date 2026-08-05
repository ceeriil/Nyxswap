import Link from "next/link";
import { Button } from "~~/components/landing/Button";
import { CursorTrailProvider } from "~~/components/landing/CursorTrail";
import { LandingBackground } from "~~/components/landing/LandingBackground";
import { LineSweepText } from "~~/components/landing/LineSweepText";

export default function NotFound() {
  return (
    <CursorTrailProvider>
      <div className="relative min-h-screen bg-landing-bg flex flex-col">
        <LandingBackground />
        <div className="relative z-10 flex flex-col flex-1">
          <div className="px-4 lg:px-12 pt-8">
            <Link href="/" className="font-nord text-lg tracking-wide text-white">
              NYXSWAP
            </Link>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
            <span className="font-nord text-landing-muted text-xs md:text-sm tracking-[0.2em] uppercase mb-6">
              Error 404
            </span>

            <h1 className="HeroHeader mb-6">
              <LineSweepText duration={6}>Nothing to see here either.</LineSweepText>
            </h1>

            <p className="LandingParagraph max-w-md mb-10">
              This page doesn&apos;t exist — no leak, no trace, just a dead link.
            </p>

            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              <Button glint as="link" href="/" speed={3}>
                Back to home
              </Button>
              <Button as="link" href="/docs">
                Read the Docs
              </Button>
            </div>
          </div>
        </div>
      </div>
    </CursorTrailProvider>
  );
}
