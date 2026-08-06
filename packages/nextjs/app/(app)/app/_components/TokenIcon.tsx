import Image from "next/image";
import type { TokenSymbol } from "../_lib/tokens";

const SIZES = {
  sm: { badgePx: 20, glyphPx: 14, badgeClass: "h-5 w-5", glyphClass: "h-3.5 w-3.5" },
  md: { badgePx: 40, glyphPx: 24, badgeClass: "h-10 w-10", glyphClass: "h-6 w-6" },
} as const;

// Official logos, downloaded from CoinGecko (see public/icons/tokens).
const LOGO_SRC: Record<TokenSymbol, string> = {
  FLR: "/icons/tokens/flr.png",
  FXRP: "/icons/tokens/fxrp.png",
  USDC: "/icons/tokens/usdc.png",
};

// FLR and USDC ship as filled circular marks; FXRP is a bare glyph on a
// transparent background, so it needs a badge behind it to read as a coin.
const NEEDS_BADGE_BG: Partial<Record<TokenSymbol, true>> = { FXRP: true };

type Props = {
  symbol: TokenSymbol;
  /** Tailwind bg/text classes for the badge background, e.g. Token.avatarClassName. */
  colorClassName: string;
  size?: keyof typeof SIZES;
};

export const TokenIcon = ({ symbol, colorClassName, size = "md" }: Props) => {
  const s = SIZES[size];
  const withBadge = NEEDS_BADGE_BG[symbol];

  return (
    <span
      className={`inline-flex ${s.badgeClass} shrink-0 items-center justify-center overflow-hidden rounded-full ${withBadge ? colorClassName : ""}`}
    >
      <Image
        src={LOGO_SRC[symbol]}
        alt={`${symbol} logo`}
        width={withBadge ? s.glyphPx : s.badgePx}
        height={withBadge ? s.glyphPx : s.badgePx}
        className={withBadge ? s.glyphClass : `${s.badgeClass} object-cover`}
      />
    </span>
  );
};
