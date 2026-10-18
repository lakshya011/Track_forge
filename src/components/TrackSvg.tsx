"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CarTopSymbol, GHOST_COLOURS, carTopStyle, type CarTopColours } from "@/components/CarTopSvg";
import {
  brakingBoards,
  cornerName,
  drsDetection,
  elevationSkin,
  grandstands,
  gravelTraps,
  kerbs,
  rampHex,
  rangeSamples,
  sectorFlags,
} from "@/lib/geo/decor";
import { formatLapTime } from "@/lib/geo/homologation";
import type { LapProfile } from "@/lib/geo/speed";
import { fitToBox, outwardNormal, pathD, splitSectors } from "@/lib/geo/svg";
import type { Track } from "@/lib/geo/types";
import type { LapClock } from "@/lib/hooks/useLapClock";

export type TrackDetail = "outline" | "full";
export type TrackSkin = "sector" | "elevation";

interface Props {
  track: Track;
  /** "outline" is the clean loop used while the circuit draws on; "full" adds every piece of furniture. */
  detail?: TrackDetail;
  skin?: TrackSkin;
  width?: number;
  height?: number;
  /** Animate the track drawing on when mounted. */
  animate?: boolean;
  /** Start lights above the line: how many of the five are lit. Omit to hide the gantry. */
  lights?: number | null;
  /** The shared lap clock; with it the ghost car laps the map. Omit to hide the car. */
  clock?: LapClock;
  /** Speed profile for the lap: the car brakes for corners. Without it the car runs at one speed. */
  profile?: LapProfile;
  /** Livery for the car; defaults to the ghost yellow. */
  carColours?: CarTopColours;
  /** Corner number to highlight (e.g. from a hovered list card). */
  activeCorner?: number | null;
  onActiveCorner?: (n: number | null) => void;
  className?: string;
}

export const SECTOR_COLORS = ["#e8322e", "#3dd68c", "#f5c542"] as const;

const ASPHALT = "#2a2a33";
const EDGE = "#e4e4e7";
const INK = "#0b0b0f";

