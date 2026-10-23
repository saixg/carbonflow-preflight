"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const SHEETS = [
  { x: -1.55, y: 0.1, z: 0.0, ry: 0.5, tint: "#d94f4f", phase: 0 },
  { x: -0.55, y: 0.25, z: 0.35, ry: 0.28, tint: "#3ddc97", phase: 1.2 },
  { x: 0.55, y: 0.05, z: 0.45, ry: -0.2, tint: "#5aa9ff", phase: 2.1 },
  { x: 1.5, y: 0.2, z: 0.05, ry: -0.5, tint: "#f0b64a", phase: 3.3 },
];

function Sheet({ s, reduced }: { s: (typeof SHEETS)[number]; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8efe9", roughness: 0.7 }), []);
  const line = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9aa8a0", roughness: 0.9 }), []);
  const head = useMemo(() => new THREE.MeshStandardMaterial({ color: s.tint, emissive: s.tint, emissiveIntensity: 0.25 }), [s.tint]);
  useFrame((st) => {
    if (reduced || !ref.current) return;
    ref.current.position.y = s.y + Math.sin(st.clock.elapsedTime * 0.9 + s.phase) * 0.09;
    ref.current.rotation.y = s.ry + Math.sin(st.clock.elapsedTime * 0.4 + s.phase) * 0.05;
  });
  return (
    <group ref={ref} position={[s.x, s.y, s.z]} rotation={[-0.08, s.ry, 0]}>
      <mesh material={paper}>
        <boxGeometry args={[1.05, 1.4, 0.04]} />
      </mesh>
      <mesh position={[0, 0.5, 0.03]} material={head}>
        <boxGeometry args={[0.85, 0.16, 0.01]} />
      </mesh>
      {[0.22, 0.05, -0.12, -0.29, -0.46].map((y, i) => (
        <mesh key={y} position={[i === 4 ? -0.12 : 0, y, 0.03]} material={line}>
          <boxGeometry args={[i === 4 ? 0.5 : 0.8, 0.04, 0.01]} />
        </mesh>
      ))}
    </group>
  );
}

export default function DocsStack({ frameloop, reduced }: { frameloop: "always" | "demand"; reduced: boolean }) {
  return (
    <Canvas frameloop={frameloop} dpr={[1, 1.6]} camera={{ position: [0, 1.2, 5.6], fov: 38 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.8} />
      <pointLight position={[0, -1.5, 2]} intensity={6} color="#3ddc97" distance={7} />
      {SHEETS.map((s) => (
        <Sheet key={s.tint} s={s} reduced={reduced} />
      ))}
      <mesh position={[0, -1.15, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.26, 64]} />
        <meshBasicMaterial color="#3ddc97" transparent opacity={0.5} />
      </mesh>
    </Canvas>
  );
}
