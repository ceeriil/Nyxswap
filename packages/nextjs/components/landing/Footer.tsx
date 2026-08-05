import Image from "next/image";
import Link from "next/link";
import { DiscordIcon } from "~~/components/landing/icons/DiscordIcon";
import { GithubIcon } from "~~/components/landing/icons/GithubIcon";
import { XIcon } from "~~/components/landing/icons/XIcon";

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
  { label: "Docs", href: "/docs" },
];

// TODO: swap in real X/Discord URLs once those accounts exist.
const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com/ceeriil/Nyxswap", icon: GithubIcon },
  { label: "X / Twitter", href: "#", icon: XIcon },
  { label: "Discord", href: "#", icon: DiscordIcon },
];

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="text-white border-t border-landing-border">
      <div className="w-full px-4 lg:px-12 font-nord">
        <div className="py-16 grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-10 md:gap-8">
          <div className="max-w-sm">
            <Link href="/" className="flex items-center gap-1 text-base tracking-wide">
              <Image src="/logo-new.png" alt="NyxSwap logo" width={62} height={62} className="rounded-full" />
              NYXSWAP
            </Link>
            <p className="LandingParagraph mt-3 text-xs md:text-sm">
              Confidential order flow on Flare. Trades match inside a trusted execution environment — no visible book,
              no mempool exposure.
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <h4 className="text-landing-muted text-xs 2xl:text-sm mb-4">Menu</h4>
            <ul className="flex flex-col gap-2.5">
              {NAV_LINKS.map(link => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-white hover:text-landing-muted transition-colors duration-200 text-xs 2xl:text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h4 className="text-landing-muted text-xs 2xl:text-sm mb-4">Socials</h4>
            <ul className="flex flex-col gap-3">
              {SOCIAL_LINKS.map(link => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-white hover:text-landing-muted transition-colors duration-200"
                  >
                    <link.icon width={16} height={16} />
                    <span className="text-xs 2xl:text-sm">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="py-6 border-t border-landing-border/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <p className="text-landing-muted text-xs">© {currentYear} NyxSwap. All rights reserved.</p>
          <Link href="/legal" className="text-landing-muted hover:text-white transition-colors duration-200 text-xs">
            Legal notice
          </Link>
        </div>
      </div>
    </footer>
  );
};
