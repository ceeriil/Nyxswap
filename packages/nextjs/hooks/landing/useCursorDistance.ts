import { useCallback, useEffect, useRef, useState } from "react";

interface UseCursorDistanceOptions {
  maxDistance?: number;
  throttleMs?: number;
}

/**
 * Tracks how close the cursor is to a target element, normalized to [0, 1]
 * (1 = cursor directly over the element's center). Drives the proximity-based
 * glint intensity on landing buttons/cards.
 */
export const useCursorDistance = (
  targetRef: React.RefObject<HTMLElement | null>,
  options: UseCursorDistanceOptions = {},
) => {
  const { maxDistance = 200, throttleMs = 16 } = options;
  const [intensity, setIntensity] = useState(0);
  const frameRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef(0);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < throttleMs) return;

      if (frameRef.current) cancelAnimationFrame(frameRef.current);

      frameRef.current = requestAnimationFrame(() => {
        const target = targetRef.current;
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        const distance = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);

        setIntensity(Math.max(0, 1 - distance / maxDistance));
        lastUpdateRef.current = now;
      });
    },
    [targetRef, maxDistance, throttleMs],
  );

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [handleMouseMove]);

  return { intensity };
};
