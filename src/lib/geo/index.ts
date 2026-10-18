import { detectCorners, longestStraight, sectors } from "./corners";
import { normalizeRelief } from "./elevation";
import { findSelfIntersection, resampleLoop, scaleToLength, smoothJoins } from "./post";
import { hashString, mulberry32, pickIndex } from "./rng";
import { alignReversible, mergeChain } from "./ligature";
import { SectionTooShort, glyphFromSection, orientLeftToRight } from "./section";
import { DEFAULT_GAP, DEFAULT_RETURN_OFFSET, assembleLoop, layoutGlyphs, type LayoutItem } from "./stitch";
import type { Circuit, Corner, CornerSource, Glyph, LetterRange, LetterSection, Track, TrackSource } from "./types";

export * from "./types";
export * from "./rng";
export * from "./project";
export * from "./section";
export * from "./stitch";
export * from "./post";
export * from "./corners";
export * from "./elevation";
export * from "./route";
export * from "./ligature";
export * from "./length";
export * from "./homologation";
export * from "./decor";

export const MAX_NAME_LENGTH = 12;
export const RACE_DISTANCE_M = 305000;

/** Uppercase, A-Z and single spaces only, trimmed, max length. */
export function sanitizeName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
}

export function lapsFor(lengthMetres: number): number {
  return Math.ceil(RACE_DISTANCE_M / lengthMetres);
}

export interface TrackData {
  circuits: Circuit[];
  letters: LetterSection[];
}

export interface GenerateOptions {
  /** Metres. Defaults to the official length of the circuit `lengthCircuitId`. */
  targetLength?: number;
  maxRelief?: number;
  step?: number;
}

export class GenerateError extends Error {}

/** Group letter sections by letter for O(1) lookup. */
export function indexLetters(letters: LetterSection[]): Map<string, LetterSection[]> {
  const m = new Map<string, LetterSection[]>();
  for (const s of letters) {
    const arr = m.get(s.letter) ?? [];
    arr.push(s);
    m.set(s.letter, arr);
  }
  return m;
}

interface Choice {
  letter: string;
  section: LetterSection;
  circuit: Circuit;
  glyph: Glyph;
}

