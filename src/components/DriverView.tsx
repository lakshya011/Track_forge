"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Car3D, { type CarVariant } from "@/components/Car3D";
import type { CarTopColours } from "@/components/CarTopSvg";
import { SECTOR_COLORS } from "@/components/TrackSvg";
import { NumberBadge, TrackScene, buildGeometry, type Built } from "@/components/TrackScene";
import { brakingBoards, frameAt, insideNormal, pointAt } from "@/lib/geo/decor";
import { formatLapTime } from "@/lib/geo/homologation";
import { cornerCueText, sectorAt } from "@/lib/geo/hud";
import { kmh, type LapProfile } from "@/lib/geo/speed";
import type { Track } from "@/lib/geo/types";
import type { LapClock } from "@/lib/hooks/useLapClock";

/*
 * Onboard: the lap in metres, seen from the cockpit or a chase camera, driven by the shared lap
 * clock and speed profile so it matches the 2D ghost. A gradient dusk sky, haze towards the
 * horizon, grass banks, kerbs and white lines passing under the car, grandstands, braking boards
 * and corner boards going by. The HUD is HTML over the canvas and is updated from the clock
 * without re-rendering React. Pausing switches the canvas to on-demand rendering.
 */

interface Props {
  track: Track;
  clock: LapClock;
  profile: LapProfile;
  carColours: CarTopColours;
}

const SKY_TOP = "#0d1530";
const HAZE = "#c99a7c";
const SKY_HORIZON = HAZE;
const GRASS = "#2d4a2a";
const ASPHALT = "#34343c";
const HALF_WIDTH = 6;

/** A sky dome: deep blue overhead fading to a warm band at the horizon. */
function Sky() {
  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(2400, 32, 16);
    g.rotateX(Math.PI / 2);
    const pos = g.attributes.position;
    const top = new THREE.Color(SKY_TOP);
    const hor = new THREE.Color(SKY_HORIZON);
    const col: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, Math.min(1, pos.getZ(i) / 2400));
      c.copy(hor).lerp(top, Math.pow(t, 0.45));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

