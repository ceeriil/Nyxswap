"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "~~/components/landing/Button";
import { NavLink } from "~~/components/landing/NavLink";

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
  { label: "Docs", href: "/docs" },
];

/** Header for the marketing/landing pages — distinct from the connected-app Header. */
export const LandingHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-4 z-40 w-full px-4 lg:px-12">
      <div className="flex items-center justify-between h-14 px-3 lg:px-4 max-w-4xl mx-auto rounded-full bg-white/5 border border-[#202020] backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 font-nord text-base tracking-wide text-white">
          <Image src="/logo-new.png" alt="NyxSwap logo" width={36} height={36} className="rounded-full" />
          NYXSWAP
        </Link>

        <nav className="hidden lg:flex items-center gap-6 xl:gap-8" aria-label="Main navigation">
          {NAV_LINKS.map(link => (
            <NavLink key={link.label} href={link.href} label={link.label} />
          ))}
          <Button glint as="link" href="/app" speed={3}>
            Launch App
          </Button>
        </nav>

        <button
          onClick={() => setIsMenuOpen(open => !open)}
          className="lg:hidden text-white hover:text-landing-muted transition-colors"
          aria-expanded={isMenuOpen}
          aria-controls="landing-mobile-menu"
          aria-label="Toggle navigation menu"
        >
          <div className="h-5 w-6 flex flex-col justify-center items-end gap-1.5">
            <div className={`h-0.5 bg-current transition-all ${isMenuOpen ? "w-6 rotate-45 translate-y-2" : "w-6"}`} />
            <div className={`h-0.5 bg-current transition-all ${isMenuOpen ? "opacity-0" : "w-4"}`} />
            <div
              className={`h-0.5 bg-current transition-all ${isMenuOpen ? "w-6 -rotate-45 -translate-y-2" : "w-6"}`}
            />
          </div>
        </button>
      </div>

      {isMenuOpen && (
        <nav
          id="landing-mobile-menu"
          className="lg:hidden mt-2 px-4 py-6 rounded-3xl bg-white/5 border border-[#202020] backdrop-blur-md flex flex-col items-start gap-4"
          aria-label="Mobile navigation"
        >
          {NAV_LINKS.map(link => (
            <NavLink key={link.label} href={link.href} label={link.label} onClick={() => setIsMenuOpen(false)} />
          ))}
          <Button glint as="link" href="/app" speed={3} onClick={() => setIsMenuOpen(false)}>
            Launch App
          </Button>
        </nav>
      )}
    </header>
  );
};
