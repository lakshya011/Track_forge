import { esc } from "./primitives";

/*
 * A current-generation single-seater seen head-on and slightly from above, as reusable SVG.
 * Coordinates: CAR_BOX (x from -500 to 500, 2 mm per unit, ground line at y = CAR_GROUND). Side
 * pieces are drawn once for the right and mirrored with <use transform="scale(-1,1)">; symmetric
 * centre pieces (wings, airbox, chassis, nose) are drawn whole so there is no seam, and the painted
 * number and wordmark are never mirrored. Livery regions are filled with the CSS custom properties
 * --c1 / --c2 / --c3 / --accent set on the group, so one drawing recolours per team.
 *
 * Paint order, back to front: rear tyres, rear wing, airbox, engine-cover shoulders, sidepods and
 * suspension, front tyres, cockpit and halo, front wing, nose.
 */

export const CAR_BOX = { x: -500, y: 170, width: 1000, height: 720 } as const;
export const CAR_GROUND = 820;

export interface CarColours {
  c1: string;
  c2: string;
  c3: string;
  accent: string;
}

export interface CarOptions {
  /** Id prefix for defs and the mirrored halves; unique per document. */
  id?: string;
  colours: CarColours;
  /** Race number painted on the nose. */
  number: string;
  /** Lettering across the rear-wing flap; never a sponsor. */
  wordmark?: string;
  /** Font for the painted text. */
  font?: string;
}

const CARBON = "#1b1b1d";
const CARBON_DARK = "#0d0d0e";
const TYRE = "#17171a";
const TYRE_TOP = "#2c2c30";
const TYRE_RIM = "#3b3b40";
const LENS = "#6a7580";

const fillOf = (f: string) => (f === "c1" || f === "c2" || f === "c3" || f === "accent" ? `var(--${f})` : f);

