import { buildPoster } from "../poster";
import type { Homologation } from "./homologation";
import type { Pt2, Sample, Track } from "./types";

export interface Fit {
  scale: number;
  /** Map a loop point (metres, y up) to SVG coordinates (y down). */
  map: (p: Pt2) => Pt2;
  width: number;
  height: number;
}

/** Fit a point cloud into a box (SVG y-down) with uniform scale and padding. */
export function fitToBox(
  pts: Pt2[],
  box: { x: number; y: number; width: number; height: number },
  padding = 0,
): Fit {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1e-9);
  const h = Math.max(maxY - minY, 1e-9);
  const scale = Math.min((box.width - 2 * padding) / w, (box.height - 2 * padding) / h);
  const drawnW = w * scale;
  const drawnH = h * scale;
  const ox = box.x + (box.width - drawnW) / 2;
  const oy = box.y + (box.height - drawnH) / 2;
  return {
    scale,
    width: drawnW,
    height: drawnH,
    map: (p) => ({ x: ox + (p.x - minX) * scale, y: oy + (maxY - p.y) * scale }),
  };
}

export function pathD(pts: Pt2[], fit: Fit, close = false): string {
  if (pts.length === 0) return "";
  const parts = pts.map((p, i) => {
    const q = fit.map(p);
    return `${i === 0 ? "M" : "L"}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
  });
  return parts.join("") + (close ? "Z" : "");
}

/** Split a closed loop into sector polylines at the given boundary distances. Boundary points are duplicated. */
export function splitSectors(loop: Sample[], sectors: [number, number, number]): Sample[][] {
  const bounds = [sectors[1], sectors[2]];
  const out: Sample[][] = [[], [], []];
  let s = 0;
  for (const p of loop) {
    while (s < 2 && p.dist > bounds[s]) {
      out[s].push(p);
      s++;
    }
    out[s].push(p);
  }
  return out;
}

/** Outward unit normal at loop index i (away from the loop centroid). */
export function outwardNormal(loop: Pt2[], i: number): Pt2 {
  const n = loop.length - 1;
  const a = loop[((i - 1) % n + n) % n];
  const b = loop[(i + 1) % n];
  const tx = b.x - a.x;
  const ty = b.y - a.y;
  const l = Math.hypot(tx, ty) || 1;
  let nx = -ty / l;
  let ny = tx / l;
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < n; k++) {
    cx += loop[k].x;
    cy += loop[k].y;
  }
  cx /= n;
  cy /= n;
  const p = loop[i];
  if ((p.x + nx - cx) ** 2 + (p.y + ny - cy) ** 2 < (p.x - nx - cx) ** 2 + (p.y - ny - cy) ** 2) {
    nx = -nx;
    ny = -ny;
  }
  return { x: nx, y: ny };
}

export interface PosterOptions {
  width?: number;
  height?: number;
  /** CSS font-family for the display type. */
  fontFamily?: string;
  /** Optional <style> content (e.g. an embedded @font-face). */
  extraStyle?: string;
  /** Year shown as "Homologated". */
  homologatedYear?: number;
  /** Length-reference circuit name for the footer. */
  lengthReference?: string;
  /** Pre-computed homologation; computed from the track when omitted. */
  homologation?: Homologation;
  /** Corner-count limit for drawing place names next to the numbers. */
  maxNamedCorners?: number;
}

/** The original dark sector poster. Kept as a thin wrapper over the style system in `src/lib/poster`. */
export function buildPosterSvg(track: Track, opts: PosterOptions = {}): string {
  return buildPoster(
    track,
    { style: "sector", size: { width: opts.width ?? 1200, height: opts.height ?? 1800 } },
    {
      homologation: opts.homologation,
      homologatedYear: opts.homologatedYear,
      lengthReference: opts.lengthReference,
      fontFace: opts.extraStyle,
      displayFamily: opts.fontFamily,
      maxNamedCorners: opts.maxNamedCorners,
    },
  );
}

/** Rasterise an SVG string to a PNG Blob in the browser. */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Failed to load SVG for rasterisation"));
      i.src = url;
    });
    const m = svg.match(/width="(\d+)" height="(\d+)"/);
    const w = m ? Number(m[1]) : img.width;
    const h = m ? Number(m[2]) : img.height;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
