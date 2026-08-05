"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { PiPlusBold, PiXBold } from "react-icons/pi";

const FAQ_ITEMS = [
  {
    question: "What is NyxSwap?",
    answer:
      "A confidential matching venue for large trades, built on Flare Confidential Compute. Orders are matched inside a TEE and settle on-chain only after the match is final.",
  },
  {
    question: "How is this different from a regular DEX?",
    answer:
      "A regular DEX shows you a live order book and settles instantly — both of which leak information before your trade completes. NyxSwap shows nothing until settlement.",
  },
  {
    question: "Can an auditor or regulator still see what I traded?",
    answer:
      "Only if you choose to show them. You can generate a proof that a trade met a specific rule without revealing the trade itself.",
  },
  {
    question: "What chains does this run on?",
    answer: "Flare. Mainnet availability will be announced alongside the audit.",
  },
];

const DEFAULT_OPEN_INDEX = 0;

export const Faq = () => {
  const [openStates, setOpenStates] = useState(() => FAQ_ITEMS.map((_, i) => i === DEFAULT_OPEN_INDEX));
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    contentRefs.current.forEach((el, i) => {
      if (el) gsap.set(el, { height: openStates[i] ? "auto" : 0 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (i: number) => {
    const el = contentRefs.current[i];
    if (!el) return;

    const willOpen = !openStates[i];
    gsap.to(el, { height: willOpen ? "auto" : 0, duration: 0.4, ease: "power2.inOut" });
    setOpenStates(prev => prev.map((open, idx) => (idx === i ? willOpen : open)));
  };

  return (
    <section id="faq" className="w-full px-4 lg:px-12 py-20 md:py-28">
      <h2 className="PageTitle mb-10">Questions</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 border-t border-landing-border">
        <div className="hidden md:flex items-start justify-start p-6 ">
          <Image src="/star.png" alt="" width={200} height={200} className="w-[180px] h-[180px] object-contain" />
        </div>

        <div className="md:col-span-3 flex flex-col">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openStates[i];
            return (
              <div key={item.question} className="border-t border-landing-border first:border-t-0">
                <div className="py-6">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 text-left cursor-pointer font-nord text-white text-base md:text-lg"
                  >
                    {item.question}
                    <span className="shrink-0 text-landing-muted">
                      {isOpen ? <PiXBold size={18} /> : <PiPlusBold size={18} />}
                    </span>
                  </button>

                  <div
                    ref={el => {
                      contentRefs.current[i] = el;
                    }}
                    style={{ height: 0, overflow: "hidden" }}
                  >
                    <p className="LandingParagraph mt-4">{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
