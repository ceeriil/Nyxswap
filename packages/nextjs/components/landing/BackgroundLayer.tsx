import { OVERLAY_Z_INDEX } from "~~/constants/landing";

interface BackgroundLayerProps {
  image?: string;
  mobileImage?: string;
}

/**
 * Fixed, full-bleed radial-gradient backdrop used behind public pages
 * (see styles/landing.css for the pure-black base color it sits on top of).
 */
export const BackgroundLayer = ({
  image = "/images/landing/background.webp",
  mobileImage = "/images/landing/background-mobile.png",
}: BackgroundLayerProps) => {
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: OVERLAY_Z_INDEX.BACKGROUND }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat md:hidden"
        style={{ backgroundImage: `url(${mobileImage})` }}
      />
      <div
        className="absolute inset-0 hidden md:block bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${image})` }}
      />
    </div>
  );
};
