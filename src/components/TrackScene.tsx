"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SECTOR_COLORS } from "@/components/TrackSvg";
import { grandstands, insideNormal, rangeIndices } from "@/lib/geo/decor";
import type { Track } from "@/lib/geo/types";

/*
 * The 3D circuit shared by the Elevation tab (an overview the orbit camera flies around, 100 world
 * units across) and the Driver view (metre-true, seen from the cockpit). `buildGeometry` turns the
 * lap into a ribbon with coloured sectors, kerb-coloured edge lines, banks or walls down to the
 * ground, grandstand blocks and per-corner marker frames; `TrackScene` draws it with lights and
 * ground, and `CornerMarkers` adds a ring and pylon per corner that light up when the corner is
 * active and report hover and clicks back to the page.
 */

export interface BuildOptions {
  /** World units per metre; omit to fit the lap's longest side to 100 units. */
  scale?: number;
  /** Half the ribbon width in world units. */
  halfWidth: number;
  /** Vertical exaggeration applied to elevation. */
  zScale: number;
  /** Height of the ground below the lowest point of the ribbon, in world units. */
  drop: number;
  /** Horizontal run of the side banks per unit of drop; 0 gives vertical walls. */
  bank?: number;
  /** Colour of the banks or walls. */
  bankColor?: string;
  /** One colour for the road surface instead of the sector colours. */
  topColor?: string;
  /** Plain edge-line colour between kerbs (grey in the overview, white onboard). */
  edgeColor?: string;
  /** Kerb colour alternates every this many samples. */
  kerbPeriod?: number;
  /** Width in world units of raised edge strips (kerbs you can see from the cockpit); 0 for lines only. */
  edgeStrip?: number;
}

export interface CornerFrame {
  number: number;
  /** Apex on the ribbon surface. */
  pos: [number, number, number];
  /** Unit normal towards the inside of the corner, in world xy. */
  inside: [number, number];
  /** Direction of travel at the apex, radians in world xy. */
  heading: number;
}

export interface Built {
  g: THREE.BufferGeometry;
  leftLine: THREE.Line;
  rightLine: THREE.Line;
  /** Raised kerb/edge strips along both sides, when `edgeStrip` was asked for. */
  strips: THREE.BufferGeometry | null;
  sfPos: THREE.Vector3;
  sfDir: number;
  baseZ: number;
  scale: number;
  halfWidth: number;
  stands: { pos: [number, number, number]; size: [number, number, number]; rot: number }[];
  corners: CornerFrame[];
  toWorld: (x: number, y: number, z: number) => [number, number, number];
  /** World xy centre of the lap and its extent in world units. */
  centre: [number, number];
  extent: number;
}

