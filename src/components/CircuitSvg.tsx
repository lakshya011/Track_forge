"use client";

import { useMemo } from "react";
import { circuitSamples } from "@/lib/geo/section";
import { fitToBox, pathD } from "@/lib/geo/svg";
import type { Circuit, LetterSection, Sample } from "@/lib/geo/types";

interface Props {
  circuit: Circuit;
  /** Highlight this section's range on top of the grey outline. */
  highlight?: Pick<LetterSection, "start" | "end"> | null;
  size?: number;
  /** Draw distance tick labels every `ticks` metres. */
  ticks?: number;
  className?: string;
  baseColor?: string;
  highlightColor?: string;
  strokeWidth?: number;
  onPick?: (dist: number) => void;
  /** Animate the highlight drawing on. */
  animate?: boolean;
  children?: React.ReactNode;
}

export function sectionPoints(ring: Sample[], start: number, end: number): Sample[] {
  const total = ring[ring.length - 1].dist;
  const s = ((start % total) + total) % total;
  const e = ((end % total) + total) % total;
  if (e >= s) return ring.filter((p) => p.dist >= s && p.dist <= e);
  return [...ring.filter((p) => p.dist >= s), ...ring.filter((p) => p.dist <= e)];
}

export default function CircuitSvg({
  circuit,
  highlight,
  size = 320,
  ticks,
  className,
  baseColor = "#3f3f46",
  highlightColor = "#e8322e",
  strokeWidth,
  onPick,
  animate,
  children,
}: Props) {
  const ring = useMemo(() => circuitSamples(circuit), [circuit]);
  const fit = useMemo(() => fitToBox(ring, { x: 0, y: 0, width: size, height: size }, size * 0.08), [ring, size]);
  const sw = strokeWidth ?? Math.max(2, size * 0.012);
  const d = useMemo(() => pathD(ring, fit), [ring, fit]);
  const hl = highlight ? sectionPoints(ring, highlight.start, highlight.end) : [];
  const hd = hl.length > 1 ? pathD(hl, fit) : "";

  const tickEls = useMemo(() => {
    if (!ticks) return null;
    const total = ring[ring.length - 1].dist;
    const els = [];
    for (let t = 0; t < total; t += ticks) {
      let lo = 0;
      let hi = ring.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ring[mid].dist <= t) lo = mid;
        else hi = mid;
      }
      const p = fit.map(ring[lo]);
      els.push(
        <g key={t}>
          <circle cx={p.x} cy={p.y} r={sw * 0.9} fill="#0b0b0f" stroke="#a1a1aa" strokeWidth={1} />
          <text x={p.x + sw * 1.5} y={p.y - sw} fill="#a1a1aa" fontSize={Math.max(8, size * 0.03)}>
            {t}
          </text>
        </g>,
      );
    }
    return els;
  }, [ticks, ring, fit, sw, size]);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * size;
    const y = ((e.clientY - rect.top) / rect.height) * size;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < ring.length - 1; i++) {
      const p = fit.map(ring[i]);
      const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    onPick(ring[best].dist);
  };

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      className={className}
      onClick={onPick ? handleClick : undefined}
      style={onPick ? { cursor: "crosshair" } : undefined}
    >
      <path d={d} fill="none" stroke={baseColor} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      {hd && (
        <path
          d={hd}
          fill="none"
          stroke={highlightColor}
          strokeWidth={sw * 1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={animate ? 1 : undefined}
          className={animate ? "draw-on" : undefined}
        />
      )}
      {hl.length > 1 && (
        <>
          <circle cx={fit.map(hl[0]).x} cy={fit.map(hl[0]).y} r={sw * 1.4} fill="#f4f4f5" />
          <circle cx={fit.map(hl[hl.length - 1]).x} cy={fit.map(hl[hl.length - 1]).y} r={sw * 1.4} fill="none" stroke="#f4f4f5" strokeWidth={sw * 0.6} />
        </>
      )}
      {tickEls}
      {children}
    </svg>
  );
}
