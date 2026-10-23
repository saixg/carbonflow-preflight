"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

function Turbine({ position, speed, scale = 1 }: { position: [number, number, number]; speed: number; scale?: number }) {
  const rotor = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.z -= dt * speed;
  });
  const white = useMemo(() => mat("#e9f2ee", { roughness: 0.5 }), []);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.9, 0]} material={white}>
        <cylinderGeometry args={[0.035, 0.07, 1.8, 8]} />
      </mesh>
      <group position={[0, 1.8, 0.05]}>
        <mesh material={white}>
          <boxGeometry args={[0.1, 0.1, 0.22]} />
        </mesh>
        <group ref={rotor} position={[0, 0, 0.14]}>
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
              <mesh position={[0, 0.52, 0]} material={white}>
                <boxGeometry args={[0.07, 1.05, 0.015]} />
              </mesh>
            </group>
          ))}
          <mesh material={white}>
            <sphereGeometry args={[0.07, 12, 12]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Panels() {
  const frame = useMemo(() => mat("#9db3aa", { metalness: 0.4, roughness: 0.4 }), []);
  const glass = useMemo(() => mat("#17407a", { metalness: 0.6, roughness: 0.25, emissive: "#0b2a55", emissiveIntensity: 0.6 }), []);
  const cells: [number, number][] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) cells.push([c * 0.62, r * 0.55]);
  return (
    <group position={[-1.5, 0.43, 0.7]} rotation={[0, 0.35, 0]}>
      {cells.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} rotation={[-0.5, 0, 0]}>
          <mesh material={frame}>
            <boxGeometry args={[0.55, 0.03, 0.4]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={glass}>
            <boxGeometry args={[0.5, 0.012, 0.35]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Trees() {
  const trunk = useMemo(() => mat("#5a4632"), []);
  const leaf = useMemo(() => [mat("#1f7a4d"), mat("#2a9560"), mat("#176a42")], []);
  const items = useMemo(() => {
    const r = rng(11);
    const out: { x: number; z: number; s: number; m: number }[] = [];
    let guard = 0;
    while (out.length < 26 && guard++ < 400) {
      const a = r() * Math.PI * 2;
      const d = 0.6 + r() * 1.9;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const nearPanels = x < -0.4 && x > -3.2 && z > 0.2 && z < 2.6;
      const nearTurbine = (Math.abs(x - 1.1) < 0.5 && Math.abs(z + 0.4) < 0.5) || (Math.abs(x - 0.1) < 0.45 && Math.abs(z + 1.3) < 0.45);
      if (nearPanels || nearTurbine) continue;
      out.push({ x, z, s: 0.7 + r() * 0.7, m: Math.floor(r() * 3) });
    }
    return out;
  }, []);
  return (
    <>
      {items.map((t, i) => (
        <group key={i} position={[t.x, 0.4, t.z]} scale={t.s}>
          <mesh position={[0, 0.1, 0]} material={trunk}>
            <cylinderGeometry args={[0.025, 0.035, 0.2, 5]} />
          </mesh>
          <mesh position={[0, 0.32, 0]} material={leaf[t.m]}>
            <coneGeometry args={[0.15, 0.32, 6]} />
          </mesh>
          <mesh position={[0, 0.5, 0]} material={leaf[t.m]}>
            <coneGeometry args={[0.11, 0.26, 6]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Island({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const grass = useMemo(() => mat("#2f8f5a"), []);
  const rock = useMemo(() => mat("#3b4a43"), []);
  const water = useMemo(() => mat("#2fa8c4", { transparent: true, opacity: 0.8, roughness: 0.2 }), []);

  useFrame((s, dt) => {
    if (reduced || !group.current) return;
    const t = s.clock.elapsedTime;
    group.current.position.y = Math.sin(t * 0.7) * 0.1;
    group.current.rotation.y += dt * 0.06;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, s.pointer.y * 0.08, 0.04);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -s.pointer.x * 0.06, 0.04);
    if (ring.current) ring.current.rotation.z += dt * 0.25;
  });

  return (
    <group ref={group} rotation={[0, -0.6, 0]}>
      <mesh position={[0, 0.2, 0]} material={grass}>
        <cylinderGeometry args={[3.2, 3, 0.4, 9]} />
      </mesh>
      <mesh position={[0, -1.1, 0]} rotation={[Math.PI, 0, 0]} material={rock}>
        <coneGeometry args={[3, 2.2, 9]} />
      </mesh>
      <mesh position={[1.9, 0.42, 1.2]} rotation={[0, 0, 0]} material={water}>
        <cylinderGeometry args={[0.7, 0.7, 0.04, 16]} />
      </mesh>
      <mesh position={[-0.9, 0.55, -1.2]} material={mat("#277a4c")} scale={[1.5, 0.7, 1.1]}>
        <sphereGeometry args={[0.6, 8, 6]} />
      </mesh>
      <Trees />
      <Panels />
      <Turbine position={[1.1, 0.4, -0.4]} speed={1.1} />
      <Turbine position={[0.1, 0.4, -1.3]} speed={0.9} scale={0.85} />
      <Turbine position={[2.1, 0.4, -1.0]} speed={1.3} scale={0.7} />
      <mesh ref={ring} position={[0, -0.2, 0]} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[3.7, 0.014, 8, 96]} />
        <meshBasicMaterial color="#3ddc97" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

function Motes({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const r = rng(5);
    const a = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      a[i * 3] = (r() - 0.5) * 9;
      a[i * 3 + 1] = (r() - 0.3) * 5;
      a[i * 3 + 2] = (r() - 0.5) * 7;
    }
    return a;
  }, []);
  useFrame((_, dt) => {
    if (!reduced && ref.current) ref.current.rotation.y += dt * 0.03;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#9bf0c8" size={0.035} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

export default function HeroIsland({ frameloop, reduced }: { frameloop: "always" | "demand"; reduced: boolean }) {
  return (
    <Canvas
      frameloop={frameloop}
      dpr={[1, 1.6]}
      camera={{ position: [7.6, 4.2, 9], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 4]} intensity={2.1} color="#fff1d6" />
      <pointLight position={[0, -3, 1]} intensity={9} color="#3ddc97" distance={9} />
      <hemisphereLight args={["#bfeedd", "#0a1713", 0.5]} />
      <Island reduced={reduced} />
      <Motes reduced={reduced} />
    </Canvas>
  );
}