export function buildGeometry(track: Track, o: BuildOptions): Built {
  const loop = track.loop;
  const n = loop.length;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity;
  for (const p of loop) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    minZ = Math.min(minZ, p.z);
  }
  const extentM = Math.max(maxX - minX, maxY - minY);
  const s = o.scale ?? 100 / extentM;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const width = o.halfWidth;
  const baseZ = -o.drop;
  const bank = o.bank ?? 0;
  const toWorld = (x: number, y: number, z: number): [number, number, number] => [(x - cx) * s, (y - cy) * s, (z - minZ) * s * o.zScale];

  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const sectorOf = (d: number) => (d < track.sectors[1] ? 0 : d < track.sectors[2] ? 1 : 2);
  const colors = SECTOR_COLORS.map((c) => new THREE.Color(c));
  const top = o.topColor ? new THREE.Color(o.topColor) : null;
  const wall = new THREE.Color(o.bankColor ?? "#2a2a33");

  // 4 vertices per sample: topLeft, topRight, bottomLeft, bottomRight
  for (let i = 0; i < n; i++) {
    const p = loop[i];
    const a = loop[i === 0 ? n - 2 : i - 1];
    const b = loop[i === n - 1 ? 1 : i + 1];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    const [x, y, z] = toWorld(p.x, p.y, p.z);
    const c = top ?? colors[sectorOf(p.dist)];
    pos.push(x + nx * width, y + ny * width, z, x - nx * width, y - ny * width, z);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    const run = width + (z - baseZ) * bank;
    pos.push(x + nx * run, y + ny * run, baseZ, x - nx * run, y - ny * run, baseZ);
    col.push(wall.r, wall.g, wall.b, wall.r, wall.g, wall.b);
  }
  for (let i = 0; i < n - 1; i++) {
    const o4 = i * 4;
    const q = o4 + 4;
    // top
    idx.push(o4, o4 + 1, q, o4 + 1, q + 1, q);
    // left bank (tl -> bl)
    idx.push(o4, q, o4 + 2, q, q + 2, o4 + 2);
    // right bank (tr -> br)
    idx.push(o4 + 1, o4 + 3, q + 1, q + 1, o4 + 3, q + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();

  // Edge lines on top of the ribbon: grey, with red/white kerbs along the inside of every corner.
  const edge = new THREE.Color(o.edgeColor ?? "#55555f");
  const kerbRed = new THREE.Color("#e8322e");
  const kerbWhite = new THREE.Color("#f4f4f5");
  const period = Math.max(1, o.kerbPeriod ?? 2);
  const leftCol = new Array<THREE.Color>(n).fill(edge);
  const rightCol = new Array<THREE.Color>(n).fill(edge);
  for (const c of track.corners) {
    const target = c.direction === "L" ? leftCol : rightCol;
    rangeIndices(loop, c.startDist, c.endDist).forEach((i, k) => {
      target[i] = Math.floor(k / period) % 2 === 0 ? kerbRed : kerbWhite;
    });
  }
  leftCol[n - 1] = leftCol[0];
  rightCol[n - 1] = rightCol[0];
  const lineGeom = (side: 0 | 1, cols: THREE.Color[]) => {
    const pts: number[] = [];
    const cc: number[] = [];
    for (let i = 0; i < n; i++) {
      const o4 = i * 4 + side;
      pts.push(pos[o4 * 3], pos[o4 * 3 + 1], pos[o4 * 3 + 2] + width * 0.02);
      cc.push(cols[i].r, cols[i].g, cols[i].b);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(cc, 3));
    return geom;
  };
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 });
  const leftLine = new THREE.Line(lineGeom(0, leftCol), lineMat);
  const rightLine = new THREE.Line(lineGeom(1, rightCol), lineMat);

  // Raised strips just inside each edge: white lines on the straights, red/white kerb blocks in corners.
  let strips: THREE.BufferGeometry | null = null;
  if (o.edgeStrip && o.edgeStrip > 0) {
    const sp: number[] = [];
    const sc: number[] = [];
    const si: number[] = [];
    const lift = width * 0.012;
    for (let i = 0; i < n; i++) {
      const tl = i * 4;
      const tr = i * 4 + 1;
      const [lx, ly, lz] = [pos[tl * 3], pos[tl * 3 + 1], pos[tl * 3 + 2]];
      const [rx, ry, rz] = [pos[tr * 3], pos[tr * 3 + 1], pos[tr * 3 + 2]];
      const ex = rx - lx;
      const ey = ry - ly;
      const el = Math.hypot(ex, ey) || 1;
      const ux = ex / el;
      const uy = ey / el;
      const w = o.edgeStrip;
      // left strip: outer (edge) and inner
      sp.push(lx, ly, lz + lift, lx + ux * w, ly + uy * w, lz + lift);
      sp.push(rx, ry, rz + lift, rx - ux * w, ry - uy * w, rz + lift);
      const lc = leftCol[i];
      const rc = rightCol[i];
      sc.push(lc.r, lc.g, lc.b, lc.r, lc.g, lc.b, rc.r, rc.g, rc.b, rc.r, rc.g, rc.b);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = i * 4;
      const b = a + 4;
      si.push(a, a + 1, b, a + 1, b + 1, b);
      si.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
    }
    strips = new THREE.BufferGeometry();
    strips.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    strips.setAttribute("color", new THREE.Float32BufferAttribute(sc, 3));
    strips.setIndex(si);
    strips.computeVertexNormals();
  }

  const sf = loop[0];
  const [sx, sy, sz] = toWorld(sf.x, sf.y, sf.z);
  const sfPos = new THREE.Vector3(sx, sy, sz + width * 0.27);
  const sfDir = Math.atan2(loop[1].y - sf.y, loop[1].x - sf.x);

  // Grandstands as boxes on the ground outside the two main straights.
  const m = (width * 2) / s; // metres per ribbon width
  const stands = grandstands(track, { offset: m * 1.4, depth: m * 0.9, block: m * 6, gap: m * 1.4 }).flatMap((gs) =>
    gs.blocks.map((b) => {
      const mx = (b[0].x + b[1].x + b[2].x + b[3].x) / 4;
      const my = (b[0].y + b[1].y + b[2].y + b[3].y) / 4;
      const len = Math.hypot(b[1].x - b[0].x, b[1].y - b[0].y) * s;
      const dep = Math.hypot(b[3].x - b[0].x, b[3].y - b[0].y) * s;
      const rot = Math.atan2(b[1].y - b[0].y, b[1].x - b[0].x);
      const height = width * 2;
      return { pos: [(mx - cx) * s, (my - cy) * s, baseZ + height / 2] as [number, number, number], size: [len, dep, height] as [number, number, number], rot };
    }),
  );

  const corners: CornerFrame[] = track.corners.map((c) => {
    const p = loop[c.index];
    const nrm = insideNormal(loop, c.index, c.direction);
    const a = loop[c.index === 0 ? n - 2 : c.index - 1];
    const b = loop[(c.index + 1) % (n - 1)];
    return { number: c.number, pos: toWorld(p.x, p.y, p.z), inside: [nrm.x, nrm.y], heading: Math.atan2(b.y - a.y, b.x - a.x) };
  });

  return { g, leftLine, rightLine, strips, sfPos, sfDir, baseZ, scale: s, halfWidth: width, stands, corners, toWorld, centre: [0, 0], extent: extentM * s };
}

