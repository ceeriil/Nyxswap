"use client";

import { Component, ReactNode } from "react";
import dynamic from "next/dynamic";

const ParallaxLogoScene = dynamic(() => import("~~/components/landing/three/ParallaxLogoScene"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-0 bg-landing-bg" />,
});

class ThreeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("ParallaxLogoBackground failed to render:", error);
  }

  render() {
    if (this.state.hasError) return <div className="fixed inset-0 z-0 bg-landing-bg" />;
    return this.props.children;
  }
}

interface ParallaxLogoBackgroundProps {
  /** Swap in your own .glb once available; defaults to the placeholder asset. */
  modelUrl?: string;
  bloomEnabled?: boolean;
}

/**
 * Full-viewport 3D background: a logo model that shifts as the page
 * scrolls. Mounted behind page content (see LandingBackground) — fixed,
 * z-0, sitting behind the relative z-10 content wrapper.
 *
 * Known issue under investigation: the Canvas mounts, gets a valid WebGL
 * context, and its render loop runs (confirmed via useFrame diagnostics),
 * but nothing has reliably drawn to the visible framebuffer in testing so
 * far (confirmed via direct gl.readPixels), independent of lighting,
 * materials, postprocessing, or z-index/stacking — all ruled out already.
 */
export const ParallaxLogoBackground = ({
  modelUrl = "/models/placeholder-logo.glb",
  bloomEnabled = true,
}: ParallaxLogoBackgroundProps) => {
  return (
    <div className="fixed inset-0 z-0">
      <ThreeErrorBoundary>
        <ParallaxLogoScene modelUrl={modelUrl} bloomEnabled={bloomEnabled} />
      </ThreeErrorBoundary>
    </div>
  );
};
