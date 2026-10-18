/**
 * Letter mining: slide windows along every baked circuit, normalise each window into glyph space
 * at a set of rotations/flips, and score it against single-stroke letter templates.
 * Writes candidates to the scratch dir plus an HTML review sheet.
 *
 * Usage: npx tsx scripts/mine-letters.ts <outDir> [topN=6]
 */
import fs from "node:fs";
import path from "node:path";
import { circuitSamples, extractSection, normalizeGlyph } from "../src/lib/geo/section";
import { fitToBox, pathD } from "../src/lib/geo/svg";
import type { Circuit, LetterSection, Sample } from "../src/lib/geo/types";
import { TEMPLATES } from "./letter-templates";

const N = 32;
const ROTATIONS = Array.from({ length: 24 }, (_, i) => i * 15);
const START_STEP = 50;
const LENGTHS = Array.from({ length: 19 }, (_, i) => 300 + i * 150); // 300..3000 m

interface Cand {
  letter: string;
  score: number;
  section: LetterSection;
}

function resampleN(pts: { x: number; y: number }[], n: number): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1] || 1;
  const out: number[] = [];
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * total;
    while (seg < pts.length - 2 && cum[seg + 1] < t) seg++;
    const l = cum[seg + 1] - cum[seg];
    const u = l > 0 ? (t - cum[seg]) / l : 0;
    out.push(pts[seg].x + (pts[seg + 1].x - pts[seg].x) * u, pts[seg].y + (pts[seg + 1].y - pts[seg].y) * u);
  }
  return out;
}

/** Normalise to cap height 1, min x/y = 0; returns flattened [x0,y0,x1,y1,...] of N samples. */
function shapeVec(pts: { x: number; y: number }[]): number[] {
  const v = resampleN(pts, N);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < v.length; i += 2) {
    minX = Math.min(minX, v[i]); maxX = Math.max(maxX, v[i]);
    minY = Math.min(minY, v[i + 1]); maxY = Math.max(maxY, v[i + 1]);
  }
  const h = maxY - minY;
  const w = maxX - minX;
  const s = 1 / (h > 1e-6 ? h : w > 1e-6 ? w : 1);
  for (let i = 0; i < v.length; i += 2) {
    v[i] = (v[i] - minX) * s;
    v[i + 1] = (v[i + 1] - minY) * s;
  }
  return v;
}

function rms(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s / (a.length / 2));
}

function widthOf(v: number[]): number {
  let m = 0;
  for (let i = 0; i < v.length; i += 2) m = Math.max(m, v[i]);
  return m;
}

const tmplFwd = new Map<string, number[]>();
const tmplRev = new Map<string, number[]>();
for (const [L, stroke] of Object.entries(TEMPLATES)) {
  const pts = stroke.map(([x, y]) => ({ x, y }));
  tmplFwd.set(L, shapeVec(pts));
  tmplRev.set(L, shapeVec([...pts].reverse()));
}

function rotPts(pts: Sample[], deg: number, flip: boolean) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return pts.map((p) => {
    const x = p.x * c - p.y * s;
    const y = p.x * s + p.y * c;
    return { x: flip ? -x : x, y };
  });
}