/** True when the visitor asked the OS for less motion; read once per mount, false during SSR. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

const IDLE = new THREE.Color("#5c5c68");
const LIT = new THREE.Color("#f4f4f5");

interface MarkerProps {
  frame: CornerFrame;
  halfWidth: number;
  active: boolean;
  reduced: boolean;
  onActiveCorner?: (n: number | null) => void;
  onSelectCorner?: (n: number) => void;
}

/** One corner: a flat ring on the ribbon at the apex and a short pylon on the inside edge. */
function CornerMarker({ frame, halfWidth, active, reduced, onActiveCorner, onSelectCorner }: MarkerProps) {
  const ring = useRef<THREE.Group>(null);
  const pylon = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null);
  const pylonMat = useRef<THREE.MeshStandardMaterial>(null);
  const [x, y, z] = frame.pos;
  const px = x + frame.inside[0] * halfWidth * 1.35;
  const py = y + frame.inside[1] * halfWidth * 1.35;
  const pylonH = halfWidth * 2.4;

  useFrame(({ clock }) => {
    const k = 0.22;
    for (const m of [ringMat.current, pylonMat.current]) {
      if (!m) continue;
      // Ease towards the lit state so a hover does not snap.
      m.emissiveIntensity += ((active ? 1.6 : 0.2) - m.emissiveIntensity) * k;
      m.color.lerp(active ? LIT : IDLE, k);
      m.emissive.copy(m.color);
    }
    const t = clock.getElapsedTime();
    const pulse = active ? (reduced ? 1.3 : 1.3 + 0.12 * Math.sin(t * 6)) : 1;
    if (ring.current) ring.current.scale.x += (pulse - ring.current.scale.x) * k;
    if (ring.current) ring.current.scale.y = ring.current.scale.x;
    if (pylon.current) {
      const s = active ? 1.7 : 1;
      pylon.current.scale.x += (s - pylon.current.scale.x) * k;
      pylon.current.scale.z = pylon.current.scale.x;
    }
    if (halo.current) {
      const target = active ? (reduced ? 0.35 : 0.3 + 0.15 * Math.sin(t * 6 + 1)) : 0;
      halo.current.opacity += (target - halo.current.opacity) * k;
    }
  });

  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        onActiveCorner?.(frame.number);
      }}
      onPointerOut={() => onActiveCorner?.(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelectCorner?.(frame.number);
      }}
    >
      {/* Generous invisible hit volume so a pointer near the apex counts as hovering the corner. */}
      <mesh position={[x, y, z + pylonH * 0.5]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <cylinderGeometry args={[halfWidth * 1.9, halfWidth * 1.9, pylonH * 1.6, 8]} />
        <meshBasicMaterial />
      </mesh>
      <group ref={ring} position={[x, y, z + halfWidth * 0.04]}>
        <mesh>
          <torusGeometry args={[halfWidth * 0.78, halfWidth * 0.09, 8, 40]} />
          <meshStandardMaterial ref={ringMat} color={IDLE} emissive={IDLE} emissiveIntensity={0.2} roughness={0.5} />
        </mesh>
        {/* Soft halo disc under the ring, only visible while active. */}
        <mesh position={[0, 0, -halfWidth * 0.01]} raycast={() => null}>
          <circleGeometry args={[halfWidth * 1.6, 32]} />
          <meshBasicMaterial ref={halo} color="#f4f4f5" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <mesh ref={pylon} position={[px, py, z + pylonH / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[halfWidth * 0.13, halfWidth * 0.17, pylonH, 10]} />
        <meshStandardMaterial ref={pylonMat} color={IDLE} emissive={IDLE} emissiveIntensity={0.2} roughness={0.5} />
      </mesh>
      {active && <NumberBadge number={frame.number} position={[px, py, z + pylonH + halfWidth * 1.1]} size={halfWidth * 2.8} />}
    </group>
  );
}