/** One path with an inline fill (CSS variables need a style, not a presentation attribute). */
function P(d: string, fill: string, extra = ""): string {
  // Body panels get a faint dark edge so pale liveries keep their outline on pale paper.
  const edge = fill === "c1" ? ' stroke="#000" stroke-opacity="0.16" stroke-width="1.5" stroke-linejoin="round"' : "";
  return `<path d="${d}" style="fill:${fillOf(fill)}"${edge}${extra ? " " + extra : ""}/>`;
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** Right half of a wing element: a band from the centre line whose outer end rises by `lift`. */
function wingElement(yTop: number, thick: number, xEnd: number, lift: number, sag: number): string {
  const yB = yTop + thick;
  return (
    `M-3 ${f(yTop)} ` +
    `C140 ${f(yTop + sag)} 300 ${f(yTop + sag)} ${f(xEnd - 120)} ${f(yTop - lift * 0.1)} ` +
    `C${f(xEnd - 60)} ${f(yTop - lift * 0.4)} ${f(xEnd - 24)} ${f(yTop - lift)} ${f(xEnd)} ${f(yTop - lift)} ` +
    `L${f(xEnd)} ${f(yB - lift)} ` +
    `C${f(xEnd - 24)} ${f(yB - lift)} ${f(xEnd - 60)} ${f(yB - lift * 0.4)} ${f(xEnd - 120)} ${f(yB - lift * 0.1)} ` +
    `C300 ${f(yB + sag)} 140 ${f(yB + sag)} -3 ${f(yB)} Z`
  );
}

const WING = [
  { y: 770, t: 20, lift: 46, sag: 3, fill: "c2" },
  { y: 748, t: 17, lift: 40, sag: 3, fill: "c1" },
  { y: 727, t: 16, lift: 33, sag: 2, fill: "c1" },
  { y: 707, t: 15, lift: 26, sag: 1, fill: "c2" },
] as const;

/** Right-hand side pieces behind the cockpit: tyres, sidepod, suspension, mirror. */
function halfBack(p: string): string {
  const out: string[] = [];
  const arm = (x1: number, y1: number, x2: number, y2: number, w = 7) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${CARBON}" stroke-width="${w}" stroke-linecap="round"/>`;

  // Rear tyre: wider and taller than the front, peeking above and inboard of it.
  out.push(`<rect x="298" y="414" width="204" height="376" rx="50" fill="${TYRE}"/>`);
  out.push(`<ellipse cx="400" cy="428" rx="88" ry="18" fill="${TYRE_TOP}"/>`);
  out.push(`<rect x="298" y="414" width="204" height="376" rx="50" fill="url(#${p}-tyreShade)"/>`);

  // Rear wing endplate (the planes are centre pieces).
  out.push(P("M262 184 Q262 178 268 178 L284 178 Q290 178 290 184 L290 350 Q290 356 284 356 L268 356 Q262 356 262 350 Z", "c3"));
  out.push(`<rect x="262" y="178" width="28" height="178" rx="6" fill="url(#${p}-endShade)"/>`);

  // Sidepod beside the chassis: a flat lit deck, boxy outer wall, a wide thin inlet slot under a
  // lip, and the undercut falling away in shadow.
  out.push(P("M118 450 L270 452 C292 452 304 464 304 486 L304 548 C304 580 296 602 282 614 C250 634 200 642 118 638 Z", "c1"));
  out.push(`<path d="M118 450 L270 452 C292 452 304 464 304 486 L304 500 C300 484 288 478 270 478 L118 476 Z" fill="url(#${p}-deck)"/>`);
  out.push(`<path d="M282 614 C250 634 200 642 118 638 L118 608 L200 612 C240 612 268 602 290 584 L304 548 C304 580 296 602 282 614 Z" fill="#000" fill-opacity="0.3"/>`);
  out.push(P("M138 486 L298 492 L298 499 L138 493 Z", "c3"));
  out.push(`<path d="M142 496 L296 502 C296 522 292 532 286 536 L148 526 C142 520 140 506 142 496 Z" fill="${CARBON_DARK}"/>`);
  out.push(P("M160 556 L304 552 L304 562 L160 566 Z", "c3"));
  // Undercut shadow down to the floor, and the floor edge beside the front tyre.
  out.push(`<path d="M126 636 L296 626 C322 654 330 690 332 724 L136 724 Z" fill="url(#${p}-under)"/>`);
  out.push(`<path d="M300 696 L346 688 L346 712 L300 720 Z" fill="${CARBON}"/>`);

  // Front suspension into the upright: upper and lower wishbones, pushrod, track rod.
  out.push(arm(124, 506, 350, 546), arm(118, 532, 350, 556), arm(92, 650, 350, 688), arm(96, 672, 350, 696), arm(116, 570, 350, 680, 6), arm(90, 620, 350, 636, 5));

  // Mirror on a stalk.
  out.push(`<line x1="116" y1="448" x2="152" y2="432" stroke="${CARBON}" stroke-width="5"/>`);
  out.push(P("M150 418 L200 418 Q206 418 206 424 L206 442 Q206 448 200 448 L150 448 Z", "c2"));
  out.push(`<rect x="156" y="423" width="44" height="20" rx="2" fill="#9fb3c8"/>`);

  // Front tyre with a lit top, shoulder rings and a tread sheen.
  out.push(`<rect x="338" y="460" width="164" height="360" rx="48" fill="${TYRE}"/>`);
  out.push(`<ellipse cx="420" cy="472" rx="72" ry="17" fill="${TYRE_TOP}"/>`);
  out.push(`<rect x="338" y="460" width="164" height="360" rx="48" fill="url(#${p}-tyreShade)"/>`);
  out.push(`<path d="M352 480 Q420 464 488 480" fill="none" stroke="${TYRE_RIM}" stroke-width="3"/>`);
  out.push(`<path d="M346 502 Q420 488 494 502" fill="none" stroke="${TYRE_RIM}" stroke-width="2" stroke-opacity="0.7"/>`);
  out.push(`<rect x="354" y="506" width="20" height="290" rx="10" fill="#fff" fill-opacity="0.05"/>`);
  return out.join("\n");
}

/** Right-hand side pieces in front of everything: the front wing and its endplate. */
function halfFront(p: string): string {
  const out: string[] = [];
  // Slot shadows: each element's dark twin a few units lower, then the painted elements.
  for (const w of WING) out.push(`<path d="${wingElement(w.y + 4, w.t, 496, w.lift, w.sag)}" fill="${CARBON_DARK}"/>`);
  for (const w of WING) out.push(P(wingElement(w.y, w.t, 496, w.lift, w.sag), w.fill));
  // Accent stripe along the second element and lit top faces on the upper flaps.
  out.push(P("M30 748 C160 751 300 750 376 745 L376 751 C300 756 160 757 30 754 Z", "c3"));
  out.push(`<path d="M-3 727 C140 729 300 729 376 726 L376 731 C300 734 140 734 -3 732 Z" fill="#fff" fill-opacity="0.2"/>`);
  out.push(`<path d="M-3 707 C140 708 300 708 376 707 L376 711 C300 712 140 712 -3 711 Z" fill="#fff" fill-opacity="0.2"/>`);
  // Endplate (seen at a slight angle, so it has width) with a dive plane.
  out.push(P("M482 626 Q482 618 490 618 L504 618 Q512 618 512 626 L512 786 Q512 794 504 794 L490 794 Q482 794 482 786 Z", "c3"));
  out.push(P("M482 700 L512 700 L512 794 Q512 794 504 794 L490 794 Q482 794 482 786 Z", "c1"));
  out.push(P("M482 652 L436 664 L436 674 L482 674 Z", "c3"));
  out.push(`<rect x="482" y="618" width="30" height="176" rx="8" fill="url(#${p}-endShade)"/>`);
  return out.join("\n");
}

/** Whole centre pieces behind the cockpit: rear wing, airbox, engine-cover shoulders. */
function centreBack(): string {
  const out: string[] = [];
  // Rear wing: beam wing, mainplane, DRS flap with a lit top face, actuator pod.
  out.push(`<path d="M-200 306 Q0 318 200 306 L200 326 Q0 338 -200 326 Z" fill="${CARBON}"/>`);
  out.push(P("M-270 266 Q0 258 270 266 L270 300 Q0 308 -270 300 Z", "c1"));
  out.push(P("M-264 224 Q0 216 264 224 L264 258 Q0 266 -264 258 Z", "c2"));
  out.push(`<path d="M-264 224 Q0 216 264 224 L264 232 Q0 224 -264 232 Z" fill="#fff" fill-opacity="0.22"/>`);
  out.push(`<path d="M-270 266 Q0 258 270 266 L270 274 Q0 266 -270 274 Z" fill="#fff" fill-opacity="0.18"/>`);
  out.push(`<path d="M-16 252 L16 252 L20 266 L-20 266 Z" fill="${CARBON}"/>`);
  // Airbox with a dark inlet and a T-cam on top.
  out.push(P("M0 228 C34 236 60 300 66 344 L-66 344 C-60 300 -34 236 0 228 Z", "c1"));
  out.push(`<path d="M0 252 C22 262 40 310 44 336 L-44 336 C-40 310 -22 262 0 252 Z" fill="${CARBON_DARK}"/>`);
  out.push(`<path d="M0 228 C34 236 60 300 66 344 L52 344 C46 302 26 246 0 238 C-26 246 -46 302 -52 344 L-66 344 C-60 300 -34 236 0 228 Z" fill="#fff" fill-opacity="0.16"/>`);
  out.push(`<rect x="-34" y="214" width="68" height="14" rx="5" fill="${CARBON_DARK}"/>`);
  out.push(`<circle cx="-22" cy="221" r="3.5" fill="${LENS}"/><circle cx="22" cy="221" r="3.5" fill="${LENS}"/>`);
  // Engine-cover spine from the airbox down to the cockpit shoulders.
  out.push(P("M-66 340 L66 340 C98 366 122 412 134 464 L-134 464 C-122 412 -98 366 -66 340 Z", "c1"));
  out.push(`<path d="M-66 340 L66 340 C98 366 122 412 134 464 L116 464 C104 420 84 380 54 356 L-54 356 C-84 380 -104 420 -116 464 L-134 464 C-122 412 -98 366 -66 340 Z" fill="#fff" fill-opacity="0.14"/>`);
  return out.join("\n");
}

/** Whole centre pieces around the driver: chassis, headrest, helmet, halo. */
function centreMid(): string {
  const out: string[] = [];
  // Survival cell: wide at the cockpit, narrowing toward the front bulkhead.
  out.push(P("M-126 444 L126 444 C134 480 118 530 96 562 L-96 562 C-118 530 -134 480 -126 444 Z", "c1"));
  // Shadow under the cockpit lip so the chassis top reads as a surface.
  out.push(`<path d="M-126 462 L126 462 C128 474 124 484 120 490 L-120 490 C-124 484 -128 474 -126 462 Z" fill="#000" fill-opacity="0.22"/>`);
  // Cockpit surround with headrest padding, the helmet with a visor, the halo on top.
  out.push(P("M-108 400 Q-108 384 -92 384 L92 384 Q108 384 108 400 L108 462 L-108 462 Z", "c2"));
  out.push(`<path d="M-88 404 Q-88 396 -80 396 L80 396 Q88 396 88 404 L88 458 L-88 458 Z" fill="${CARBON_DARK}"/>`);
  out.push(`<circle cx="0" cy="406" r="58" style="fill:var(--accent)"/>`);
  out.push(`<path d="M-58 406 C-58 374 -32 348 0 348 C32 348 58 374 58 406 Z" fill="#fff" fill-opacity="0.18"/>`);
  out.push(`<path d="M-50 396 Q0 382 50 396 L48 416 Q0 404 -48 416 Z" fill="${CARBON_DARK}"/>`);
  out.push(`<path d="M-50 396 Q0 382 50 396 L48 402 Q0 390 -48 402 Z" fill="#8fd3ff" fill-opacity="0.5"/>`);
  out.push(`<path d="M-134 454 C-134 356 -74 316 0 316 C74 316 134 356 134 454" fill="none" stroke="${CARBON}" stroke-width="24" stroke-linecap="round"/>`);
  out.push(`<path d="M-134 448 C-134 350 -74 310 0 310 C74 310 134 350 134 448" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="6" stroke-linecap="round"/>`);
  out.push(`<path d="M-9 322 L9 322 L16 466 L-16 466 Z" fill="${CARBON}"/>`);
  return out.join("\n");
}

/** The nose, in front of the wing flaps: tapering cone, camera pods, accent stripe, number. */
function centreNose(p: string, number: string, font?: string): string {
  const out: string[] = [];
  // Front bulkhead narrowing into a round-tipped tube that lands on the wing.
  out.push(P("M-98 548 L98 548 C92 586 70 608 54 640 C48 690 44 730 40 754 Q0 792 -40 754 C-44 730 -48 690 -54 640 C-70 608 -92 586 -98 548 Z", "c1"));
  out.push(`<path d="M-54 560 L54 560 C50 596 36 620 28 650 C24 700 22 730 20 752 Q0 770 -20 752 C-22 730 -24 700 -28 650 C-36 620 -50 596 -54 560 Z" fill="url(#${p}-noseLight)"/>`);
  out.push(P("M-3 552 L3 552 L2 778 L-2 778 Z", "c3"));
  out.push(`<rect x="56" y="664" width="18" height="24" rx="6" fill="${CARBON}"/><rect x="-74" y="664" width="18" height="24" rx="6" fill="${CARBON}"/>`);
  out.push(`<circle cx="65" cy="676" r="3.5" fill="${LENS}"/><circle cx="-65" cy="676" r="3.5" fill="${LENS}"/>`);
  out.push(P("M-38 600 Q-38 592 -30 592 L30 592 Q38 592 38 600 L38 656 Q38 664 30 664 L-30 664 Q-38 664 -38 656 Z", "c2"));
  const size = number.length > 2 ? 36 : 46;
  out.push(
    `<text x="0" y="${number.length > 2 ? 642 : 645}" text-anchor="middle" font-size="${size}" font-weight="800" letter-spacing="-1"${font ? ` font-family="${esc(font)}"` : ""} style="fill:var(--c3)">${esc(number)}</text>`,
  );
  return out.join("\n");
}

function defs(p: string): string {
  return (
    `<defs>` +
    `<linearGradient id="${p}-tyreShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.10"/><stop offset="0.35" stop-color="#fff" stop-opacity="0"/><stop offset="0.8" stop-color="#000" stop-opacity="0.25"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient>` +
    `<linearGradient id="${p}-endShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient>` +
    `<linearGradient id="${p}-under" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0a0b" stop-opacity="0.95"/><stop offset="1" stop-color="#0a0a0b" stop-opacity="0.6"/></linearGradient>` +
    `<linearGradient id="${p}-deck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.3"/><stop offset="1" stop-color="#fff" stop-opacity="0.06"/></linearGradient>` +
    `<linearGradient id="${p}-noseLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.24"/><stop offset="1" stop-color="#fff" stop-opacity="0.03"/></linearGradient>` +
    `<radialGradient id="${p}-ground" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="0.6" stop-color="#000" stop-opacity="0.3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>` +
    `<filter id="${p}-soft" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>` +
    `</defs>`
  );
}

/**
 * The car as a <g> in CAR_BOX coordinates. Place it with a transform, e.g.
 * `translate(cx, groundY - CAR_GROUND * s) scale(s)`.
 */
export function carMarkup(o: CarOptions): string {
  const p = o.id ?? "car";
  const { c1, c2, c3, accent } = o.colours;
  const word = o.wordmark ?? "TRACK FORGE";
  const fontAttr = o.font ? ` font-family="${esc(o.font)}"` : "";
  return (
    `<g id="${p}" style="--c1:${c1};--c2:${c2};--c3:${c3};--accent:${accent}">` +
    defs(p) +
    `<ellipse cx="0" cy="${CAR_GROUND + 6}" rx="540" ry="40" fill="url(#${p}-ground)"/>` +
    `<ellipse cx="0" cy="${CAR_GROUND - 18}" rx="360" ry="22" fill="#000" fill-opacity="0.4" filter="url(#${p}-soft)"/>` +
    `<g class="car-back">${centreBack()}</g>` +
    `<g id="${p}-hb" class="car-half">${halfBack(p)}</g><use href="#${p}-hb" transform="scale(-1,1)"/>` +
    `<g class="car-mid">${centreMid()}</g>` +
    `<g id="${p}-hf" class="car-half">${halfFront(p)}</g><use href="#${p}-hf" transform="scale(-1,1)"/>` +
    `<g class="car-nose">${centreNose(p, o.number, o.font)}</g>` +
    `<text x="0" y="250" text-anchor="middle" font-size="24" font-weight="700" letter-spacing="7"${fontAttr} style="fill:var(--c3)">${esc(word)}</text>` +
    `</g>`
  );
}

/** A standalone SVG of the car, for previews and tests. */
export function carSvg(o: CarOptions, width = 1200, background = "#e9e6df"): string {
  const scale = width / CAR_BOX.width;
  const height = Math.round(CAR_BOX.height * scale);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${CAR_BOX.x} ${CAR_BOX.y} ${CAR_BOX.width} ${CAR_BOX.height}">` +
    `<rect x="${CAR_BOX.x}" y="${CAR_BOX.y}" width="${CAR_BOX.width}" height="${CAR_BOX.height}" fill="${background}"/>` +
    carMarkup(o) +
    `</svg>`
  );
}
