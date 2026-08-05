import { useEffect, useState } from "react";

/**
 * Plain window scroll position, used to drive the About page's 3D parallax
 * (the logo model shifts as the user scrolls). Kept dependency-free — no
 * smooth-scroll library required for the effect to work.
 */
export const useScrollOffset = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return scrollY;
};
