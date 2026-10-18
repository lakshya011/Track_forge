"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import Car3D from "@/components/Car3D";
import { GHOST_COLOURS, type CarTopColours } from "@/components/CarTopSvg";
import { CornerMarkers, TrackScene, buildGeometry, type Built } from "@/components/TrackScene";
import { frameAt } from "@/lib/geo/decor";
import type { LapProfile } from "@/lib/geo/speed";
import type { Track } from "@/lib/geo/types";
import type { LapClock } from "@/lib/hooks/useLapClock";

export interface FlyRequest {
  /** Corner number to fly the camera to. */
  n: number;
  /** Changes on every request so the same corner can be flown to twice. */
  nonce: number;
}

interface Props {
  track: Track;
  /** Vertical exaggeration applied to elevation. */
  zScale?: number;
  /** The shared lap clock; with it the ghost car laps the ribbon. Omit to hide it. */
  clock?: LapClock;
  /** Speed profile so the car slows for corners; without it the lap runs at one speed. */
  profile?: LapProfile;
  carColours?: CarTopColours;
  /** Corner lit on the ribbon (hovered card or marker). */
  activeCorner?: number | null;
  onActiveCorner?: (n: number | null) => void;
  /** A click on a marker; the page answers with `flyTo`. */
  onSelectCorner?: (n: number) => void;
  flyTo?: FlyRequest | null;
}

/** The ghost car on the ribbon, oversized like a map pin so it reads from the orbit camera. */
function Ghost({ track, built, clock, profile, colours }: { track: Track; built: Built; clock: LapClock; profile?: LapProfile; colours: CarTopColours }) {
  const ref = useRef<THREE.Group>(null);
  const heading = useRef<number | null>(null);
  // About two ribbon widths long.
  const s = (built.halfWidth * 4.4) / 5.6;
  useFrame((_, dt) => {
    if (!ref.current) return;
    const t = clock.now();
    const d = profile ? profile.distAt(t) : (t / clock.lapSeconds) * track.length;
    const f = frameAt(track.loop, d);
    const [x, y, z] = built.toWorld(f.p.x, f.p.y, f.p.z);
    const h = Math.atan2(f.t.y, f.t.x);
    const k = 1 - Math.exp(-10 * Math.min(dt, 0.1));
    heading.current = heading.current === null ? h : heading.current + Math.atan2(Math.sin(h - heading.current), Math.cos(h - heading.current)) * k;
    ref.current.position.set(x, y, z + built.halfWidth * 0.03);
    ref.current.rotation.set(0, 0, heading.current);
  });
  return (
    <group ref={ref} scale={[s, s, s]}>
      <Car3D colours={colours} variant="chase" />
    </group>
  );
}

const FLY_DISTANCE = 44;
const FLY_ELEVATION = 0.72; // radians above the horizon

/** Eases the orbit target to a corner's apex and the camera to a viewpoint above it; any drag cancels the flight. */
function CameraFly({ controls, built, request }: { controls: RefObject<OrbitControlsImpl | null>; built: Built; request: FlyRequest | null | undefined }) {
  const { camera } = useThree();
  const started = useRef<number | null>(null);
  const flight = useRef<{ to: THREE.Vector3; camTo: THREE.Vector3 } | null>(null);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => {
      flight.current = null;
    };
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    if (request && request.nonce !== started.current) {
      started.current = request.nonce;
      const frame = built.corners.find((f) => f.number === request.n);
      if (frame) {
        const to = new THREE.Vector3(...frame.pos);
        // Keep the current viewing direction, lower the camera and bring it in close.
        const off = camera.position.clone().sub(c.target);
        const az = Math.atan2(off.y, off.x);
        const camTo = new THREE.Vector3(
          to.x + Math.cos(az) * FLY_DISTANCE * Math.cos(FLY_ELEVATION),
          to.y + Math.sin(az) * FLY_DISTANCE * Math.cos(FLY_ELEVATION),
          to.z + FLY_DISTANCE * Math.sin(FLY_ELEVATION),
        );
        flight.current = { to, camTo };
      }
    }
    const f = flight.current;
    if (!f) return;
    const k = 1 - Math.exp(-6 * Math.min(dt, 0.1));
    c.target.lerp(f.to, k);
    camera.position.lerp(f.camTo, k);
    c.update();
    if (c.target.distanceTo(f.to) < 0.05 && camera.position.distanceTo(f.camTo) < 0.05) flight.current = null;
  });
  return null;
}

function Scene({ track, zScale, clock, profile, carColours = GHOST_COLOURS, activeCorner, onActiveCorner, onSelectCorner, flyTo }: Required<Pick<Props, "track" | "zScale">> & Omit<Props, "track" | "zScale">) {
  const built = useMemo(() => buildGeometry(track, { halfWidth: 1.1, zScale, drop: 2.5 }), [track, zScale]);
  const controls = useRef<OrbitControlsImpl>(null);
  return (
    <>
      <color attach="background" args={["#0b0b0f"]} />
      <fog attach="fog" args={["#0b0b0f", 160, 320]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[60, -80, 120]} intensity={1.4} />
      <directionalLight position={[-80, 60, 60]} intensity={0.5} color="#ffd7a0" />
      <TrackScene built={built}>
        <CornerMarkers built={built} activeCorner={activeCorner ?? null} onActiveCorner={onActiveCorner} onSelectCorner={onSelectCorner} />
        {clock && <Ghost track={track} built={built} clock={clock} profile={profile} colours={carColours} />}
      </TrackScene>
      <OrbitControls ref={controls} enablePan={false} minDistance={30} maxDistance={220} maxPolarAngle={Math.PI / 2 - 0.05} target={[0, 0, 0]} />
      <CameraFly controls={controls} built={built} request={flyTo} />
    </>
  );
}

export default function Track3D({ track, zScale = 2.5, clock, profile, carColours, activeCorner = null, onActiveCorner, onSelectCorner, flyTo }: Props) {
  return (
    <Canvas camera={{ position: [-40, -110, 70], fov: 40, up: [0, 0, 1], near: 0.5, far: 1000 }} dpr={[1, 2]}>
      <Scene track={track} zScale={zScale} clock={clock} profile={profile} carColours={carColours} activeCorner={activeCorner} onActiveCorner={onActiveCorner} onSelectCorner={onSelectCorner} flyTo={flyTo} />
    </Canvas>
  );
}
