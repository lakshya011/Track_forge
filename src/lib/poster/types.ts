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

export type PosterRatio = "2:3" | "1:1";
export const POSTER_RATIOS: readonly PosterRatio[] = ["2:3", "1:1"];
export const isPosterRatio = (s: unknown): s is PosterRatio => s === "2:3" || s === "1:1";

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
}

export interface StyleDefinition {
  id: PosterStyle;
  name: string;
  hint: string;
  palette: Palette;
  render: (ctx: RenderContext) => string;
}

export function posterSize(ratio: PosterRatio): { width: number; height: number } {
  return ratio === "1:1" ? { width: 1200, height: 1200 } : { width: 1200, height: 1800 };
}