function chooseGlyph(
  letter: string,
  pool: LetterSection[],
  circuits: Map<string, Circuit>,
  rng: () => number,
  maxRelief: number,
): Choice {
  // Try sections in a seeded random order until one extracts cleanly.
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = pickIndex(rng, i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  let lastErr: unknown;
  for (const s of order) {
    const c = circuits.get(s.circuitId);
    if (!c) continue;
    try {
      const g = orientLeftToRight(glyphFromSection(c, s));
      g.pts = normalizeRelief(g.pts, maxRelief);
      return { letter, section: s, circuit: c, glyph: g };
    } catch (e) {
      if (e instanceof SectionTooShort) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw new GenerateError(`No usable section for letter ${letter}: ${String(lastErr ?? "pool empty")}`);
}

/**
 * Map each letter onto the finished lap. A fused compound covers several letters; its range is split
 * among them in proportion to the letters' own stroke lengths.
 */
function letterRangesFor(assembled: ReturnType<typeof assembleLoop>, merges: number[], glyphs: Glyph[], scale: number): LetterRange[] {
  const distAt = (i: number) => assembled.loop[Math.min(i, assembled.loop.length - 1)].dist * scale;
  const out: LetterRange[] = [];
  let letter = 0;
  for (const [a, b] of assembled.glyphRanges) {
    // Letters covered by this chain item: `letter` plus every following letter fused onto it.
    const group = [letter];
    while (merges.includes(group[group.length - 1])) group.push(group[group.length - 1] + 1);
    letter += group.length;
    const start = distAt(a);
    const end = distAt(b - 1);
    const weights = group.map((i) => glyphs[i]?.pts[glyphs[i].pts.length - 1]?.dist ?? 1);
    const total = weights.reduce((s, w) => s + w, 0) || 1;
    let cursor = start;
    group.forEach((i, k) => {
      const next = k === group.length - 1 ? end : cursor + ((end - start) * weights[k]) / total;
      out.push({ letter: glyphs[i].section.letter, letterIndex: i, startDist: cursor, endDist: next });
      cursor = next;
    });
  }
  return out;
}

/** Tag each corner with the letter whose stretch overlaps its turning zone the most. */
function attributeCorners(corners: Corner[], ranges: LetterRange[], sources: TrackSource[], length: number): Corner[] {
  const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  return corners.map((c) => {
    // A corner zone that wraps through start/finish is split into two pieces.
    const zones = c.endDist >= c.startDist ? [[c.startDist, c.endDist]] : [[c.startDist, length], [0, c.endDist]];
    let r: LetterRange | undefined;
    let bestOverlap = 0;
    for (const x of ranges) {
      const o = zones.reduce((s, [z0, z1]) => s + overlap(z0, z1, x.startDist, x.endDist), 0);
      if (o > bestOverlap) {
        bestOverlap = o;
        r = x;
      }
    }
    if (!r) r = ranges.find((x) => c.dist >= x.startDist && c.dist <= x.endDist);
    if (!r) return c;
    const src = sources[r.letterIndex];
    const source: CornerSource = { letter: r.letter, letterIndex: r.letterIndex, circuitId: src.circuit.id, label: src.section.label };
    return { ...c, source };
  });
}

/**
 * Generate a closed-loop track from a name. Deterministic for (name, seed, lengthCircuitId, data).
 */
export function generateTrack(
  rawName: string,
  seed: number,
  lengthCircuitId: string,
  data: TrackData,
  opts: GenerateOptions = {},
): Track {
  const name = sanitizeName(rawName);
  if (!name) throw new GenerateError("Name must contain at least one letter A-Z");
  const circuits = new Map(data.circuits.map((c) => [c.id, c]));
  const lengthCircuit = circuits.get(lengthCircuitId);
  const target = opts.targetLength ?? lengthCircuit?.length;
  if (!target) throw new GenerateError(`Unknown length circuit ${lengthCircuitId}`);
  const pools = indexLetters(data.letters);
  const maxRelief = opts.maxRelief ?? 60;
  const step = opts.step ?? 10;

  const rng = mulberry32(hashString(name) ^ (seed >>> 0));

  const pick = (): Choice[] => {
    const out: Choice[] = [];
    for (const ch of name) {
      if (ch === " ") continue;
      const pool = pools.get(ch);
      if (!pool || pool.length === 0) throw new GenerateError(`No sections curated for letter ${ch}`);
      out.push(chooseGlyph(ch, pool, circuits, rng, maxRelief));
    }
    return out;
  };

  let choices = pick();
  let attempts = 0;
  let best: { loop: ReturnType<typeof assembleLoop>; gap: number; offset: number; kerned: boolean; merges: number[] } | null = null;
  let intersecting = true;

  // Attempt plan: fused + kerned, fused only, plain, then plain with widening gaps.
  const plan: { ligatures: boolean; kern: boolean; gap: number; offset: number }[] = [
    { ligatures: true, kern: true, gap: DEFAULT_GAP, offset: DEFAULT_RETURN_OFFSET },
    { ligatures: true, kern: false, gap: DEFAULT_GAP, offset: DEFAULT_RETURN_OFFSET },
    { ligatures: false, kern: false, gap: DEFAULT_GAP, offset: DEFAULT_RETURN_OFFSET },
    { ligatures: false, kern: false, gap: DEFAULT_GAP + 0.15, offset: DEFAULT_RETURN_OFFSET + 0.3 },
    { ligatures: false, kern: false, gap: DEFAULT_GAP + 0.3, offset: DEFAULT_RETURN_OFFSET + 0.6 },
    { ligatures: false, kern: false, gap: DEFAULT_GAP + 0.45, offset: DEFAULT_RETURN_OFFSET + 0.9 },
  ];
  const isGlyph = (x: LayoutItem): x is Glyph => x !== "space";

  for (let reroll = 0; reroll < 3 && intersecting; reroll++) {
    if (reroll > 0) choices = pick();
    for (const step of plan) {
      attempts++;
      const raw: LayoutItem[] = [];
      let ci = 0;
      let prevGlyph: Glyph | null = null;
      for (const ch of name) {
        if (ch === " ") {
          raw.push("space");
          prevGlyph = null;
        } else {
          let g = choices[ci++].glyph;
          if (step.ligatures && prevGlyph) g = alignReversible(prevGlyph.exitTangent, g);
          raw.push(g);
          prevGlyph = g;
        }
      }
      const chain = step.ligatures ? mergeChain(raw, isGlyph) : { items: raw, merges: [] };
      const placed = layoutGlyphs(chain.items, { gap: step.gap, kern: step.kern });
      const assembled = assembleLoop(placed, step.offset);
      const smoothed = smoothJoins(assembled.loop, assembled.joinIndices);
      const hit = findSelfIntersection(smoothed);
      best = { loop: { ...assembled, loop: smoothed }, gap: step.gap, offset: step.offset, kerned: step.kern, merges: chain.merges };
      if (!hit) {
        intersecting = false;
        break;
      }
    }
  }
  if (!best) throw new GenerateError("Failed to build loop");

  const { loop: scaled, scale } = scaleToLength(best.loop.loop, target);
  const loop = resampleLoop(scaled, step);
  const length = loop[loop.length - 1].dist;
  const sources: TrackSource[] = choices.map((c) => ({ letter: c.letter, section: c.section, circuit: c.circuit }));
  const letterRanges = letterRangesFor(best.loop, best.merges, choices.map((c) => c.glyph), scale);
  const corners = attributeCorners(detectCorners(loop), letterRanges, sources, length);
  const secs = sectors(length, corners);
  const straight = longestStraight(length, corners);

  return {
    name,
    seed,
    lengthCircuitId,
    loop,
    length,
    corners,
    sectors: secs,
    longestStraight: straight,
    sources,
    ligatures: best.merges,
    letterRanges,
    warning: intersecting ? "Could not avoid a self-intersection; try Shuffle." : undefined,
    debug: { joinIndices: best.loop.joinIndices, gap: best.gap, offset: best.offset, attempts, kerned: best.kerned },
  };
}
