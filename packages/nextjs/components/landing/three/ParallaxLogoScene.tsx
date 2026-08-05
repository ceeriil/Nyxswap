"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise } from "@react-three/postprocessing";
import { Model } from "~~/components/landing/three/Model";
import { THREE_CONFIG } from "~~/constants/landing";

const { LIGHT, CAMERA, SHADOW } = THREE_CONFIG;

const useResponsiveCamera = () => {
  const [isXXL, setIsXXL] = useState(false);

  useEffect(() => {
    const update = () => setIsXXL(window.innerWidth >= CAMERA.XXL_BREAKPOINT_PX);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isXXL ? CAMERA.BREAKPOINTS.XXL : CAMERA.BREAKPOINTS.XL;
};

interface ParallaxLogoSceneProps {
  modelUrl: string;
  bloomEnabled?: boolean;
}

export default function ParallaxLogoScene({ modelUrl, bloomEnabled = true }: ParallaxLogoSceneProps) {
  const cameraConfig = useResponsiveCamera();

  return (
    <Canvas
      shadows
      camera={{ position: cameraConfig.position, fov: cameraConfig.fov }}
      gl={{
        antialias: typeof window !== "undefined" && window.devicePixelRatio <= 1,
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
      }}
    >
      <ambientLight intensity={LIGHT.AMBIENT_INTENSITY} />

      <directionalLight
        position={[-0.8, 0.6, LIGHT.BASE_Z]}
        intensity={LIGHT.KEY_INTENSITY}
        castShadow
        shadow-mapSize-width={SHADOW.MAP_SIZE}
        shadow-mapSize-height={SHADOW.MAP_SIZE}
        shadow-camera-left={SHADOW.CAMERA_BOUNDS.LEFT}
        shadow-camera-right={SHADOW.CAMERA_BOUNDS.RIGHT}
        shadow-camera-top={SHADOW.CAMERA_BOUNDS.TOP}
        shadow-camera-bottom={SHADOW.CAMERA_BOUNDS.BOTTOM}
        shadow-camera-near={SHADOW.CAMERA_BOUNDS.NEAR}
        shadow-camera-far={SHADOW.CAMERA_BOUNDS.FAR}
        shadow-bias={SHADOW.BIAS}
        shadow-radius={SHADOW.RADIUS}
      />
      <directionalLight position={[0.8, -0.6, LIGHT.BASE_Z]} intensity={LIGHT.FILL_INTENSITY} />
      <directionalLight position={[0, 0, -8]} intensity={LIGHT.RIM_INTENSITY} color="#ffffff" />

      {LIGHT.POINT_LIGHTS.map((light, i) => (
        <pointLight key={i} position={light.position} intensity={light.intensity} color={light.color} />
      ))}

      <Suspense fallback={null}>
        <Model url={modelUrl} />
      </Suspense>

      {bloomEnabled && (
        <EffectComposer>
          <Bloom
            intensity={LIGHT.BLOOM.INTENSITY}
            luminanceThreshold={LIGHT.BLOOM.LUMINANCE_THRESHOLD}
            luminanceSmoothing={LIGHT.BLOOM.LUMINANCE_SMOOTHING}
          />
          <Noise opacity={LIGHT.NOISE.OPACITY} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