/** A canvas-drawn "T5" badge as a sprite, always facing the camera. */
export function NumberBadge({ number, position, size, depthTest = false }: { number: number; position: [number, number, number]; size: number; depthTest?: boolean }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f4f4f5";
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b0b0f";
      ctx.font = `800 ${number > 9 ? 56 : 62}px "Barlow Condensed", "Arial Narrow", Impact, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`T${number}`, 64, 68);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [number]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial map={texture} depthTest={depthTest} transparent />
    </sprite>
  );
}

interface MarkersProps {
  built: Built;
  activeCorner: number | null;
  onActiveCorner?: (n: number | null) => void;
  onSelectCorner?: (n: number) => void;
}

export function CornerMarkers({ built, activeCorner, onActiveCorner, onSelectCorner }: MarkersProps) {
  const reduced = useReducedMotion();
  return (
    <>
      {built.corners.map((f) => (
        <CornerMarker key={f.number} frame={f} halfWidth={built.halfWidth} active={activeCorner === f.number} reduced={reduced} onActiveCorner={onActiveCorner} onSelectCorner={onSelectCorner} />
      ))}
    </>
  );
}

interface SceneProps {
  built: Built;
  /** Ground plane size in world units. */
  groundSize?: number;
  groundColor?: string;
  /** Show the ground grid (the overview does, the driver view does not). */
  grid?: boolean;
  standsColor?: string;
  /** "bar": a raised white block across the road (overview); "gantry": a painted line under an overhead gantry (onboard). */
  startLine?: "bar" | "gantry";
  children?: React.ReactNode;
}

/** Ribbon, edge lines, start line, grandstands and ground. Lights and fog are left to the caller. */
export function TrackScene({ built, groundSize = 400, groundColor = "#111116", grid = true, standsColor = "#3a3a46", startLine = "bar", children }: SceneProps) {
  const w = built.halfWidth;
  return (
    <group>
      <mesh geometry={built.g}>
        <meshStandardMaterial vertexColors roughness={0.75} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      {built.strips ? (
        <mesh geometry={built.strips}>
          <meshStandardMaterial vertexColors roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ) : (
        <>
          <primitive object={built.leftLine} />
          <primitive object={built.rightLine} />
        </>
      )}
      {/* Start/finish marker */}
      {startLine === "bar" ? (
        <mesh position={built.sfPos} rotation={[0, 0, built.sfDir]}>
          <boxGeometry args={[w * 0.45, w * 2.9, w * 0.27]} />
          <meshStandardMaterial color="#f4f4f5" />
        </mesh>
      ) : (
        <group position={[built.sfPos.x, built.sfPos.y, built.sfPos.z - w * 0.27]} rotation={[0, 0, built.sfDir]}>
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[0.7, w * 2, 0.02]} />
            <meshStandardMaterial color="#f4f4f5" />
          </mesh>
          {[-1, 1].map((sgn) => (
            <mesh key={sgn} position={[0, sgn * (w + 1.2), 3.6]}>
              <boxGeometry args={[0.5, 0.5, 7.2]} />
              <meshStandardMaterial color="#2a2a33" roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0, 0, 6.9]}>
            <boxGeometry args={[0.7, w * 2 + 2.9, 0.9]} />
            <meshStandardMaterial color="#2a2a33" roughness={0.9} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[-0.4, (i - 2) * 0.7, 6.9]}>
              <sphereGeometry args={[0.16, 10, 8]} />
              <meshStandardMaterial color="#3a1414" emissive="#ff3b30" emissiveIntensity={0.25} />
            </mesh>
          ))}
        </group>
      )}
      {built.stands.map((st, i) => (
        <mesh key={i} position={st.pos} rotation={[0, 0, st.rot]}>
          <boxGeometry args={st.size} />
          <meshStandardMaterial color={standsColor} roughness={0.9} />
        </mesh>
      ))}
      {children}
      {/* Ground */}
      <mesh position={[built.centre[0], built.centre[1], built.baseZ - w * 0.05]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color={groundColor} roughness={1} />
      </mesh>
      {grid && <gridHelper args={[groundSize, 80, "#1f1f27", "#17171d"]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, built.baseZ - w * 0.02]} />}
    </group>
  );
}
