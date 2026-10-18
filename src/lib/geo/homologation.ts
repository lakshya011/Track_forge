import { letterCount } from "./length";
import { hashString } from "./rng";
import type { Corner, LetterSection, Track } from "./types";

/** Circuits that run on public roads; half or more of a name's sources from here makes it a street circuit. */
export const STREET_CIRCUITS = new Set(["mc-1929", "sg-2008", "az-2016", "sa-2021", "us-2023", "us-2022", "au-1953", "ca-1978"]);

/** A letter whose curated pool has this many sections or fewer counts as rare. */
export const RARE_POOL_SIZE = 2;

/** Cruising speed of the ghost-lap model on a straight, km/h. */
export const GHOST_SPEED_KMH = 215;

export interface HomologationMetrics {
  cornersPerKm: number;
  /** Longest straight as a share of the lap. */
  straightShare: number;
  hairpins: number;
  fastCorners: number;
  chicanes: number;
  /** Highest minus lowest point on the lap, metres. */
  relief: number;
  avgAngle: number;
  countries: string[];
  letters: number;
}

export interface Badge {
  id: "rare-letter" | "ligature" | "full-house" | "marathon" | "sprint";
  label: string;
  detail: string;
}

export interface DnaShare {
  country: string;
  /** Share of the letter-drawn lap length, 0..1. Shares sum to 1. */
  share: number;
  letters: string[];
}

export interface Homologation {
  /** Playful grade label; never a claim of real certification. */
  grade: string;
  /** Licence number, deterministic for (name, seed). */
  licence: string;
  /** 1 (easy) to 10 (brutal). */
  difficulty: number;
  tags: string[];
  badges: Badge[];
  lapTime: { seconds: number; formatted: string };
  metrics: HomologationMetrics;
  dna: DnaShare[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const whole = Math.floor(s);
  const ms = Math.round((s - whole) * 1000);
  const msFixed = ms === 1000 ? 999 : ms;
  return `${m}:${String(whole).padStart(2, "0")}.${String(msFixed).padStart(3, "0")}`;
}

/** Fictional lap time: cruise the lap, pay for every corner, pay a little for hills. */
export function ghostLapSeconds(length: number, corners: Pick<Corner, "angleDeg">[], relief: number): number {
  const cruise = length / (GHOST_SPEED_KMH / 3.6);
  const cornerCost = corners.reduce((s, c) => s + 0.9 + (1.4 * Math.abs(c.angleDeg)) / 90, 0);
  return cruise + cornerCost + 0.01 * relief;
}

/** Opposite-direction corners whose zones sit within `gap` metres of each other. */
export function countChicanes(corners: Corner[], length: number, gap = 80): number {
  if (corners.length < 2) return 0;
  let n = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    if (a === b || a.direction === b.direction) continue;
    let d = b.startDist - a.endDist;
    if (d < 0) d += length;
    if (d <= gap) n++;
  }
  return n;
}

export function reliefOf(track: Pick<Track, "loop">): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of track.loop) {
    lo = Math.min(lo, p.z);
    hi = Math.max(hi, p.z);
  }
  return Number.isFinite(hi - lo) ? hi - lo : 0;
}

export function computeMetrics(track: Track): HomologationMetrics {
  const km = track.length / 1000;
  const angles = track.corners.map((c) => Math.abs(c.angleDeg));
  const countries = [...new Set(track.sources.map((s) => s.circuit.country))];
  return {
    cornersPerKm: km > 0 ? track.corners.length / km : 0,
    straightShare: track.length > 0 ? track.longestStraight.length / track.length : 0,
    hairpins: angles.filter((a) => a >= 150).length,
    fastCorners: angles.filter((a) => a >= 20 && a <= 45).length,
    chicanes: countChicanes(track.corners, track.length),
    relief: reliefOf(track),
    avgAngle: angles.length ? angles.reduce((s, a) => s + a, 0) / angles.length : 0,
    countries,
    letters: letterCount(track.name),
  };
}

/**
 * Thresholds calibrated against ~230 generated names (seed 0 and 1): each sits near the 30th or
 * 70th percentile of its metric so every tag marks a minority of circuits.
 */
export const CALIBRATION = {
  /** corners/km: 10th pct 2.65, median 3.8, 90th 4.65 */
  cpkLow: 2.4,
  cpkHigh: 5.0,
  fastCpk: 3.3,
  technicalCpk: 4.1,
  fastStraightShare: 0.235,
  /** corners of 150° or more: median 6, 90th pct 12 */
  hairpinsMax: 14,
  hairpinHeaven: 8,
  /** opposite-direction pairs within 80 m: median 4, 90th pct 10 */
  chicanesMax: 12,
  /** metres: median 26, 90th pct 42 */
  reliefMax: 50,
  hilly: 35,
  flat: 18,
  /** mean |corner angle|: median 132° */
  flowingAvgAngle: 120,
  /** share of sources whose circuit opened before 1950 */
  classicShare: 0.4,
} as const;

