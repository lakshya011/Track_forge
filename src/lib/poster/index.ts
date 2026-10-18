import { homologate } from "../geo/homologation";
import type { Track } from "../geo/types";
import { BODY_STACK, DISPLAY_STACK } from "./fonts";
import { cartographic } from "./styles/cartographic";
import { engraved } from "./styles/engraved";
import { sector } from "./styles/sector";
import { teamcar } from "./styles/teamcar";
import { DEFAULT_OPTIONS, posterSize, type PosterMeta, type PosterRequest, type PosterStyle, type RenderContext, type StyleDefinition } from "./types";

export * from "./types";
export { BODY_STACK, DISPLAY_FAMILY, DISPLAY_STACK, displayFontStyle } from "./fonts";
export { TEAMS, TEAM_IDS, defaultTeamId, isTeamId, teamFor, type Team, type TeamId } from "./teams";

/** Every poster style, in gallery order. */
export const STYLES: Record<PosterStyle, StyleDefinition> = {
  sector,
  engraved,
  teamcar,
  cartographic,
};

/** Build one poster as an SVG string. */
export function buildPoster(track: Track, req: PosterRequest, meta: PosterMeta = {}): string {
  const style = STYLES[req.style] ?? sector;
  const size = req.size ?? posterSize(req.ratio ?? "2:3");
  const ctx: RenderContext = {
    track,
    W: size.width,
    H: size.height,
    h: meta.homologation ?? homologate(track),
    year: meta.homologatedYear ?? new Date().getFullYear(),
    lengthReference: meta.lengthReference,
    display: meta.displayFamily ?? DISPLAY_STACK,
    body: meta.bodyFamily ?? BODY_STACK,
    fontFace: meta.fontFace ?? "",
    options: { ...DEFAULT_OPTIONS, ...req.options },
    cartography: meta.cartography,
    maxNamedCorners: meta.maxNamedCorners ?? 16,
  };
  return style.render(ctx);
}
