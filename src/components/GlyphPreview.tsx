"use client";

import { useMemo } from "react";
import { fitToBox, pathD } from "@/lib/geo/svg";
import type { Glyph } from "@/lib/geo/types";

/** Shows a normalised glyph in a cap-height box, with entry (filled) and exit (hollow) markers. */
export default function GlyphPreview({ glyph, size = 160, color = "#e8322e" }: { glyph: Glyph | null; size?: number; color?: string }) {
  const content = useMemo(() => {
    if (!glyph) return null;
    const fit = fitToBox([{ x: 0, y: 0 }, { x: Math.max(glyph.width, 1), y: 1 }, ...glyph.pts], { x: 0, y: 0, width: size, height: size }, size * 0.12);
    const d = pathD(glyph.pts, fit);
    const base0 = fit.map({ x: 0, y: 0 });
    const base1 = fit.map({ x: Math.max(glyph.width, 1), y: 0 });
    const top = fit.map({ x: 0, y: 1 });
    const en = fit.map(glyph.entry);
    const ex = fit.map(glyph.exit);
    return (
      <>
        <line x1={base0.x} y1={base0.y} x2={base1.x} y2={base1.y} stroke="#52525b" strokeDasharray="4 4" />
        <line x1={base0.x} y1={top.y} x2={base1.x} y2={top.y} stroke="#52525b" strokeDasharray="4 4" />
        <path d={d} fill="none" stroke={color} strokeWidth={size * 0.035} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={en.x} cy={en.y} r={size * 0.03} fill="#f4f4f5" />
        <circle cx={ex.x} cy={ex.y} r={size * 0.03} fill="none" stroke="#f4f4f5" strokeWidth={2} />
      </>
    );
  }, [glyph, size, color]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="rounded-lg bg-zinc-900 border border-zinc-800">
      {content}
    </svg>
  );
}
