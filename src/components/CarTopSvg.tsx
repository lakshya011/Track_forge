"use client";

/*
 * A Formula 1 car seen from above, as an SVG <symbol> for the circuit map. Drawn in a 112 x 48 box
 * with the nose pointing +x so animateMotion's rotate="auto" aims it along the road. Shapes are kept
 * bold (four dark tyres, two wide wings, a bright body) because on the map the whole car is about
 * 30 px long. Livery colours come through CSS custom properties set on the <use>.
 */

export interface CarTopColours {
  /** Body. */
  c1: string;
  /** Wings and endplates. */
  c2: string;
  /** Flap stripes and the halo. */
  c3: string;
  /** Helmet. */
  accent: string;
}

/** The ghost's colours when no team has been picked: the app's yellow. */
export const GHOST_COLOURS: CarTopColours = { c1: "#f5c542", c2: "#15151a", c3: "#f4f4f5", accent: "#f4f4f5" };

export const CAR_TOP_BOX = { x: -56, y: -24, width: 112, height: 48 } as const;

const TYRE = "#121216";
const TYRE_HI = "#34343c";
const CARBON = "#1b1b1f";

/** A tyre centred on (cx, cy): dark block with a lighter crown so it reads as a cylinder. */
function Tyre({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <rect x={cx - 7} y={cy - 3.6} width={14} height={7.2} rx={1.6} fill={TYRE} stroke="#f4f4f5" strokeOpacity={0.35} strokeWidth={0.7} />
      <rect x={cx - 6} y={cy - 1.4} width={12} height={2.8} rx={1} fill={TYRE_HI} />
    </g>
  );
}

/** The symbol; mount once per SVG and place it with <use href="#id">. */
export function CarTopSymbol({ id }: { id: string }) {
  const b = CAR_TOP_BOX;
  return (
    <symbol id={id} viewBox={`${b.x} ${b.y} ${b.width} ${b.height}`} overflow="visible">
      <defs>
        <filter id={`${id}-glow`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>
      {/* Pale ground glow: the asphalt is dark, so this is what lifts the dark tyres and wings off it */}
      <ellipse cx={0} cy={0} rx={56} ry={22} fill="#f4f4f5" fillOpacity={0.3} filter={`url(#${id}-glow)`} />
      {/* Floor: the dark plank under everything */}
      <path d="M-40 -13 L4 -13 L14 -8 L14 8 L4 13 L-40 13 Z" fill={CARBON} />
      {/* Rear wing with endplates and a DRS flap stripe */}
      <rect x={-52} y={-20} width={9} height={40} rx={1} style={{ fill: "var(--c2)" }} stroke="#f4f4f5" strokeOpacity={0.3} strokeWidth={0.7} />
      <rect x={-54} y={-21.5} width={14} height={3} rx={0.8} style={{ fill: "var(--c2)" }} />
      <rect x={-54} y={18.5} width={14} height={3} rx={0.8} style={{ fill: "var(--c2)" }} />
      <rect x={-49.5} y={-17} width={1.6} height={34} style={{ fill: "var(--c3)" }} opacity={0.9} />
      {/* Rear tyres */}
      <Tyre cx={-33} cy={-16.5} />
      <Tyre cx={-33} cy={16.5} />
      {/* Body: engine cover, sidepods pinched at the rear, cockpit bulge, nose */}
      <path
        d="M-44 -4 L-30 -5 L-24 -12 L-6 -12.5 L4 -9 L12 -6 L30 -4 L50 -2.2 L52 0 L50 2.2 L30 4 L12 6 L4 9 L-6 12.5 L-24 12 L-30 5 L-44 4 Z"
        style={{ fill: "var(--c1)" }}
        stroke="#000"
        strokeOpacity={0.35}
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      {/* Sidepod inlets and the centre spine */}
      <path d="M-6 -12.5 L-2 -9.5 L-2 -6 L-8 -8 Z" fill={CARBON} opacity={0.8} />
      <path d="M-6 12.5 L-2 9.5 L-2 6 L-8 8 Z" fill={CARBON} opacity={0.8} />
      <rect x={-44} y={-1.2} width={44} height={2.4} rx={1} style={{ fill: "var(--c3)" }} opacity={0.55} />
      {/* Airbox and cockpit opening */}
      <path d="M-20 -3.5 L-12 -4.5 L-12 4.5 L-20 3.5 Z" fill={CARBON} />
      <ellipse cx={-4} cy={0} rx={6.5} ry={4.2} fill={CARBON} />
      {/* Helmet */}
      <circle cx={-5} cy={0} r={2.6} style={{ fill: "var(--accent)" }} stroke="#000" strokeOpacity={0.4} strokeWidth={0.5} />
      {/* Halo: a ring ahead of the driver with the centre pillar */}
      <path d="M-11 -5 Q-2 -8.5 6 -3 Q7.5 0 6 3 Q-2 8.5 -11 5" fill="none" style={{ stroke: "var(--c3)" }} strokeWidth={1.6} strokeLinecap="round" />
      <line x1={1} y1={0} x2={6.5} y2={0} style={{ stroke: "var(--c3)" }} strokeWidth={1.4} />
      {/* Suspension arms */}
      <g stroke={CARBON} strokeWidth={1.2} strokeLinecap="round">
        <line x1={20} y1={-3} x2={29} y2={-13} />
        <line x1={30} y1={-3.5} x2={34} y2={-13} />
        <line x1={20} y1={3} x2={29} y2={13} />
        <line x1={30} y1={3.5} x2={34} y2={13} />
        <line x1={-36} y1={-4} x2={-33} y2={-13} />
        <line x1={-36} y1={4} x2={-33} y2={13} />
      </g>
      {/* Front tyres */}
      <Tyre cx={30} cy={-16.5} />
      <Tyre cx={30} cy={16.5} />
      {/* Front wing: main plane, flap stripe and endplates */}
      <path d="M44 -20 L52 -20 L54 -14 L54 14 L52 20 L44 20 L46 6 L46 -6 Z" style={{ fill: "var(--c2)" }} stroke="#f4f4f5" strokeOpacity={0.3} strokeWidth={0.7} />
      <rect x={43} y={-21.5} width={13} height={3} rx={0.8} style={{ fill: "var(--c2)" }} />
      <rect x={43} y={18.5} width={13} height={3} rx={0.8} style={{ fill: "var(--c2)" }} />
      <path d="M47 -17 L47 -7 M47 7 L47 17" fill="none" style={{ stroke: "var(--c3)" }} strokeWidth={1.4} />
      {/* Nose tip over the wing */}
      <path d="M40 -3 L52 -1.6 L52 1.6 L40 3 Z" style={{ fill: "var(--c1)" }} />
      {/* T-cam */}
      <rect x={-16} y={-1} width={3} height={2} rx={0.5} style={{ fill: "var(--c3)" }} />
    </symbol>
  );
}

/** Inline style that recolours a <use> of the symbol. */
export function carTopStyle(c: CarTopColours): React.CSSProperties {
  return { "--c1": c.c1, "--c2": c.c2, "--c3": c.c3, "--accent": c.accent } as React.CSSProperties;
}
