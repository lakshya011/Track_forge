"use client";

import { forwardRef } from "react";
import * as THREE from "three";
import type { CarTopColours } from "@/components/CarTopSvg";

/*
 * A low-poly single-seater built from primitives, in metres: +x forward, +z up, wheels on z = 0.
 * About 5.6 m long and 2 m wide. The "cockpit" variant leaves out everything behind the driver's
 * eye (engine cover, rear wing, rear wheels) so the onboard camera sees the nose, front wheels,
 * mirrors and halo and nothing clips through the lens. Livery colours match the map car.
 */

export type CarVariant = "chase" | "cockpit";

interface Props {
  colours: CarTopColours;
  variant?: CarVariant;
}

const CARBON = "#1a1a1f";
const TYRE = "#141418";

function Wheel({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, y, 0.36]}>
      <mesh>
        <cylinderGeometry args={[0.36, 0.36, 0.4, 18]} />
        <meshStandardMaterial color={TYRE} roughness={0.85} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.41, 12]} />
        <meshStandardMaterial color="#3a3a42" roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
}

function Arm({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return (
    <mesh position={mid} quaternion={q}>
      <cylinderGeometry args={[0.02, 0.02, len, 6]} />
      <meshStandardMaterial color={CARBON} />
    </mesh>
  );
}

const Car3D = forwardRef<THREE.Group, Props>(function Car3D({ colours, variant = "chase" }, ref) {
  const c1 = colours.c1;
  const c2 = colours.c2;
  const c3 = colours.c3;
  const chase = variant === "chase";
  return (
    <group ref={ref}>
      {/* Floor */}
      <mesh position={[-0.2, 0, 0.09]}>
        <boxGeometry args={[4.3, 1.5, 0.06]} />
        <meshStandardMaterial color={CARBON} roughness={0.9} />
      </mesh>
      {/* Monocoque */}
      <mesh position={[0.4, 0, 0.42]}>
        <boxGeometry args={[2.6, 0.62, 0.5]} />
        <meshStandardMaterial color={c1} roughness={0.35} metalness={0.1} />
      </mesh>
      {/* Nose */}
      <mesh position={[2.45, 0, 0.42]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.24, 1.6, 10]} />
        <meshStandardMaterial color={c1} roughness={0.35} metalness={0.1} />
      </mesh>
      {/* Front wing with endplates and a flap stripe */}
      <mesh position={[2.75, 0, 0.1]}>
        <boxGeometry args={[0.55, 2.0, 0.05]} />
        <meshStandardMaterial color={c2} roughness={0.5} />
      </mesh>
      <mesh position={[2.55, 0, 0.17]}>
        <boxGeometry args={[0.18, 1.6, 0.04]} />
        <meshStandardMaterial color={c3} roughness={0.5} />
      </mesh>
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[2.7, sgn * 1.0, 0.22]}>
          <boxGeometry args={[0.7, 0.05, 0.28]} />
          <meshStandardMaterial color={c2} roughness={0.5} />
        </mesh>
      ))}
      {/* Front wheels and arms */}
      <Wheel x={1.65} y={0.8} />
      <Wheel x={1.65} y={-0.8} />
      <Arm from={[1.4, 0.3, 0.45]} to={[1.6, 0.62, 0.4]} />
      <Arm from={[1.9, 0.3, 0.45]} to={[1.75, 0.62, 0.4]} />
      <Arm from={[1.4, -0.3, 0.45]} to={[1.6, -0.62, 0.4]} />
      <Arm from={[1.9, -0.3, 0.45]} to={[1.75, -0.62, 0.4]} />
      {/* Mirrors */}
      {[-1, 1].map((sgn) => (
        <mesh key={sgn} position={[0.9, sgn * 0.55, 0.78]}>
          <boxGeometry args={[0.12, 0.2, 0.1]} />
          <meshStandardMaterial color={c2} />
        </mesh>
      ))}
      {/* Halo: ring around the cockpit and the centre pillar */}
      <mesh position={[0.25, 0, 0.86]}>
        <torusGeometry args={[0.46, 0.035, 8, 28]} />
        <meshStandardMaterial color={c3} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0.72, 0, 0.74]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.3, 0.06, 0.06]} />
        <meshStandardMaterial color={c3} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Driver's helmet and the cockpit surround */}
      <mesh position={[0.2, 0, 0.8]}>
        <sphereGeometry args={[0.15, 14, 12]} />
        <meshStandardMaterial color={colours.accent} roughness={0.3} />
      </mesh>
      <mesh position={[0.2, 0, 0.68]}>
        <boxGeometry args={[0.9, 0.7, 0.06]} />
        <meshStandardMaterial color={CARBON} roughness={0.8} />
      </mesh>
      {chase && (
        <>
          {/* Sidepods */}
          {[-1, 1].map((sgn) => (
            <mesh key={sgn} position={[-0.7, sgn * 0.52, 0.34]}>
              <boxGeometry args={[1.9, 0.5, 0.46]} />
              <meshStandardMaterial color={c1} roughness={0.35} metalness={0.1} />
            </mesh>
          ))}
          {/* Engine cover and airbox */}
          <mesh position={[-1.0, 0, 0.72]}>
            <boxGeometry args={[2.2, 0.42, 0.34]} />
            <meshStandardMaterial color={c1} roughness={0.35} metalness={0.1} />
          </mesh>
          <mesh position={[-0.45, 0, 1.0]}>
            <boxGeometry args={[0.55, 0.36, 0.26]} />
            <meshStandardMaterial color={c1} roughness={0.35} metalness={0.1} />
          </mesh>
          <mesh position={[-2.1, 0, 0.42]}>
            <boxGeometry args={[0.6, 0.5, 0.4]} />
            <meshStandardMaterial color={CARBON} roughness={0.8} />
          </mesh>
          {/* Rear wing on two pylons */}
          <mesh position={[-2.55, 0, 0.95]}>
            <boxGeometry args={[0.42, 1.6, 0.06]} />
            <meshStandardMaterial color={c2} roughness={0.5} />
          </mesh>
          <mesh position={[-2.7, 0, 1.02]}>
            <boxGeometry args={[0.16, 1.5, 0.04]} />
            <meshStandardMaterial color={c3} roughness={0.5} />
          </mesh>
          {[-1, 1].map((sgn) => (
            <mesh key={sgn} position={[-2.55, sgn * 0.8, 0.75]}>
              <boxGeometry args={[0.6, 0.04, 0.5]} />
              <meshStandardMaterial color={c2} roughness={0.5} />
            </mesh>
          ))}
          {[-0.25, 0.25].map((y) => (
            <mesh key={y} position={[-2.45, y, 0.7]}>
              <boxGeometry args={[0.08, 0.04, 0.5]} />
              <meshStandardMaterial color={CARBON} />
            </mesh>
          ))}
          {/* Rear wheels and arms */}
          <Wheel x={-1.95} y={0.8} />
          <Wheel x={-1.95} y={-0.8} />
          <Arm from={[-1.7, 0.3, 0.45]} to={[-1.9, 0.62, 0.4]} />
          <Arm from={[-2.2, 0.3, 0.45]} to={[-2.05, 0.62, 0.4]} />
          <Arm from={[-1.7, -0.3, 0.45]} to={[-1.9, -0.62, 0.4]} />
          <Arm from={[-2.2, -0.3, 0.45]} to={[-2.05, -0.62, 0.4]} />
          {/* Rain light */}
          <mesh position={[-2.42, 0, 0.5]}>
            <boxGeometry args={[0.04, 0.12, 0.12]} />
            <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={1.5} />
          </mesh>
        </>
      )}
    </group>
  );
});

export default Car3D;
