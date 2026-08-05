/** Lit-grey rounded-rect textures used behind glint-card content (see .glint-card-content). */
export const CARD_BACKGROUNDS = [
  "/images/landing/card-bg-1.webp",
  "/images/landing/card-bg-2.webp",
  "/images/landing/card-bg-3.webp",
] as const;

export const BUTTON_STYLES = {
  base: "LandingButtonText font-thin px-8 py-3 sm:px-6.5 sm:py-2.5 rounded-full inline-flex items-center justify-center transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-landing-bg text-landing-fg border border-landing-button-border bg-landing-button-bg hover:bg-landing-button-hover cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  glintOverrides:
    "relative z-20 bg-transparent border-0 w-full h-full !border-transparent hover:bg-landing-button-hover focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer disabled:cursor-not-allowed",
} as const;

export const SHOWCASE_STYLES = {
  border: "border-2 border-gray-400/30",
  borderRadius: "rounded-2xl",
} as const;

/**
 * Z-index layering for fixed/portalled landing-page overlays. BACKGROUND
 * must stay >= 0: a negative z-index would sink it behind the page's own
 * opaque background-color instead of just behind the (relative z-10)
 * content wrapper.
 */
export const OVERLAY_Z_INDEX = {
  BACKGROUND: 0,
  CURSOR_TRAIL: 500,
} as const;

export const THREE_CONFIG = {
  LIGHT: {
    BOUNDS: { X: [-1.5, 1.5] as const, Y: [-1.5, 1.5] as const },
    SENSITIVITY: 1.2,
    DISTANCE_FROM_CENTER: 1.0,
    BASE_Z: -6,
    KEY_INTENSITY: 1.5,
    FILL_INTENSITY: 0.3,
    RIM_INTENSITY: 0.8,
    AMBIENT_INTENSITY: 0.1,
    POINT_LIGHTS: [
      { position: [3, -1.2, -6] as [number, number, number], intensity: 5, color: 0xffffff },
      { position: [-3, 0.5, -6] as [number, number, number], intensity: 5, color: 0xffffff },
    ],
    BLOOM: { INTENSITY: 2, LUMINANCE_THRESHOLD: 0.1, LUMINANCE_SMOOTHING: 0.9 },
    NOISE: { OPACITY: 0.008 },
  },
  CAMERA: {
    BREAKPOINTS: {
      XL: {
        position: [0, 0, -4.5] as [number, number, number],
        fov: 60,
        target: [0, 0, -7.4] as [number, number, number],
      },
      XXL: {
        position: [0, 0, -4.5] as [number, number, number],
        fov: 55,
        target: [0, 0, -7.4] as [number, number, number],
      },
    },
    XXL_BREAKPOINT_PX: 1536,
  },
  SHADOW: {
    MAP_SIZE: 512,
    CAMERA_BOUNDS: { LEFT: -2, RIGHT: 2, TOP: 2, BOTTOM: -2, NEAR: 0.1, FAR: 15 },
    BIAS: -0.0008,
    RADIUS: 2,
  },
} as const;
