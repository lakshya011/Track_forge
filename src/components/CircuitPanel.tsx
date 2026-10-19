"use client";

import dynamic from "next/dynamic";
import CanvasControls, { type Camera } from "@/components/CanvasControls";
import type { CarVariant } from "@/components/Car3D";
import { GHOST_COLOURS, type CarTopColours } from "@/components/CarTopSvg";
import LapTransport from "@/components/LapTransport";
import type { FlyRequest } from "@/components/Track3D";
import TrackSvg, { SECTOR_COLORS, type TrackSkin } from "@/components/TrackSvg";
import { ELEVATION_RAMP, cornerName } from "@/lib/geo/decor";
import type { LapProfile } from "@/lib/geo/speed";
import type { Track } from "@/lib/geo/types";
import type { LapClock } from "@/lib/hooks/useLapClock";
import { TEAMS, isTeamId, type TeamId } from "@/lib/poster/teams";

const loading = (what: string) =>
  function Loading() {
    return <div className="absolute inset-0 grid place-items-center text-muted bg-ink-3">{what}</div>;
  };
const DriverView = dynamic(() => import("@/components/DriverView"), { ssr: false, loading: loading("Loading the onboard…") });
const Track3D = dynamic(() => import("@/components/Track3D"), { ssr: false, loading: loading("Loading the 3D ribbon…") });

interface Props {
  track: Track;
  clock: LapClock;
  profile: LapProfile;
  carColours: CarTopColours;
  camera: Camera;
  onCamera: (c: Camera) => void;
  rig: CarVariant;
  onRig: (r: CarVariant) => void;
  skin: TrackSkin;
  onSkin: (s: TrackSkin) => void;
  activeCorner: number | null;
  onActiveCorner: (n: number | null) => void;
  /** A corner card or 3D marker was clicked; the orbit camera flies there. */
  onSelectCorner: (n: number) => void;
  flyTo: FlyRequest | null;
}

/** The car wears the chosen team's colours (link, then remembered pick), else the ghost yellow. */
export function carColoursFor(team: TeamId | null, remembered: string): CarTopColours {
  const id = team ?? (isTeamId(remembered) ? remembered : null);
  if (!id) return GHOST_COLOURS;
  const t = TEAMS[id];
  return { c1: t.c1, c2: t.c2, c3: t.c3, accent: t.accent };
}

/**
 * The Circuit tab is one canvas with three cameras: the furnished map, the onboard and the 3D
 * orbit, picked from the cluster in the corner. Under the canvas sits what each camera needs: the
 * map's legend (whose sector and elevation chips switch the skin), the onboard's transport, or a
 * hint for the orbit.
 */