/** 1–10 from corner density, hairpins, chicanes and hills: a blend of normalised metrics. */
export function difficultyOf(m: HomologationMetrics): number {
  const C = CALIBRATION;
  const unit = (v: number) => clamp(v, 0, 1);
  const score =
    0.35 * unit((m.cornersPerKm - C.cpkLow) / (C.cpkHigh - C.cpkLow)) +
    0.3 * unit(m.hairpins / C.hairpinsMax) +
    0.2 * unit(m.chicanes / C.chicanesMax) +
    0.15 * unit(m.relief / C.reliefMax);
  return clamp(Math.round(1 + 9 * score), 1, 10);
}

export function tagsOf(track: Track, m: HomologationMetrics): string[] {
  const C = CALIBRATION;
  const tags: string[] = [];
  if (m.straightShare > C.fastStraightShare || m.cornersPerKm < C.fastCpk) tags.push("High-speed");
  if (m.cornersPerKm > C.technicalCpk) tags.push("Technical");
  if (m.relief > C.hilly) tags.push("Hilly");
  else if (m.relief < C.flat) tags.push("Flat");
  if (m.hairpins >= C.hairpinHeaven) tags.push("Hairpin heaven");
  if (m.avgAngle < C.flowingAvgAngle && track.corners.length > 0) tags.push("Flowing");
  const street = track.sources.filter((s) => STREET_CIRCUITS.has(s.circuit.id)).length;
  if (track.sources.length > 0 && street * 2 >= track.sources.length) tags.push("Street circuit");
  const classic = track.sources.filter((s) => s.circuit.opened < 1950).length;
  if (track.sources.length > 0 && classic / track.sources.length >= C.classicShare) tags.push("Classic");
  // Keep the card readable: at least two, at most four.
  if (tags.length < 2) {
    if (!tags.includes("Flowing") && !tags.includes("Technical")) tags.push(m.cornersPerKm >= 3 ? "Technical" : "Flowing");
    if (tags.length < 2) tags.push(m.relief >= 30 ? "Undulating" : "Balanced");
  }
  return tags.slice(0, 4);
}

export function badgesOf(track: Track, letters: LetterSection[], m: HomologationMetrics): Badge[] {
  const pool = new Map<string, number>();
  for (const s of letters) pool.set(s.letter, (pool.get(s.letter) ?? 0) + 1);
  const rare = [...new Set(track.sources.map((s) => s.letter))].filter((l) => (pool.get(l) ?? 0) <= RARE_POOL_SIZE);
  const out: Badge[] = [];
  if (rare.length) out.push({ id: "rare-letter", label: "Rare letter", detail: `${rare.join(", ")}: only ${RARE_POOL_SIZE} stretches in the whole calendar read as this letter.` });
  if (track.ligatures.length) out.push({ id: "ligature", label: "Ligature", detail: `${track.ligatures.length} shared stroke${track.ligatures.length > 1 ? "s" : ""}: two letters drawn as one line.` });
  if (m.countries.length >= 5) out.push({ id: "full-house", label: "Full house", detail: `Sections from ${m.countries.length} countries on one lap.` });
  if (m.letters >= 12) out.push({ id: "marathon", label: "Marathon", detail: "Twelve letters, the longest name the forge accepts." });
  if (m.letters <= 3) out.push({ id: "sprint", label: "Sprint", detail: "Three letters or fewer: a short, punchy lap." });
  return out;
}

/** Share of the letter-drawn lap per source country, largest first. */
export function dnaOf(track: Track): DnaShare[] {
  const byCountry = new Map<string, { len: number; letters: string[] }>();
  let total = 0;
  for (const r of track.letterRanges) {
    const src = track.sources[r.letterIndex];
    if (!src) continue;
    const len = Math.max(0, r.endDist - r.startDist);
    total += len;
    const cur = byCountry.get(src.circuit.country) ?? { len: 0, letters: [] };
    cur.len += len;
    cur.letters.push(r.letter);
    byCountry.set(src.circuit.country, cur);
  }
  if (total <= 0) return [];
  return [...byCountry.entries()]
    .map(([country, v]) => ({ country, share: v.len / total, letters: v.letters }))
    .sort((a, b) => b.share - a.share);
}

export function licenceNumber(name: string, seed: number): string {
  const h = (hashString(name) ^ (seed >>> 0)) >>> 0;
  const hex = h.toString(16).toUpperCase().padStart(8, "0");
  return `TF-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** Inspect a track and issue its (entirely fictional) homologation card. */
export function homologate(track: Track, letters: LetterSection[] = []): Homologation {
  const metrics = computeMetrics(track);
  const seconds = ghostLapSeconds(track.length, track.corners, metrics.relief);
  return {
    grade: "Grade 1",
    licence: licenceNumber(track.name, track.seed),
    difficulty: difficultyOf(metrics),
    tags: tagsOf(track, metrics),
    badges: badgesOf(track, letters, metrics),
    lapTime: { seconds, formatted: formatLapTime(seconds) },
    metrics,
    dna: dnaOf(track),
  };
}
