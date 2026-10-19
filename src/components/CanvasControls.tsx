"use client";

import type { CarVariant } from "@/components/Car3D";

/*
 * The camera cluster in the canvas corner: Map, Onboard and Orbit as three icon buttons on one
 * quiet pill, and, only while Onboard is active, a second pill for the rig (cockpit or chase).
 * Labels show from the sm breakpoint; on a phone the icons stand alone with their tooltips.
 */

export type Camera = "map" | "onboard" | "orbit";

export const CAMERAS: { id: Camera; label: string; hint: string }[] = [
  { id: "map", label: "Map", hint: "Top-down map: kerbs, gravel, sectors, the ghost car" },
  { id: "onboard", label: "Onboard", hint: "Ride the lap from the cockpit or a chase camera" },
  { id: "orbit", label: "Orbit", hint: "Turn the 3D ribbon; click a corner to fly there" },
];

const RIGS: { id: CarVariant; label: string; hint: string }[] = [
  { id: "cockpit", label: "Cockpit", hint: "T-cam over the helmet" },
  { id: "chase", label: "Chase", hint: "Chase camera behind the car" },
];

function Icon({ name }: { name: Camera | CarVariant }) {
  const common = { className: "size-4 shrink-0", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "map":
      // A small closed circuit with a start tick.
      return (
        <svg {...common}>
          <path d="M3.5 10.5c-1.2-2 .3-4 2.2-4.3 1.9-.3 2.6 1.7 4.3 1.3 1.7-.4 2.7-2.7 1.7-4.1M3.5 10.5c.8 1.4 2.4 2.2 4.4 2.2 2.6 0 4.6-1.5 4.6-3.6 0-1.1-.5-2-1.3-2.6" />
          <path d="M11.5 12.5v-2" />
        </svg>
      );
    case "onboard":
      // A helmet with a visor.
      return (
        <svg {...common}>
          <path d="M3 9.5a5 5 0 0 1 10 0v2.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
          <path d="M3.2 8.6h7.3a1.4 1.4 0 0 1 0 2.8H8.4" />
        </svg>
      );
    case "orbit":
      // A tilted ring around a core.
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.4" />
          <path d="M13.6 5.4c1 1.7-1.3 4.6-5.1 6.6S1.3 14.3.9 12.6M2.4 10.6c-1-1.7 1.3-4.6 5.1-6.6s7.2-2.3 7.6-.6" />
        </svg>
      );
    case "cockpit":
      // A steering wheel.
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" />
          <circle cx="8" cy="8" r="1.4" />
          <path d="M2.6 7.2c2-.9 3.5-1 5.4-1s3.4.1 5.4 1M8 9.4v4" />
        </svg>
      );
    case "chase":
      // A camera.
      return (
        <svg {...common}>
          <rect x="2" y="4.5" width="8.5" height="7" rx="1.5" />
          <path d="M10.5 7.3 14 5.5v5l-3.5-1.8" />
        </svg>
      );
  }
}

interface Props {
  camera: Camera;
  onCamera: (c: Camera) => void;
  rig: CarVariant;
  onRig: (r: CarVariant) => void;
  className?: string;
}

const pill = "flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/60 p-1 backdrop-blur-sm shadow-lg shadow-black/30";
const btn = (active: boolean) =>
  `flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
    active ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-white/10 hover:text-zinc-50"
  }`;

export default function CanvasControls({ camera, onCamera, rig, onRig, className = "" }: Props) {
  return (
    <div className={`pointer-events-auto flex flex-wrap items-start gap-2 ${className}`}>
      <div role="group" aria-label="Camera" className={pill}>
        {CAMERAS.map((c) => (
          <button key={c.id} type="button" aria-pressed={camera === c.id} title={c.hint} onClick={() => onCamera(c.id)} className={btn(camera === c.id)}>
            <Icon name={c.id} />
            <span className="hidden sm:inline">{c.label}</span>
            <span className="sr-only sm:hidden">{c.label}</span>
          </button>
        ))}
      </div>
      {camera === "onboard" && (
        <div role="group" aria-label="Onboard rig" className={pill}>
          {RIGS.map((r) => (
            <button key={r.id} type="button" aria-pressed={rig === r.id} title={r.hint} onClick={() => onRig(r.id)} className={btn(rig === r.id)}>
              <Icon name={r.id} />
              <span className="hidden sm:inline">{r.label}</span>
              <span className="sr-only sm:hidden">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
