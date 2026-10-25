"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const DOCS = [
  { title: "Monitoring Report", x: -1.2, y: 0.4, z: -0.6, rx: 0.1, ry: 0.45, tint: "#3ddc97", scale: 1.05 },
  { title: "Meter Data", x: -0.2, y: 0.1, z: 0.1, rx: 0.05, ry: 0.25, tint: "#5aa9ff", scale: 1.0 },
  { title: "PPA Agreement", x: 0.8, y: -0.15, z: 0.7, rx: 0.0, ry: 0.05, tint: "#3ddc97", scale: 0.95 },
  { title: "Other Evidence", x: 1.7, y: -0.4, z: 1.2, rx: -0.05, ry: -0.15, tint: "#f0b64a", scale: 0.9 },
];

function GlassDocument({
  doc,
  index,
  reduced,
}: {
  doc: (typeof DOCS)[number];
  index: number;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  // Translucent glass body material
  const glassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#0c231b"),
        emissive: new THREE.Color(doc.tint),
        emissiveIntensity: 0.15,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.75,
      }),
    [doc.tint],
  );

  // Glowing neon edge material
  const edgeMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(doc.tint),
        transparent: true,
        opacity: 0.85,
      }),
    [doc.tint],
  );

  const textLinesMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(doc.tint),
        transparent: true,
        opacity: 0.4,
      }),
    [doc.tint],
  );

  useFrame((state) => {
    if (reduced || !group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.y = doc.y + Math.sin(t * 1.2 + index * 0.9) * 0.08;
    group.current.rotation.y = doc.ry + Math.sin(t * 0.6 + index * 0.7) * 0.04;
    group.current.rotation.x = doc.rx + Math.cos(t * 0.8 + index * 0.5) * 0.02;
  });

  return (
    <group ref={group} position={[doc.x, doc.y, doc.z]} rotation={[doc.rx, doc.ry, 0]} scale={doc.scale}>
      {/* Main Glass Document Slab */}
      <mesh material={glassMat}>
        <boxGeometry args={[1.35, 1.85, 0.035]} />
      </mesh>

      {/* Wireframe Glowing Edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1.36, 1.86, 0.036)]} />
        <primitive object={edgeMat} attach="material" />
      </lineSegments>

      {/* Document Header Bar */}
      <mesh position={[0, 0.68, 0.022]} material={edgeMat}>
        <boxGeometry args={[1.05, 0.18, 0.008]} />
      </mesh>

      {/* Document Text Line Skeletons */}
      {[-0.45, -0.25, -0.05, 0.15, 0.35].map((y, i) => (
        <mesh key={y} position={[i === 0 ? -0.15 : 0, y, 0.022]} material={textLinesMat}>
          <boxGeometry args={[i === 0 ? 0.65 : 1.05, 0.045, 0.006]} />
        </mesh>
      ))}

      {/* Bottom Check / Metric Chip */}
      <mesh position={[0.35, -0.68, 0.022]} material={edgeMat}>
        <boxGeometry args={[0.35, 0.12, 0.008]} />
      </mesh>
    </group>
  );
}

function HologramBeam({ reduced }: { reduced: boolean }) {
  const beamRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (reduced) return;
    const t = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
    }
  });

  return (
    <group ref={beamRef} position={[0, -1.1, 0]}>
      {/* Ground Projection Ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.5, 64]} />
        <meshBasicMaterial color="#3ddc97" transparent opacity={0.4} />
      </mesh>

      {/* Inner Glowing Disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.38, 64]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.06} />
      </mesh>

      {/* Soft Ambient Upward Beam Glow */}
      <mesh position={[0, 1.2, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[1.2, 1.5, 2.4, 32, 1, true]} />
        <meshBasicMaterial color="#3ddc97" transparent opacity={0.03} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function DocsStack({
  frameloop,
  reduced,
}: {
  frameloop: "always" | "demand";
  reduced: boolean;
}) {
  return (
    <Canvas
      frameloop={frameloop}
      dpr={[1, 1.8]}
      camera={{ position: [0.3, 1.0, 5.2], fov: 36 }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} color="#e6fff3" />
      <directionalLight position={[-4, 2, -2]} intensity={1.2} color="#5aa9ff" />
      <pointLight position={[0, 0, 2]} intensity={4} color="#3ddc97" distance={8} />

      <HologramBeam reduced={reduced} />

      {DOCS.map((doc, i) => (
        <GlassDocument key={doc.title} doc={doc} index={i} reduced={reduced} />
      ))}
    </Canvas>
  );
}
