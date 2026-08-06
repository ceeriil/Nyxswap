"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OVERLAY_Z_INDEX } from "~~/constants/landing";

interface CursorTrailContextValue {
  isEnabled: boolean;
  setTrailEnabled: (enabled: boolean) => void;
}

const CursorTrailContext = createContext<CursorTrailContextValue | null>(null);

/**
 * Wrap the landing/public pages in this provider — never the app/debug
 * pages. Enabled by default; call `setTrailEnabled(false)` if a page needs
 * to suppress it temporarily (e.g. while a modal is open).
 */
export const CursorTrailProvider = ({
  children,
  defaultEnabled = true,
}: {
  children: React.ReactNode;
  defaultEnabled?: boolean;
}) => {
  const [isEnabled, setIsEnabled] = useState(defaultEnabled);
  const setTrailEnabled = useCallback((enabled: boolean) => setIsEnabled(enabled), []);
  const value = useMemo(() => ({ isEnabled, setTrailEnabled }), [isEnabled, setTrailEnabled]);

  return (
    <CursorTrailContext.Provider value={value}>
      {children}
      <CursorTrail enabled={isEnabled} />
    </CursorTrailContext.Provider>
  );
};

export const useCursorTrail = () => {
  const context = useContext(CursorTrailContext);
  if (!context) throw new Error("useCursorTrail must be used within a CursorTrailProvider");
  return context;
};

interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface CursorTrailProps {
  enabled: boolean;
  maxPoints?: number;
  fadeTime?: number;
  rippleSize?: number;
  intensity?: number;
}

const CursorTrail = ({
  enabled,
  maxPoints = 3000,
  fadeTime = 2500,
  rippleSize = 100,
  intensity = 0.9,
}: CursorTrailProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const pointsRef = useRef<TrailPoint[]>([]);
  const lastTrailPointRef = useRef({ x: 0, y: 0 });
  const currentMouseRef = useRef({ x: 0, y: 0 });
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let container = document.getElementById("cursor-trail-root");
    if (!container) {
      container = document.createElement("div");
      container.id = "cursor-trail-root";
      document.body.appendChild(container);
    }
    setPortalContainer(container);
    return () => {
      if (container && container.childElementCount === 0) container.remove();
    };
  }, []);

  const drawTrailPoints = useCallback(
    (ctx: CanvasRenderingContext2D, now: number) => {
      for (const point of pointsRef.current) {
        const ageRatio = (now - point.timestamp) / fadeTime;
        if (ageRatio >= 1) continue;

        const baseOpacity = intensity * Math.pow(1 - ageRatio, 2) * 0.11;
        if (baseOpacity <= 0.002) continue;

        const baseSize = rippleSize * 0.4;
        const maxRippleSize = baseSize * 6;

        [0, 0.15, 0.3, 0.45, 0.6, 0.75].forEach((ringDelay, i) => {
          const ringProgress = Math.max(0, ageRatio - ringDelay);
          if (ringProgress <= 0) return;

          const easedProgress = 1 - Math.pow(1 - ringProgress, 3);
          const ringFade = Math.pow(1 - ringProgress, 1.5);
          const currentSize = baseSize + (maxRippleSize - baseSize) * easedProgress;
          const ringOpacity = 0.5 - i * 0.05;
          const finalOpacity = baseOpacity * ringOpacity * ringFade;
          if (finalOpacity <= 0.001) return;

          const innerRadius = Math.max(0, currentSize - baseSize * 0.5);
          const gradient = ctx.createRadialGradient(point.x, point.y, innerRadius, point.x, point.y, currentSize);
          gradient.addColorStop(0, `rgba(255, 255, 255, ${finalOpacity * 0.15})`);
          gradient.addColorStop(0.4, `rgba(255, 255, 255, ${finalOpacity * 0.2})`);
          gradient.addColorStop(0.8, `rgba(255, 255, 255, ${finalOpacity * 0.1})`);
          gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(point.x, point.y, currentSize, 0, Math.PI * 2);
          if (innerRadius > 0) ctx.arc(point.x, point.y, innerRadius, 0, Math.PI * 2, true);
          ctx.fill();
        });
      }
    },
    [fadeTime, intensity, rippleSize],
  );

  const drawStaticGlow = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { x, y } = currentMouseRef.current;
      if (x <= 0 || y <= 0) return;

      const glowSize = rippleSize * 0.8;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.08})`);
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${intensity * 0.04})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, Math.PI * 2);
      ctx.fill();
    },
    [rippleSize, intensity],
  );

  useEffect(() => {
    if (!enabled) {
      pointsRef.current = [];
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      currentMouseRef.current = { x: e.clientX, y: e.clientY };

      const dx = Math.abs(e.clientX - lastTrailPointRef.current.x);
      const dy = Math.abs(e.clientY - lastTrailPointRef.current.y);
      if (dx > 2 || dy > 2) {
        pointsRef.current.push({ x: e.clientX, y: e.clientY, timestamp: Date.now() });
        if (pointsRef.current.length > maxPoints) {
          pointsRef.current = pointsRef.current.slice(-maxPoints);
        }
        lastTrailPointRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const animate = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const now = Date.now();
      const cutoff = now - fadeTime;
      pointsRef.current = pointsRef.current.filter(p => p.timestamp >= cutoff);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawTrailPoints(ctx, now);
      drawStaticGlow(ctx);

      animationRef.current = requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [enabled, fadeTime, maxPoints, drawTrailPoints, drawStaticGlow]);

  if (!enabled || !portalContainer) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: OVERLAY_Z_INDEX.CURSOR_TRAIL }}
    />,
    portalContainer,
  );
};
