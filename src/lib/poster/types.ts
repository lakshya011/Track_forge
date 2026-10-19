import type { Homologation } from "../geo/homologation";
import type { Track } from "../geo/types";
import type { Cartography } from "./cartography";

export type PosterStyle = "sector" | "engraved" | "teamcar" | "cartographic";
export const POSTER_STYLES: readonly PosterStyle[] = ["sector", "engraved", "teamcar", "cartographic"];
export const isPosterStyle = (s: unknown): s is PosterStyle => typeof s === "string" && (POSTER_STYLES as readonly string[]).includes(s);
/** Style from a link parameter; older links said `editorial` for the third style. */
export function posterStyleFrom(s: unknown): PosterStyle | null {
  if (s === "editorial") return "teamcar";
  return isPosterStyle(s) ? s : null;
}

/** 2:3 and 1:1 are print sheets; 9:16 is the phone story: the 2:3 sheet on its paper with the attribution row below. */
export type PosterRatio = "2:3" | "1:1" | "9:16";
export const POSTER_RATIOS: readonly PosterRatio[] = ["2:3", "1:1", "9:16"];
export const isPosterRatio = (s: unknown): s is PosterRatio => s === "2:3" || s === "1:1" || s === "9:16";
export const RATIO_LABELS: Record<PosterRatio, { label: string; hint: string }> = {
  "2:3": { label: "2:3", hint: "portrait" },
  "1:1": { label: "1:1", hint: "square" },
  "9:16": { label: "Story", hint: "9:16, for Instagram and WhatsApp stories" },
};

export type Wood = "oak" | "walnut" | "black";

/** Every style's sub-options in one bag; each style reads the ones it understands. */
export interface PosterOptions {
  wood: Wood;
  /** Team-car livery id (teams.ts); "" means the circuit's default team. */
  team: string;
  northArrow: boolean;
  coordinates: boolean;
}

export const DEFAULT_OPTIONS: PosterOptions = { wood: "oak", team: "", northArrow: true, coordinates: false };

export interface PosterRequest {
  style: PosterStyle;
  ratio?: PosterRatio;
  options?: Partial<PosterOptions>;
  /** Explicit canvas size; overrides the ratio. */
  size?: { width: number; height: number };
}

export interface PosterMeta {
  /** Pre-computed homologation; computed from the track when omitted. */
  homologation?: Homologation;
  /** Length-reference circuit for the footer, e.g. "Spa-Francorchamps · 7.004 km". */
  lengthReference?: string;
  homologatedYear?: number;
  /** Extra <style> content, normally the embedded display @font-face. */
  fontFace?: string;
  /** Font stacks; default to the display and body stacks in fonts.ts. */
  displayFamily?: string;
  bodyFamily?: string;
  /** Shared procedural surroundings, built once per track. */
  cartography?: Cartography;
  /** Corner-count limit for drawing place names next to the numbers. */
  maxNamedCorners?: number;
  /** The link that rebuilds this circuit; with it every style draws its attribution row (QR + short link). */
  shareUrl?: string;
}

export interface Palette {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  sectors: [string, string, string];
  asphalt: string;
  edge: string;
  kerbA: string;
  kerbB: string;
  gravel: string;
  gravelDot: string;
  stands: string;
  standsRow: string;
  standsEdge: string;
  /** Corner ring colours for left- and right-handers. */
  left: string;
  right: string;
}

export interface RenderContext {
  track: Track;
  W: number;
  H: number;
  h: Homologation;
  year: number;
  lengthReference?: string;
  display: string;
  body: string;
  fontFace: string;
  options: PosterOptions;
  cartography?: Cartography;
  maxNamedCorners: number;
  /** When set, the style draws the attribution row (QR + short link) in its credit area. */
  shareUrl?: string;
}

/** Colours the story frame borrows so its letterbox looks like the sheet's own paper. */
export interface StoryTheme {
  paper: string;
  ink: string;
  muted: string;
}

export interface StyleDefinition {
  id: PosterStyle;
  name: string;
  hint: string;
  palette: Palette;
  render: (ctx: RenderContext) => string;
  /** Paper and ink for the story letterbox; defaults to the palette's bg/fg/muted. */
  story?: (ctx: RenderContext) => StoryTheme;
}

export const STORY_SIZE = { width: 1080, height: 1920 } as const;
/** The sheet inside a story: a 2:3 poster at the story's width. */
export const STORY_SHEET = { width: 1080, height: 1620 } as const;

export function posterSize(ratio: PosterRatio): { width: number; height: number } {
  if (ratio === "9:16") return { ...STORY_SIZE };
  return ratio === "1:1" ? { width: 1200, height: 1200 } : { width: 1200, height: 1800 };
}

/** PNG export scale per ratio: print sheets go out at 2×, the story at its native 1080 × 1920. */
export function exportScale(ratio: PosterRatio): number {
  return ratio === "9:16" ? 1 : 2;
}
