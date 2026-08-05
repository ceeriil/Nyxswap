"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { MdArrowForward } from "react-icons/md";
import { Button } from "~~/components/landing/Button";
import { Globe } from "~~/components/ui/globe";
import { cn } from "~~/utils/cn";

const FEATURES = [
  {
    title: "No visible book",
    description:
      "There's nothing to snipe because there's nothing to see. Orders live off-chain until they're matched, so size and direction never leak to searchers watching the mempool.",
  },
  {
    title: "Batched, not continuous",
    description:
      "Matching runs in rounds, not order-by-order — the timing signal a resting order normally leaks is gone. Every trade in a round settles at the same price, so being first buys you nothing.",
  },
  {
    title: "Attested, not “trust us”",
    description:
      "The code that matches your order has a hash registered on-chain. What runs is what got audited — no silent upgrades, no operator discretion over how your order gets filled.",
  },
  {
    title: "Provable, not just opaque",
    description:
      "Generate a proof after settlement that your trade met a compliance rule — size limit, KYC'd counterparty — without revealing the trade itself. Privacy and auditability stop being a tradeoff.",
  },
];

const LETTERS = ["A", "B", "C", "D"];

/** Interactive tabbed feature card: clickable list on the left drives the detail body on the right. */
export const FeatureShowcaseCard = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const paragraphRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!paragraphRef.current) return;
    gsap.fromTo(
      paragraphRef.current,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" },
    );
  }, [activeIndex]);

  return (
    <div className="glint-card-wrapper">
      <div className="glint-card-content grid grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col p-6 md:p-0 md:border-r md:border-landing-border">
          <div className="flex items-start justify-between px-6 pt-6">
            <Image src="/logo-new.png" alt="NyxSwap" width={96} height={96} className="rounded-full" />

            <nav className="flex flex-col gap-3">
              {FEATURES.map((feature, i) => {
                const isActive = i === activeIndex;
                return (
                  <button
                    key={feature.title}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      "flex items-center gap-2 text-left font-neue transition-colors duration-300 cursor-pointer",
                      isActive ? "text-landing-gray" : "text-landing-muted hover:text-landing-gray",
                    )}
                  >
                    <span className="w-4 h-4 shrink-0 text-xs flex items-center justify-center">
                      {isActive ? <MdArrowForward size={14} /> : LETTERS[i]}
                    </span>
                    <span className={cn("text-base capitalize md:text-[0.85rem]", isActive && "font-medium")}>
                      {feature.title}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-landing-border my-6" />

          <p ref={paragraphRef} className=" text-landing-muted px-6">
            {FEATURES[activeIndex].description}
          </p>

          <div className="mt-auto  pb-6 ml-6 self-start">
            <Button glint as="link" href="/app" speed={3}>
              <span className="flex items-center gap-2">
                Go to app
                <MdArrowForward />
              </span>
            </Button>
          </div>
        </div>

        <div className="relative hidden md:flex min-h-105 lg:min-h-120 items-center justify-center overflow-hidden">
          <Globe className="w-full max-w-105" />
        </div>
      </div>
    </div>
  );
};
