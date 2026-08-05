import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GLTF } from "three-stdlib";
import { useScrollOffset } from "~~/hooks/landing/useScrollOffset";

interface ModelProps {
  url: string;
}

/**
 * Loads the logo .glb (expects a "LOGO" mesh in the scene, matching the
 * placeholder at public/models/placeholder-logo.glb) and shifts it upward
 * as the page scrolls, driving the About-page parallax.
 */
export function Model({ url }: ModelProps) {
  const { scene } = useGLTF(url) as GLTF;
  const logoRef = useRef<THREE.Object3D | null>(null);
  const originalY = useRef<number | null>(null);
  const scrollY = useScrollOffset();

  const yOffset = useMemo(() => {
    if (scrollY === 0 || typeof window === "undefined") return 0;
    const scrollFactor = scrollY / (window.innerHeight * 5);
    return Math.min(scrollFactor * 4.5, 4.5);
  }, [scrollY]);

  useEffect(() => {
    const logoMesh = scene.getObjectByName("LOGO");
    if (!logoMesh) return;

    logoRef.current = logoMesh;
    if (originalY.current === null) originalY.current = logoMesh.position.y;

    logoMesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.receiveShadow = true;
        child.castShadow = true;

        // Without this, an exported metallic material with no environment
        // map to reflect renders essentially black — there's nothing for
        // it to catch but the direct lights' specular highlights.
        if (child.material && "roughness" in child.material) {
          const material = child.material as THREE.MeshStandardMaterial;
          material.roughness = 0.7;
          material.metalness = 0.1;
          material.envMapIntensity = 0.3;
        }
      }
    });
  }, [scene]);

  useEffect(() => {
    if (logoRef.current && originalY.current !== null) {
      logoRef.current.position.y = originalY.current + yOffset;
    }
  }, [yOffset]);

  return <primitive object={scene} scale={1.6} />;
}

useGLTF.preload("/models/placeholder-logo.glb");