export default function TrackSvg({
  track,
  detail = "full",
  skin = "sector",
  width = 1000,
  height = 620,
  animate,
  lights = null,
  clock,
  profile,
  carColours = GHOST_COLOURS,
  activeCorner = null,
  onActiveCorner,
  className,
}: Props) {
  const id = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const clockRef = useRef<SVGTextElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const highlighted = hover ?? activeCorner;

  const fit = useMemo(() => fitToBox(track.loop, { x: 0, y: 0, width, height }, 64), [track, width, height]);
  const sw = Math.max(5, Math.min(width, height) * 0.015);
  /** Metres per stroke width, for offsets computed in track space. */
  const m = sw / fit.scale;
  const map = fit.map;

  const full = useMemo(() => pathD(track.loop, fit), [track, fit]);
  const sectors = useMemo(() => splitSectors(track.loop, track.sectors).map((pts) => pathD(pts, fit)), [track, fit]);

  const furniture = useMemo(() => {
    if (detail !== "full") return null;
    const asphaltHalf = 0.95 * m;
    return {
      kerbs: kerbs(track, 0.62 * m),
      gravel: gravelTraps(track, { edge: asphaltHalf + 0.15 * m, depth: 2.4 * m }),
      boards: brakingBoards(track),
      flags: sectorFlags(track),
      drs: drsDetection(track),
      stands: grandstands(track, { offset: asphaltHalf + 0.55 * m, depth: 1.25 * m, block: 9 * m, gap: 2 * m }),
      straight: pathD(rangeSamples(track.loop, track.longestStraight.startDist, track.longestStraight.endDist), fit),
    };
  }, [track, detail, m, fit]);

  const elevationChunks = useMemo(() => {
    if (skin !== "elevation") return null;
    const z = elevationSkin(track.loop);
    const step = 4;
    const out: { d: string; color: string }[] = [];
    for (let i = 0; i < track.loop.length - 1; i += step) {
      const end = Math.min(track.loop.length - 1, i + step);
      let avg = 0;
      for (let k = i; k <= end; k++) avg += z[k];
      avg /= end - i + 1;
      out.push({ d: pathD(track.loop.slice(i, end + 1), fit), color: rampHex(avg) });
    }
    return out;
  }, [track, fit, skin]);

  // Ghost car: SMIL moves the car along the route; the shared clock is the source of truth. Every
  // frame the SMIL document time is nudged back onto the clock, so seeking, pausing and the driver
  // view all stay in step. Hovering the map holds the clock (and so the car).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !clock) return;
    let smilRunning = true;
    const sync = (t: number) => {
      if (clockRef.current) clockRef.current.textContent = formatLapTime(t);
      try {
        const running = clock.running();
        if (running !== smilRunning) {
          smilRunning = running;
          if (running) svg.unpauseAnimations();
          else svg.pauseAnimations();
        }
        if (Math.abs(svg.getCurrentTime() - t) > 0.05) svg.setCurrentTime(t);
      } catch {
        /* engines without SMIL control */
      }
    };
    const unsubscribe = clock.subscribe(sync);
    sync(clock.now());
    const hold = () => clock.hold(true);
    const release = () => clock.hold(false);
    svg.addEventListener("pointerenter", hold);
    svg.addEventListener("pointerleave", release);
    return () => {
      unsubscribe();
      release();
      svg.removeEventListener("pointerenter", hold);
      svg.removeEventListener("pointerleave", release);
    };
  }, [clock, track]);

  const sf = map(track.loop[0]);
  const n0 = outwardNormal(track.loop, 0);
  const tick = sw * 1.5;
  const drawClass = animate ? "draw-on-slow" : undefined;
  const drawLen = animate ? 1 : undefined;

  const setActive = (n: number | null) => {
    setHover(n);
    onActiveCorner?.(n);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Circuit map for ${track.name}: ${track.corners.length} corners over ${(track.length / 1000).toFixed(3)} km`}
    >
      <defs>
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={sw * 0.6} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-grain`} x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.62  0 0 0 0 0.68  0 0 0 0.5 0" result="tint" />
          <feComposite in="tint" in2="SourceGraphic" operator="in" result="clipped" />
          <feBlend in="clipped" in2="SourceGraphic" mode="overlay" />
        </filter>
        <pattern id={`${id}-gravel`} patternUnits="userSpaceOnUse" width={sw * 0.5} height={sw * 0.5}>
          <rect width={sw * 0.5} height={sw * 0.5} fill="#b8a16a" fillOpacity={0.28} />
          <circle cx={sw * 0.12} cy={sw * 0.12} r={sw * 0.06} fill="#d9c48e" fillOpacity={0.8} />
          <circle cx={sw * 0.37} cy={sw * 0.37} r={sw * 0.06} fill="#d9c48e" fillOpacity={0.8} />
        </pattern>
        <pattern id={`${id}-seats`} patternUnits="userSpaceOnUse" width={sw * 0.36} height={sw * 0.36}>
          <rect width={sw * 0.36} height={sw * 0.36} fill="#30303b" />
          <rect width={sw * 0.36} height={sw * 0.12} fill="#43434f" />
        </pattern>
        <path id={`${id}-route`} d={full} fill="none" />
        {clock && <CarTopSymbol id={`${id}-car`} />}
      </defs>

      {/* Grandstands */}
      {furniture?.stands.map((g) =>
        g.blocks.map((b, i) => (
          <polygon
            key={`${g.along}-${i}`}
            points={b.map((p) => {
              const q = map(p);
              return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
            }).join(" ")}
            fill={`url(#${id}-seats)`}
            stroke="#52525f"
            strokeWidth={1}
          />
        )),
      )}

      {/* Gravel traps */}
      {furniture?.gravel.map((g) => (
        <polygon
          key={g.corner.number}
          points={g.polygon.map((p) => {
            const q = map(p);
            return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
          }).join(" ")}
          fill={`url(#${id}-gravel)`}
          stroke="#b8a16a"
          strokeOpacity={0.35}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      ))}

      {/* Track edges and asphalt */}
      <path d={full} fill="none" stroke={EDGE} strokeOpacity={0.9} strokeWidth={sw * 2.05} strokeLinecap="round" strokeLinejoin="round" />
      <path d={full} fill="none" stroke={ASPHALT} strokeWidth={sw * 1.9} strokeLinecap="round" strokeLinejoin="round" filter={detail === "full" ? `url(#${id}-grain)` : undefined} />

      {/* Racing line: sector colours or the elevation skin */}
      {detail === "outline" ? (
        <path d={full} fill="none" stroke="#f4f4f5" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" pathLength={drawLen} className={drawClass} />
      ) : skin === "elevation" && elevationChunks ? (
        elevationChunks.map((c, i) => <path key={i} d={c.d} fill="none" stroke={c.color} strokeWidth={sw * 0.95} strokeLinecap="butt" strokeLinejoin="round" />)
      ) : (
        sectors.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={SECTOR_COLORS[i]} strokeWidth={sw * 0.95} strokeLinecap="round" strokeLinejoin="round" pathLength={drawLen} className={drawClass} />
        ))
      )}

      {/* Kerbs: white base with red dashes shifted half a period */}
      {furniture?.kerbs.map((k) => {
        const d = pathD(k.pts, fit);
        const dash = sw * 0.55;
        return (
          <g key={k.corner.number}>
            <path d={d} fill="none" stroke="#f4f4f5" strokeWidth={sw * 0.3} strokeLinecap="butt" />
            <path d={d} fill="none" stroke="#e8322e" strokeWidth={sw * 0.3} strokeLinecap="butt" strokeDasharray={`${dash} ${dash}`} strokeDashoffset={dash / 2} />
          </g>
        );
      })}

      {/* DRS zone along the longest straight */}
      {furniture && (
        <path d={furniture.straight} fill="none" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={sw * 0.22} strokeDasharray={`${sw * 0.8} ${sw * 0.6}`} strokeLinecap="round" />
      )}

      {/* Braking boards */}
      {furniture?.boards.map((b) => {
        const a = map({ x: b.p.x + b.n.x * 1.05 * m, y: b.p.y + b.n.y * 1.05 * m });
        const len = b.metres === 100 ? 0.55 : 0.38;
        const c = map({ x: b.p.x + b.n.x * (1.05 + len) * m, y: b.p.y + b.n.y * (1.05 + len) * m });
        return <line key={`${b.corner.number}-${b.metres}`} x1={a.x} y1={a.y} x2={c.x} y2={c.y} stroke="#f4f4f5" strokeOpacity={0.75} strokeWidth={Math.max(1.2, sw * 0.14)} strokeLinecap="round" />;
      })}

      {/* Sector flags */}
      {furniture?.flags.map((f, i) => {
        const base = map({ x: f.p.x + f.n.x * 1.3 * m, y: f.p.y + f.n.y * 1.3 * m });
        const top = map({ x: f.p.x + f.n.x * 3.1 * m, y: f.p.y + f.n.y * 3.1 * m });
        const sx = top.x - base.x;
        const sy = top.y - base.y;
        const px = -sy;
        const py = sx;
        const color = SECTOR_COLORS[i + 1];
        return (
          <g key={i} filter={`url(#${id}-glow)`}>
            <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke="#f4f4f5" strokeWidth={Math.max(1.2, sw * 0.14)} strokeLinecap="round" />
            <polygon points={`${top.x},${top.y} ${top.x + px * 0.42},${top.y + py * 0.42} ${top.x - sx * 0.42},${top.y - sy * 0.42}`} fill={color} />
            <text x={top.x + px * 0.6} y={top.y + py * 0.6} fill={color} fontSize={sw * 1.05} fontWeight={700} textAnchor="middle" dominantBaseline="middle" className="display">
              S{i + 2}
            </text>
          </g>
        );
      })}

      {/* DRS detection line */}
      {furniture?.drs && (() => {
        const d = furniture.drs;
        const a = map({ x: d.p.x + d.n.x * 1.1 * m, y: d.p.y + d.n.y * 1.1 * m });
        const b = map({ x: d.p.x - d.n.x * 1.1 * m, y: d.p.y - d.n.y * 1.1 * m });
        const lbl = map({ x: d.p.x + d.n.x * 2.2 * m, y: d.p.y + d.n.y * 2.2 * m });
        return (
          <g>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3dd68c" strokeWidth={Math.max(1.5, sw * 0.18)} strokeDasharray={`${sw * 0.25} ${sw * 0.2}`} />
            <text x={lbl.x} y={lbl.y} fill="#3dd68c" fontSize={sw * 0.95} fontWeight={700} textAnchor="middle" dominantBaseline="middle" letterSpacing={1} className="display">
              DRS
            </text>
          </g>
        );
      })()}

      {/* Start / finish */}
      <line x1={sf.x - n0.x * tick} y1={sf.y + n0.y * tick} x2={sf.x + n0.x * tick} y2={sf.y - n0.y * tick} stroke="#f4f4f5" strokeWidth={sw * 0.5} strokeLinecap="round" />
      <line x1={sf.x - n0.x * tick} y1={sf.y + n0.y * tick} x2={sf.x + n0.x * tick} y2={sf.y - n0.y * tick} stroke={INK} strokeWidth={sw * 0.18} strokeDasharray={`${sw * 0.3} ${sw * 0.3}`} />

      {/* Corner badges and names */}
      {detail === "full" &&
        track.corners.map((c) => {
          const nrm = outwardNormal(track.loop, c.index);
          const p = map({ x: c.apex.x + nrm.x * 2.5 * m, y: c.apex.y + nrm.y * 2.5 * m });
          const apex = map(c.apex);
          const r = Math.max(11, sw * 1.15);
          const active = highlighted === c.number;
          const label = cornerName(c, track.sources);
          const fs = Math.max(11, sw * 1.2);
          const w = label.length * fs * 0.56 + fs * 1.2;
          const labelLeft = p.x > width * 0.72;
          const lx = labelLeft ? p.x - r - 6 - w : p.x + r + 6;
          const ly = p.y - fs * 0.95;
          return (
            <g
              key={c.number}
              onPointerEnter={() => setActive(c.number)}
              onPointerLeave={() => setActive(null)}
              style={{ cursor: "default" }}
            >
              {active && <circle cx={apex.x} cy={apex.y} r={sw * 0.5} fill="none" stroke="#f4f4f5" strokeWidth={2} className="pulse-ring" />}
              <circle cx={apex.x} cy={apex.y} r={sw * 0.42} fill={INK} stroke="#f4f4f5" strokeWidth={1.5} />
              <line x1={apex.x} y1={apex.y} x2={p.x} y2={p.y} stroke="#f4f4f5" strokeOpacity={active ? 0.7 : 0.25} strokeWidth={1} />
              <circle cx={p.x} cy={p.y} r={active ? r * 1.12 : r} fill={active ? "#f4f4f5" : INK} stroke={c.direction === "L" ? "#60a5fa" : "#fb923c"} strokeWidth={2} />
              <text x={p.x} y={p.y + 0.5} fill={active ? INK : "#f4f4f5"} fontSize={r * 1.1} fontWeight={700} textAnchor="middle" dominantBaseline="middle" className="display">
                {c.number}
              </text>
              {active && (
                <g>
                  <rect x={lx} y={ly} width={w} height={fs * 1.9} rx={fs * 0.4} fill={INK} fillOpacity={0.92} stroke="#52525f" />
                  <text x={lx + fs * 0.6} y={ly + fs * 0.95} fill="#f4f4f5" fontSize={fs} fontWeight={600} dominantBaseline="middle" className="display">
                    {label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

      {/* Ghost car and lap clock */}
      {clock && (() => {
        // About four road widths long: oversized against the road, like a map pin, so it reads as a car.
        const len = sw * 4.4;
        const hgt = (len * 48) / 112;
        return (
          <>
            <g style={carTopStyle(carColours)}>
              <use href={`#${id}-car`} x={-len / 2} y={-hgt / 2} width={len} height={hgt} />
              {profile ? (
                <animateMotion dur={`${clock.lapSeconds.toFixed(3)}s`} repeatCount="indefinite" rotate="auto" calcMode="linear" keyPoints={profile.keyPoints} keyTimes={profile.keyTimes}>
                  <mpath href={`#${id}-route`} />
                </animateMotion>
              ) : (
                <animateMotion dur={`${clock.lapSeconds.toFixed(3)}s`} repeatCount="indefinite" rotate="auto" calcMode="linear">
                  <mpath href={`#${id}-route`} />
                </animateMotion>
              )}
            </g>
            <g>
              <rect x={width - 182} y={14} width={168} height={40} rx={8} fill={INK} fillOpacity={0.85} stroke="#2a2a33" />
              <circle cx={width - 164} cy={34} r={5} fill={carColours.c1} />
              <text x={width - 152} y={35} fill="#8b8b94" fontSize={12} letterSpacing={2} dominantBaseline="middle">
                GHOST
              </text>
              <text ref={clockRef} x={width - 26} y={35} fill="#f4f4f5" fontSize={20} fontWeight={700} textAnchor="end" dominantBaseline="middle" className="display tabular">
                0:00.000
              </text>
            </g>
          </>
        );
      })()}

      {/* Start lights gantry */}
      {lights !== null && (() => {
        const gx = sf.x;
        const gy = sf.y - sw * 3.4;
        const gap = sw * 1.15;
        const r = sw * 0.42;
        const w = gap * 4 + r * 2 + sw * 0.9;
        return (
          <g>
            <line x1={gx} y1={gy + sw * 0.9} x2={gx} y2={sf.y - sw * 1.3} stroke="#52525f" strokeWidth={2} />
            <rect x={gx - w / 2} y={gy - r - sw * 0.45} width={w} height={r * 2 + sw * 0.9} rx={sw * 0.35} fill="#15151a" stroke="#3a3a44" />
            {[0, 1, 2, 3, 4].map((i) => {
              const lit = i < lights;
              return <circle key={i} cx={gx - gap * 2 + i * gap} cy={gy} r={r} fill={lit ? "#ff3b30" : "#3a1414"} stroke={lit ? "#ff8a80" : "#2a2a33"} strokeWidth={1} filter={lit ? `url(#${id}-glow)` : undefined} />;
            })}
          </g>
        );
      })()}
    </svg>
  );
}
