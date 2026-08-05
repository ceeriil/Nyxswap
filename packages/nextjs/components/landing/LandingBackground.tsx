"use client";

import { useEffect, useState } from "react";
import { useMediaQuery } from "usehooks-ts";
import { BackgroundLayer } from "~~/components/landing/BackgroundLayer";
import { ParallaxLogoBackground } from "~~/components/landing/ParallaxLogoBackground";

/**
 * Desktop gets the atmospheric Three.js scene (bloom + lighting — this is
 * what gives temp's About page its lit gradient look, not a flat image).
 * Mobile falls back to the flat background.webp layer to avoid the WebGL
 * cost on battery-constrained devices.
 *
 * Renders nothing until after mount: `useMediaQuery` has no `window` to read
 * on the server, so picking a background during SSR would hydrate to one
 * tree and immediately swap to another on the client — a mismatch that
 * makes React throw away and re-render the whole subtree instead of
 * settling on the right background.
 */
export const LandingBackground = () => {
  const [mounted, setMounted] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return isDesktop ? <ParallaxLogoBackground /> : <BackgroundLayer />;
};