export default function CircuitPanel({ track, clock, profile, carColours, camera, onCamera, rig, onRig, skin, onSkin, activeCorner, onActiveCorner, onSelectCorner, flyTo }: Props) {
  const chip = (active: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
      active ? "border-zinc-500 bg-ink-3 text-zinc-100" : "border-transparent text-muted hover:text-zinc-100 hover:border-line"
    }`;

  return (
    <div className="space-y-3">
      {/* The map keeps its own proportions; the two 3D cameras need some height on a phone. */}
      <div className={`relative w-full aspect-[1000/620] rounded-xl overflow-hidden bg-ink ${camera === "map" ? "" : "min-h-[300px] sm:min-h-[420px]"}`}>
        {camera === "onboard" ? (
          <DriverView track={track} clock={clock} profile={profile} carColours={carColours} variant={rig} />
        ) : camera === "orbit" ? (
          <div className="absolute inset-0">
            <Track3D track={track} clock={clock} profile={profile} carColours={carColours} activeCorner={activeCorner} onActiveCorner={onActiveCorner} onSelectCorner={onSelectCorner} flyTo={flyTo} />
          </div>
        ) : (
          <TrackSvg track={track} detail="full" skin={skin} clock={clock} profile={profile} carColours={carColours} activeCorner={activeCorner} onActiveCorner={onActiveCorner} className="absolute inset-0 w-full h-full" />
        )}
        <CanvasControls camera={camera} onCamera={onCamera} rig={rig} onRig={onRig} className="absolute left-3 top-3 z-10" />
      </div>

      {camera === "map" && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-xs text-muted" role="group" aria-label="Legend">
          {["Sector 1", "Sector 2", "Sector 3"].map((s, i) => (
            <button key={s} type="button" aria-pressed={skin === "sector"} title="Colour the lap by sector" onClick={() => onSkin("sector")} className={chip(skin === "sector")}>
              <span className="h-2 w-5 rounded-full" style={{ background: SECTOR_COLORS[i] }} />
              {s}
            </button>
          ))}
          <button type="button" aria-pressed={skin === "elevation"} title="Colour the lap by altitude" onClick={() => onSkin("elevation")} className={chip(skin === "elevation")}>
            Low
            <span className="h-2 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${ELEVATION_RAMP.join(", ")})` }} />
            High
          </button>
          <span className="mx-1 h-3 w-px bg-line" aria-hidden />
          <span className="flex items-center gap-1.5 px-1.5">
            <span className="size-3 rounded-full border-2 border-[#60a5fa]" /> Left
          </span>
          <span className="flex items-center gap-1.5 px-1.5">
            <span className="size-3 rounded-full border-2 border-[#fb923c]" /> Right
          </span>
          <span className="flex items-center gap-1.5 px-1.5">
            <span className="h-2 w-5 rounded-sm bg-[repeating-linear-gradient(90deg,#f4f4f5_0_4px,#e8322e_4px_8px)]" /> Kerb
          </span>
          <span className="flex items-center gap-1.5 px-1.5">
            <span className="h-2 w-5 rounded-sm bg-[#b8a16a]/50" /> Gravel
          </span>
          <span className="flex items-center gap-1.5 px-1.5">
            <span className="h-2 w-5 rounded-full" style={{ background: carColours.c1 }} /> Ghost car · hover to pause
          </span>
        </div>
      )}

      {camera === "onboard" && <LapTransport clock={clock} />}

      {camera === "orbit" && <p className="text-xs text-muted">Drag to turn the ribbon, scroll to zoom. Hover a corner card to light its marker; click one to fly there.</p>}
    </div>
  );
}

interface CornerListProps {
  track: Track;
  activeCorner: number | null;
  onActiveCorner: (n: number | null) => void;
  /** When given, each card is a button (the orbit camera flies to the corner). */
  onSelectCorner?: (n: number) => void;
}

/** Every corner as a card; hovering one pulses its apex on the map (and lights its marker in 3D). */
export function CornerList({ track, activeCorner, onActiveCorner, onSelectCorner }: CornerListProps) {
  return (
    <ol className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 text-sm" aria-label="Corners">
      {track.corners.map((c) => {
        const isActive = activeCorner === c.number;
        const place = c.source ? cornerName(c, track.sources).replace(/^T\d+ · /, "") : "Link road";
        const body = (
          <>
            <span className={`display text-2xl font-bold w-8 text-center rounded-md ${c.direction === "L" ? "text-[#60a5fa]" : "text-[#fb923c]"}`}>{c.number}</span>
            <span className="min-w-0 text-left">
              <span className={`block truncate font-medium ${c.source ? "" : "text-muted"}`}>{place}</span>
              <span className="block text-muted text-xs">
                {c.direction === "L" ? "Left" : "Right"} · {Math.abs(Math.round(c.angleDeg))}° · {Math.round(c.dist)} m
              </span>
            </span>
          </>
        );
        const cls = `w-full rounded-lg border px-3 py-2 flex items-center gap-3 transition-colors ${isActive ? "border-zinc-400 bg-ink-3" : "border-line bg-ink-2"}`;
        return (
          <li key={c.number} onPointerEnter={() => onActiveCorner(c.number)} onPointerLeave={() => onActiveCorner(null)} className="min-w-0 flex">
            {onSelectCorner ? (
              <button
                type="button"
                onClick={() => onSelectCorner(c.number)}
                onFocus={() => onActiveCorner(c.number)}
                onBlur={() => onActiveCorner(null)}
                title={`Fly to turn ${c.number}`}
                className={`${cls} cursor-pointer hover:border-zinc-500 focus-visible:outline-2 focus-visible:outline-accent`}
              >
                {body}
              </button>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
