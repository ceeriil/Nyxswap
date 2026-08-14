"use client";

// No USD price-feed API exists in this app yet - every lookup resolves to
// undefined ("price unknown") rather than fabricating a number. The wallet
// page and FaucetModal already render that as "-"/omit the USD line.
export function useTokenPrices(): { prices: Record<string, number | null>; isLoading: boolean } {
  return { prices: {}, isLoading: false };
}