/** A canvas texture for a braking board: white face, red stripe, the distance in metres. */
function boardTexture(label: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f4f4f5";
    ctx.fillRect(0, 0, 128, 96);
    ctx.fillStyle = "#e8322e";
    ctx.fillRect(0, 0, 128, 14);
    ctx.fillStyle = "#0b0b0f";
    ctx.font = '800 54px "Barlow Condensed", "Arial Narrow", Impact, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 64, 58);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Quaternion that turns a plane's +z normal to face `toward` from `from`, keeping z up. */
function facing(from: THREE.Vector3, toward: THREE.Vector3): THREE.Quaternion {
  const o = new THREE.Object3D();
  o.up.set(0, 0, 1);
  o.position.copy(from);
  o.lookAt(toward);
  return o.quaternion.clone();
}

/** Braking boards on the outside of the road before each corner, facing the approaching car. */
function Boards({ track, built }: { track: Track; built: Built }) {
  const items = useMemo(() => {
    const out: { pos: THREE.Vector3; q: THREE.Quaternion; label: string }[] = [];
    for (const b of brakingBoards(track)) {
      const off = HALF_WIDTH + 2.2;
      const f = frameAt(track.loop, b.corner.startDist - b.metres);
      const [x, y, z] = built.toWorld(b.p.x + b.n.x * off, b.p.y + b.n.y * off, f.p.z);
      const pos = new THREE.Vector3(x, y, z + 0.9);
      const toward = pos.clone().add(new THREE.Vector3(-f.t.x * 10, -f.t.y * 10, 0));
      out.push({ pos, q: facing(pos, toward), label: String(b.metres) });
    }
    return out;
  }, [track, built]);
  const textures = useMemo(() => ({ "100": boardTexture("100"), "50": boardTexture("50") }), []);
  useEffect(() => () => Object.values(textures).forEach((t) => t.dispose()), [textures]);
  return (
    <>
      {items.map((it, i) => (
        <group key={i} position={it.pos} quaternion={it.q}>
          <mesh>
            <planeGeometry args={[1.6, 1.2]} />
            <meshStandardMaterial map={textures[it.label as "100" | "50"]} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.9, -0.03]}>
            <boxGeometry args={[0.08, 0.7, 0.06]} />
            <meshStandardMaterial color="#2a2a33" />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Corner boards on the inside of each apex. */
function CornerBoards({ track, built }: { track: Track; built: Built }) {
  const items = useMemo(
    () =>
      track.corners.map((c) => {
        const n = insideNormal(track.loop, c.index, c.direction);
        const p = track.loop[c.index];
        const [x, y, z] = built.toWorld(p.x + n.x * (HALF_WIDTH + 3), p.y + n.y * (HALF_WIDTH + 3), p.z);
        return { number: c.number, pos: [x, y, z + 2.6] as [number, number, number] };
      }),
    [track, built],
  );
  return (
    <>
      {items.map((it) => (
        <group key={it.number}>
          <NumberBadge number={it.number} position={it.pos} size={2.6} depthTest />
          <mesh position={[it.pos[0], it.pos[1], it.pos[2] - 1.9]}>
            <boxGeometry args={[0.1, 0.1, 1.6]} />
            <meshStandardMaterial color="#2a2a33" />
          </mesh>
        </group>
      ))}
    </>
  );
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

interface RigProps {
  track: Track;
  built: Built;
  clock: LapClock;
  profile: LapProfile;
  variant: CarVariant;
  colours: CarTopColours;
}

/** Places the car from the clock and follows it: cockpit eye or chase camera, yaw smoothed, horizon level. */
function DriverRig({ track, built, clock, profile, variant, colours }: RigProps) {
  const car = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const st = useRef({ init: false, heading: 0, eye: new THREE.Vector3(), look: new THREE.Vector3(), fov: 70 });

  // Any seek or pause/play while paused renders one frame.
  useEffect(() => clock.subscribe(() => invalidate()), [clock, invalidate]);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    const t = clock.now();
    const d = profile.distAt(t);
    const f = frameAt(track.loop, d);
    const [x, y, z] = built.toWorld(f.p.x, f.p.y, f.p.z);
    const h = Math.atan2(f.t.y, f.t.x);
    const ahead = pointAt(track.loop, d + 8);
    const [ax, ay, az] = built.toWorld(ahead.x, ahead.y, ahead.z);
    const pitch = Math.atan2(az - z, Math.hypot(ax - x, ay - y) || 1);
    const k = 1 - Math.exp(-8 * dt);
    if (!s.init) s.heading = h;
    else s.heading += wrapAngle(h - s.heading) * k;

    if (car.current) {
      car.current.position.set(x, y, z);
      car.current.rotation.order = "ZYX";
      car.current.rotation.set(0, -pitch, s.heading);
    }

    const fx = Math.cos(s.heading);
    const fy = Math.sin(s.heading);
    const cockpit = variant === "cockpit";
    // The T-cam sits on the airbox behind the helmet and looks down the car's own axis, with a
    // quarter of a glance towards the road ahead; the chase camera trails and looks past the car.
    const la = pointAt(track.loop, d + (cockpit ? 30 : 18));
    const [lx, ly, lz] = built.toWorld(la.x, la.y, la.z);
    const eyeTarget = cockpit ? new THREE.Vector3(x - fx * 0.4, y - fy * 0.4, z + 1.28) : new THREE.Vector3(x - fx * 9, y - fy * 9, z + 3.2);
    const axis = new THREE.Vector3(eyeTarget.x + fx * 30, eyeTarget.y + fy * 30, lz + 1.0);
    const lookTarget = cockpit ? axis.lerp(new THREE.Vector3(lx, ly, lz + 1.0), 0.25) : new THREE.Vector3(lx, ly, lz + 1.2);
    if (!s.init) {
      s.eye.copy(eyeTarget);
      s.look.copy(lookTarget);
      s.init = true;
    } else {
      // The cockpit is bolted to the car; the chase camera trails on a spring.
      s.eye.lerp(eyeTarget, cockpit ? 1 : k);
      s.look.lerp(lookTarget, cockpit ? Math.min(1, k * 2) : k);
    }
    camera.position.copy(s.eye);
    camera.up.set(0, 0, 1);
    camera.lookAt(s.look);
    const fovTarget = cockpit ? 66 : 58;
    s.fov += (fovTarget - s.fov) * k;
    const pc = camera as THREE.PerspectiveCamera;
    if (Math.abs(pc.fov - s.fov) > 0.01) {
      pc.fov = s.fov;
      pc.updateProjectionMatrix();
    }
  });

  return <Car3D ref={car} colours={colours} variant={variant} />;
}

export default function DriverView({ track, clock, profile, carColours }: Props) {
  const [variant, setVariant] = useState<CarVariant>("cockpit");
  const built = useMemo(
    () => buildGeometry(track, { scale: 1, halfWidth: HALF_WIDTH, zScale: 1, drop: 1.2, bank: 2.5, bankColor: GRASS, topColor: ASPHALT, edgeColor: "#f4f4f5", kerbPeriod: 1, edgeStrip: 0.75 }),
    [track],
  );
  const speedRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const cueRef = useRef<HTMLSpanElement>(null);
  const sectorRef = useRef<HTMLSpanElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  // HUD text follows the clock without React in the loop.
  useEffect(
    () =>
      clock.subscribe((t) => {
        const d = profile.distAt(t);
        if (speedRef.current) speedRef.current.textContent = String(kmh(profile.speedAt(d)));
        if (timeRef.current) timeRef.current.textContent = formatLapTime(t);
        if (cueRef.current) cueRef.current.textContent = cornerCueText(track, d);
        if (sectorRef.current) {
          const sNo = sectorAt(track, d);
          sectorRef.current.textContent = `S${sNo}`;
          sectorRef.current.style.background = SECTOR_COLORS[sNo - 1];
        }
        if (sliderRef.current && !dragging.current) sliderRef.current.value = t.toFixed(2);
      }),
    [clock, profile, track],
  );

  const extent = Math.max(2000, built.extent * 3);

  return (
    <div className="space-y-3">
      <div className="relative h-[300px] sm:h-[460px] rounded-xl overflow-hidden bg-[#0d1530]">
        <Canvas camera={{ fov: 70, near: 0.15, far: 3000, up: [0, 0, 1], position: [0, -20, 4] }} dpr={[1, 1.5]} frameloop={clock.playing ? "always" : "demand"} gl={{ antialias: true }}>
          <fog attach="fog" args={[HAZE, 140, 1000]} />
          <ambientLight intensity={0.55} />
          <hemisphereLight args={[SKY_HORIZON, GRASS, 0.45]} />
          <directionalLight position={[-400, -300, 260]} intensity={1.6} color="#ffe3c2" />
          <Sky />
          <TrackScene built={built} groundSize={extent} groundColor={GRASS} grid={false} standsColor="#4b4b58" startLine="gantry">
            <Boards track={track} built={built} />
            <CornerBoards track={track} built={built} />
            <DriverRig track={track} built={built} clock={clock} profile={profile} variant={variant} colours={carColours} />
          </TrackScene>
        </Canvas>

        {/* HUD */}
        <div className="pointer-events-none absolute inset-0 p-3 sm:p-4 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div className="rounded-lg bg-black/55 backdrop-blur-sm px-3 py-2 min-w-[96px]">
              <div className="display text-3xl sm:text-5xl font-extrabold leading-none tabular">
                <span ref={speedRef}>0</span>
                <span className="text-sm sm:text-base font-semibold text-zinc-300 ml-1">km/h</span>
              </div>
            </div>
            <div className="rounded-lg bg-black/55 backdrop-blur-sm px-3 py-2 text-right">
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">Lap</div>
              <div className="display text-xl sm:text-3xl font-bold leading-none tabular">
                <span ref={timeRef}>0:00.000</span>
              </div>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="rounded-lg bg-black/55 backdrop-blur-sm px-3 py-2 flex items-center gap-2 max-w-[70%]">
              <span ref={sectorRef} className="display text-xs font-bold text-zinc-900 rounded px-1.5 py-0.5" style={{ background: SECTOR_COLORS[0] }}>
                S1
              </span>
              <span ref={cueRef} className="display text-base sm:text-xl font-bold truncate" />
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 rounded bg-black/45 px-2 py-1">{variant === "cockpit" ? "Onboard" : "Chase"}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <button
          type="button"
          onClick={() => clock.toggle()}
          aria-label={clock.playing ? "Pause the lap" : "Play the lap"}
          className="rounded-lg border border-line bg-ink-2 hover:bg-ink-3 px-3 py-1.5 text-zinc-100 font-semibold min-w-[72px]"
        >
          {clock.playing ? "Pause" : "Play"}
        </button>
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={clock.lapSeconds.toFixed(2)}
          step={0.01}
          defaultValue={0}
          aria-label="Lap position"
          onPointerDown={() => {
            dragging.current = true;
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onInput={(e) => clock.seek(Number((e.target as HTMLInputElement).value))}
          className="flex-1 min-w-[140px] accent-[var(--accent)]"
        />
        <div className="flex rounded-lg border border-line bg-ink-2 p-0.5" role="tablist" aria-label="Camera">
          {(
            [
              ["cockpit", "Cockpit"],
              ["chase", "Chase"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={variant === id} onClick={() => setVariant(id)} className={`px-2.5 py-1 rounded-md ${variant === id ? "bg-zinc-100 text-zinc-900 font-semibold" : "hover:text-zinc-100"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
