"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";

export const Globe = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600 * 2,
      height: 600 * 2,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 4000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.1, 0.8, 1],
      glowColor: [0.15, 0.15, 0.15],
      markers: [
        // longitude latitude
        { location: [37.7595, -122.4367], size: 0.03 },
        { location: [40.7128, -74.006], size: 0.1 },
      ],
      onRender: state => {
        // Auto-rotate unless the pointer is dragging the globe.
        if (pointerInteracting.current === null) {
          phiRef.current += 0.005;
        }
        state.phi = phiRef.current + pointerInteractionMovement.current / 200;
      },
    });

    return () => {
      globe.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={e => {
        pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
        if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
      }}
      onPointerUp={() => {
        pointerInteracting.current = null;
        if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      }}
      onPointerOut={() => {
        pointerInteracting.current = null;
        if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      }}
      onMouseMove={e => {
        if (pointerInteracting.current !== null) {
          pointerInteractionMovement.current = e.clientX - pointerInteracting.current;
        }
      }}
      onTouchMove={e => {
        if (pointerInteracting.current !== null && e.touches[0]) {
          pointerInteractionMovement.current = e.touches[0].clientX - pointerInteracting.current;
        }
      }}
      style={{ width: 600, height: 600, maxWidth: "100%", aspectRatio: 1, cursor: "grab" }}
      className={className}
    />
  );
};
