import type { CSSProperties } from "react";

// CoinGecko's coin image CDN - same source protocol icons already use a
// different CDN for (icons.llamao.fi). Each URL below was verified live
// against api.coingecko.com/api/v3/coins/{id} before hardcoding, so this
// isn't a guessed path. Assets without an entry (LP tokens, anything
// exotic) fall back to a generated mono-letter badge. Shared between the
// filter dialog's asset picker, the vault table's row icon, and the vault
// masthead so a given symbol always renders the same way everywhere.
const COINGECKO_ICONS: Partial<Record<string, string>> = {
  ETH: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
  USDC: "https://coin-images.coingecko.com/coins/images/6319/large/USDC.png",
  USDT: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png",
  DAI: "https://coin-images.coingecko.com/coins/images/9956/large/Badge_Dai.png",
  WETH: "https://coin-images.coingecko.com/coins/images/2518/large/weth.png",
  WBTC: "https://coin-images.coingecko.com/coins/images/7598/large/WBTCLOGO.png",
  STETH: "https://coin-images.coingecko.com/coins/images/13442/large/steth_logo.png",
};

export type IconSize = "xs" | "sm" | "md" | "lg";

const DIM: Record<IconSize, { className: string; px: number }> = {
  xs: { className: "h-4 w-4", px: 16 },
  sm: { className: "h-5 w-5", px: 20 },
  md: { className: "h-6 w-6", px: 24 },
  lg: { className: "h-9 w-9", px: 36 },
};

interface TokenIconProps {
  symbol: string;
  size?: IconSize;
  className?: string;
  style?: CSSProperties;
  /** Overrides the hardcoded lookup - for tokens with a known logo not in COINGECKO_ICONS (e.g. the faucet's test token list). */
  logoURI?: string;
}

export function TokenIcon({ symbol, size = "md", className = "", style, logoURI }: TokenIconProps) {
  const key = symbol.trim().toUpperCase().replace(/[^A-Z]/g, "");
  const iconUrl = logoURI || COINGECKO_ICONS[key] || (key.includes("STETH") ? COINGECKO_ICONS.STETH : undefined);
  const { className: dim, px } = DIM[size];

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        style={style}
        className={`${dim} shrink-0 rounded-full border border-hairline ${className}`}
      />
    );
  }

  const letter = symbol.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      style={style}
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 font-mono text-[10px] text-violet-bright ${className}`}
    >
      {letter}
    </span>
  );
}

// CoinGecko's asset_platforms endpoint has dedicated chain logos (distinct
// from any single coin's icon) - each URL verified live before hardcoding,
// same as COINGECKO_ICONS above. Chains without an entry fall back to a
// generated mono-letter badge.
const CHAIN_ICONS: Partial<Record<string, string>> = {
  Ethereum: "https://coin-images.coingecko.com/asset_platforms/images/279/large/ethereum.png",
  Base: "https://coin-images.coingecko.com/asset_platforms/images/131/large/base.png",
  "Base Sepolia": "https://coin-images.coingecko.com/asset_platforms/images/131/large/base.png",
};

export function ChainIcon({ chain, size = "xs" }: { chain: string; size?: IconSize }) {
  const url = CHAIN_ICONS[chain];
  const { className: dim, px } = DIM[size];
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        className={`${dim} shrink-0 rounded-full border border-hairline`}
      />
    );
  }
  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 font-mono text-[8px] text-violet-bright`}
    >
      {chain.charAt(0).toUpperCase()}
    </span>
  );
}

const MAX_STACKED_ICONS = 4;

// Overlapping cluster for multi-asset (LP) vaults - a single-asset vault
// just passes a one-item array so callers don't need to branch on count.
// Caps at 4 icons; anything beyond that collapses into a "+N" badge rather
// than growing the row unbounded once a vault has a longer underlying list.
export function TokenIconStack({
  symbols,
  size = "md",
  logoURIs,
}: {
  symbols: string[];
  size?: IconSize;
  /** Per-symbol icon overrides, matched by index - see TokenIcon's own logoURI prop. */
  logoURIs?: (string | undefined)[];
}) {
  const shown = symbols.slice(0, MAX_STACKED_ICONS);
  const overflow = symbols.length - shown.length;
  const { className: dim } = DIM[size];

  return (
    <div className="isolate flex shrink-0 items-center">
      {shown.map((symbol, i) => (
        <TokenIcon
          key={symbol}
          symbol={symbol}
          logoURI={logoURIs?.[i]}
          size={size}
          className={i > 0 ? "-ml-2 bg-panel" : ""}
          style={{ zIndex: shown.length - i }}
        />
      ))}
      {overflow > 0 && (
        <span
          className={`${dim} -ml-2 flex shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 font-mono text-[9px] text-muted`}
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
