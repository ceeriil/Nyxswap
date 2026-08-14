// ─────────────────────────────────────────────────────────────
// Formatters — pure, no domain logic. App-shared.
// Most signal `raw` values arrive pre-formatted as strings; these cover
// the numeric fields (market data, deltas, chart ticks).
// ─────────────────────────────────────────────────────────────

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 2,
});

// Intl's own compact notation only ever gives locale-cased suffixes
// ("$3.66K") - lowercase k/m/b reads as data rather than a currency-formatter
// default, so this is hand-rolled instead of pulling in a formatting library
// for one function.
export const fmtUsd = (v: number) => {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const [div, suffix] = abs >= 1e9 ? [1e9, "b"] : abs >= 1e6 ? [1e6, "m"] : abs >= 1e3 ? [1e3, "k"] : [1, ""];
  return `${sign}$${(abs / div).toFixed(2)}${suffix}`;
};
export const fmtUsdFull = (v: number) => usdFull.format(v);
export const fmtScore = (v: number) => String(Math.round(v));

export const fmtSigned = (v: number, suffix = "") => {
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(v).toFixed(1)}${suffix}`;
};

export const fmtPct = (v: number) => `${(v * 100).toFixed(0)}%`;

// Fee-precision percent: whole numbers stay bare, fractional ones keep 2dp
// (0% not 0.00%, but 0.1% not 0%). NaN marks "not yet derivable" (no
// on-chain fee getter exists) - render "-" rather than a fabricated %.
export const fmtFeePct = (v: number) => {
  if (!Number.isFinite(v)) return "-";
  const pct = v * 100;
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2)}%`;
};

export const fmtAddress = (a: string, lead = 6, trail = 4) =>
  a.length <= lead + trail ? a : `${a.slice(0, lead)}...${a.slice(-trail)}`;

export const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const fmtDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export const trendArrow = (t: "up" | "down" | "flat") =>
  t === "up" ? "\u2191" : t === "down" ? "\u2193" : "\u2192";