function mine(circuits: Circuit[]): Map<string, Cand[]> {
  const best = new Map<string, Cand[]>();
  for (const L of Object.keys(TEMPLATES)) best.set(L, []);
  for (const c of circuits) {
    const ring = circuitSamples(c);
    const total = ring[ring.length - 1].dist;
    const t0 = Date.now();
    for (let start = 0; start < total; start += START_STEP) {
      for (const len of LENGTHS) {
        if (len > total * 0.6) continue;
        const end = Math.round((start + len) % total);
        const base: LetterSection = { id: "", letter: "", circuitId: c.id, start, end, reverse: false, rotation: 0, flipX: false };
        let raw: Sample[];
        try {
          raw = extractSection(c, base);
        } catch {
          continue;
        }
        // Subsample for speed (every ~20 m).
        const sub = raw.filter((_, i) => i % 2 === 0 || i === raw.length - 1);
        for (const rot of ROTATIONS) {
          for (const flip of [false, true]) {
            const v = shapeVec(rotPts(sub, rot, flip));
            const w = widthOf(v);
            if (w > 1.6 || w < 0.02) continue;
            for (const L of Object.keys(TEMPLATES)) {
              const tw = widthOf(tmplFwd.get(L)!);
              if (Math.abs(w - tw) > 0.45) continue;
              const sf = rms(v, tmplFwd.get(L)!);
              const sr = rms(v, tmplRev.get(L)!);
              const score = Math.min(sf, sr);
              const arr = best.get(L)!;
              if (arr.length >= 400 && score >= arr[arr.length - 1].score) continue;
              arr.push({
                letter: L,
                score,
                section: { ...base, id: `${L}-${c.id}-${start}`, letter: L, rotation: rot, flipX: flip, reverse: sr < sf },
              });
              arr.sort((a, b) => a.score - b.score);
              if (arr.length > 400) arr.length = 400;
            }
          }
        }
      }
    }
    console.error(`${c.id} scanned in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  return best;
}

/** Keep the best per circuit, suppress overlapping windows, return top N with distinct circuits first. */
function select(cands: Cand[], topN: number): Cand[] {
  const out: Cand[] = [];
  const perCircuit = new Map<string, number>();
  for (const cnd of cands) {
    const s = cnd.section;
    const overlaps = out.some((o) => {
      if (o.section.circuitId !== s.circuitId) return false;
      const a0 = s.start, a1 = s.end < s.start ? s.end + 1e9 : s.end;
      const b0 = o.section.start, b1 = o.section.end < o.section.start ? o.section.end + 1e9 : o.section.end;
      return Math.min(a1, b1) - Math.max(a0, b0) > 0.3 * Math.min(a1 - a0, b1 - b0);
    });
    if (overlaps) continue;
    const n = perCircuit.get(s.circuitId) ?? 0;
    if (n >= 2) continue;
    perCircuit.set(s.circuitId, n + 1);
    out.push(cnd);
    if (out.length >= topN) break;
  }
  return out;
}

function glyphSvg(c: Circuit, s: LetterSection, size = 105): string {
  const g = normalizeGlyph(extractSection(c, s), s);
  const fit = fitToBox([{ x: 0, y: 0 }, { x: Math.max(g.width, 1), y: 1 }, ...g.pts], { x: 0, y: 0, width: size, height: size }, 14);
  const en = fit.map(g.entry), ex = fit.map(g.exit);
  const b0 = fit.map({ x: 0, y: 0 }), b1 = fit.map({ x: Math.max(g.width, 1), y: 0 }), t = fit.map({ x: 0, y: 1 });
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:#18181b;border-radius:8px">
<line x1="${b0.x}" y1="${b0.y}" x2="${b1.x}" y2="${b1.y}" stroke="#3f3f46" stroke-dasharray="3 3"/>
<line x1="${b0.x}" y1="${t.y}" x2="${b1.x}" y2="${t.y}" stroke="#3f3f46" stroke-dasharray="3 3"/>
<path d="${pathD(g.pts, fit)}" fill="none" stroke="#e8322e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="${en.x}" cy="${en.y}" r="4" fill="#fff"/><circle cx="${ex.x}" cy="${ex.y}" r="4" fill="none" stroke="#fff" stroke-width="2"/></svg>`;
}

function circuitSvg(c: Circuit, s: LetterSection, size = 105): string {
  const ring = circuitSamples(c);
  const fit = fitToBox(ring, { x: 0, y: 0, width: size, height: size }, 10);
  const total = ring[ring.length - 1].dist;
  const hl = s.end >= s.start ? ring.filter((p) => p.dist >= s.start && p.dist <= s.end) : [...ring.filter((p) => p.dist >= s.start), ...ring.filter((p) => p.dist <= s.end)];
  void total;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:#18181b;border-radius:8px">
<path d="${pathD(ring, fit)}" fill="none" stroke="#52525b" stroke-width="2"/>
<path d="${pathD(hl, fit)}" fill="none" stroke="#e8322e" stroke-width="4" stroke-linecap="round"/></svg>`;
}

function main() {
  const outDir = process.argv[2];
  const topN = Number(process.argv[3] ?? 6);
  if (!outDir) throw new Error("outDir required");
  fs.mkdirSync(outDir, { recursive: true });
  const circuits = JSON.parse(fs.readFileSync(path.resolve("data/circuits.json"), "utf8")) as Circuit[];
  const byId = new Map(circuits.map((c) => [c.id, c]));
  const best = mine(circuits);
  const selected: Record<string, Cand[]> = {};
  let html = `<!doctype html><meta charset="utf-8"><title>Letter candidates</title>
<style>body{background:#0b0b0f;color:#e4e4e7;font:14px system-ui;padding:8px}h2{margin:10px 0 4px;font-size:20px}.row{display:flex;gap:6px;flex-wrap:nowrap}.c{background:#111114;border:1px solid #27272a;border-radius:8px;padding:4px;width:218px;flex:none}.c .m{font-size:10px;color:#a1a1aa;margin-top:2px;line-height:1.2;height:36px;overflow:hidden}.idx{display:inline-block;background:#e8322e;color:#fff;border-radius:4px;padding:0 6px;margin-right:6px;font-weight:700}</style>`;
  for (const L of Object.keys(TEMPLATES)) {
    const sel = select(best.get(L)!, topN);
    selected[L] = sel;
    html += `<h2>${L}</h2><div class="row">`;
    sel.forEach((cnd, i) => {
      const c = byId.get(cnd.section.circuitId)!;
      html += `<div class="c"><div style="display:flex;gap:8px">${glyphSvg(c, cnd.section)}${circuitSvg(c, cnd.section)}</div>
<div class="m"><span class="idx">${L}${i}</span>${c.name} · ${cnd.section.start}→${cnd.section.end} rot ${cnd.section.rotation}${cnd.section.flipX ? " flip" : ""}${cnd.section.reverse ? " rev" : ""} · score ${cnd.score.toFixed(3)}</div></div>`;
    });
    html += `</div>`;
  }
  fs.writeFileSync(path.join(outDir, "candidates.json"), JSON.stringify(selected, null, 1));
  // One standalone SVG sheet per letter (2 rows x 4) for offline PNG review.
  for (const [L, sel] of Object.entries(selected)) {
    const cw = 420, ch = 250, cols = 2;
    const rows = Math.ceil(sel.length / cols);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw * cols}" height="${ch * rows + 40}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#0b0b0f"/><text x="12" y="30" fill="#fff" font-size="26" font-weight="700">${L}</text>`;
    sel.forEach((cnd, i) => {
      const c = byId.get(cnd.section.circuitId)!;
      const x = (i % cols) * cw, y = 40 + Math.floor(i / cols) * ch;
      const g = glyphSvg(c, cnd.section, 190).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
      const r = circuitSvg(c, cnd.section, 190).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
      svg += `<g transform="translate(${x + 10},${y + 10})"><rect width="190" height="190" fill="#18181b" rx="8"/>${g}</g>`;
      svg += `<g transform="translate(${x + 210},${y + 10})"><rect width="190" height="190" fill="#18181b" rx="8"/>${r}</g>`;
      svg += `<text x="${x + 12}" y="${y + 222}" fill="#fff" font-size="15" font-weight="700">${L}${i}</text><text x="${x + 48}" y="${y + 222}" fill="#a1a1aa" font-size="13">${c.location} · ${cnd.section.start}→${cnd.section.end} · rot ${cnd.section.rotation}${cnd.section.flipX ? " flip" : ""}${cnd.section.reverse ? " rev" : ""} · ${cnd.score.toFixed(3)}</text>`;
    });
    svg += `</svg>`;
    fs.writeFileSync(path.join(outDir, `sheet-${L}.svg`), svg);
  }
  fs.writeFileSync(path.join(outDir, "review.html"), html);
  console.error(`Wrote ${path.join(outDir, "review.html")}`);
}

main();
