import { homologate } from "../geo/homologation";
import type { Track } from "../geo/types";
import { BODY_STACK, DISPLAY_STACK } from "./fonts";
import { attributionRow, esc } from "./primitives";
import { cartographic } from "./styles/cartographic";
import { engraved } from "./styles/engraved";
import { sector } from "./styles/sector";
import { teamcar } from "./styles/teamcar";
import { DEFAULT_OPTIONS, STORY_SHEET, STORY_SIZE, posterSize, type PosterMeta, type PosterRequest, type PosterStyle, type RenderContext, type StyleDefinition } from "./types";

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

function context(track: Track, size: { width: number; height: number }, req: PosterRequest, meta: PosterMeta): RenderContext {
  return {
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
    shareUrl: meta.shareUrl,
  };
}

/** Where the sheet sits in the story and how tall the band under it is. */
export const STORY_TOP = 60;

/**
 * The phone story: the style's 2:3 sheet at 1080 wide on its own paper, with the attribution row
 * (a larger QR, the short link) in the band below. The sheet itself is rendered without its own
 * row so the story carries exactly one code.
 */
function storyFrame(style: StyleDefinition, track: Track, req: PosterRequest, meta: PosterMeta): string {
  // The sheet is laid out at its usual 1200 × 1800 and scaled to the story's width, so no style
  // ever sees an unfamiliar size.
  const sheetSize = posterSize("2:3");
  const inner = context(track, sheetSize, req, { ...meta, shareUrl: undefined });
  const sheet = style
    .render(inner)
    .replace(/^<\?xml[^>]*>\s*/, "")
    .replace(/^<svg([^>]*?) width="\d+" height="\d+"/, `<svg$1 x="0" y="${STORY_TOP}" width="${STORY_SHEET.width}" height="${STORY_SHEET.height}"`);
  const theme = style.story?.(inner) ?? { paper: style.palette.bg, ink: style.palette.fg, muted: style.palette.muted };
  const { width: W, height: H } = STORY_SIZE;
  const band = H - STORY_TOP - STORY_SHEET.height;
  const side = 96;
  const outer = { ...inner, W, H, shareUrl: meta.shareUrl };
  const row = attributionRow(outer, {
    x: W / 2,
    y: STORY_TOP + STORY_SHEET.height + (band - side) / 2,
    align: "middle",
    color: theme.ink,
    qrColor: theme.ink,
    side,
    urlSize: 19,
    capsSize: 13,
    opacity: 0.92,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(inner.body)}">
<rect width="${W}" height="${H}" fill="${theme.paper}"/>
${sheet}
${row.markup}
</svg>`;
}

/** Build one poster as an SVG string. */
export function buildPoster(track: Track, req: PosterRequest, meta: PosterMeta = {}): string {
  const style = STYLES[req.style] ?? sector;
  if (!req.size && req.ratio === "9:16") return storyFrame(style, track, req, meta);
  const size = req.size ?? posterSize(req.ratio ?? "2:3");
  return style.render(context(track, size, req, meta));
}
