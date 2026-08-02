"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

/**
 * A faceted seal object that rotates and "solidifies" (rough → metallic)
 * as scroll progress moves through this section — visualizing shipped
 * work being minted into a verifiable, immutable credential.
 */
function Seal({ progress }: { progress: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, delta) => {
    const p = progress.get();
    if (group.current) {
      group.current.rotation.y += delta * (0.15 + p * 0.6);
      group.current.rotation.x = Math.sin(p * Math.PI) * 0.25;
      const scale = 0.85 + p * 0.3;
      group.current.scale.setScalar(scale);
    }
    if (ring.current) {
      ring.current.rotation.z += delta * 0.2;
    }
    if (mat.current) {
      // rough / unminted -> polished brass as progress increases
      mat.current.roughness = 0.9 - p * 0.75;
      mat.current.metalness = 0.1 + p * 0.85;
      mat.current.color.set(p > 0.5 ? "#d9a856" : "#3e7ca6");
    }
  });

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshStandardMaterial ref={mat} color="#3e7ca6" roughness={0.9} metalness={0.1} flatShading />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.7, 0.02, 8, 64]} />
        <meshBasicMaterial color="#6fb3e0" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

export default function ReputationSeal({ progress }: { progress: MotionValue<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} color="#eae4d3" />
      <directionalLight position={[-4, -2, -3]} intensity={0.4} color="#3e7ca6" />
      <Seal progress={progress} />
    </Canvas>
  );
}
