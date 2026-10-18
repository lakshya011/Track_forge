"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { GHOST_COLOURS, type CarTopColours } from "@/components/CarTopSvg";
import TrackSvg, { SECTOR_COLORS, type TrackSkin } from "@/components/TrackSvg";
import { ELEVATION_RAMP, cornerName } from "@/lib/geo/decor";
import type { LapProfile } from "@/lib/geo/speed";
import type { Track } from "@/lib/geo/types";
import type { LapClock } from "@/lib/hooks/useLapClock";
import { TEAMS, isTeamId, type TeamId } from "@/lib/poster/teams";

const DriverView = dynamic(() => import("@/components/DriverView"), {
  ssr: false,
  loading: () => <div className="h-[300px] sm:h-[460px] rounded-xl bg-ink-3 grid place-items-center text-muted">Loading the onboard…</div>,
});

export type CircuitMode = "top" | "driver";

const MODES: { id: CircuitMode; label: string; hint: string }[] = [
  { id: "top", label: "Top view", hint: "The furnished map with the ghost car" },
  { id: "driver", label: "Driver view", hint: "Onboard, from the cockpit or a chase camera" },
];

interface Props {
  track: Track;
  clock: LapClock;
  profile: LapProfile;
  carColours: CarTopColours;
  mode: CircuitMode;
  onMode: (m: CircuitMode) => void;
  activeCorner: number | null;
  onActiveCorner: (n: number | null) => void;
}

/** The car wears the chosen team's colours (link, then remembered pick), else the ghost yellow. */
export function carColoursFor(team: TeamId | null, remembered: string): CarTopColours {
  const id = team ?? (isTeamId(remembered) ? remembered : null);
  if (!id) return GHOST_COLOURS;
  const t = TEAMS[id];
  return { c1: t.c1, c2: t.c2, c3: t.c3, accent: t.accent };
}

/** The Circuit tab: a Top view / Driver view switch, the furnished 2D map with its legend and skin toggle, or the onboard. */
export default function CircuitPanel({ track, clock, profile, carColours, mode, onMode, activeCorner, onActiveCorner }: Props) {
  const [skin, setSkin] = useState<TrackSkin>("sector");

  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border border-line bg-ink-2 p-0.5 w-fit text-sm" role="tablist" aria-label="Circuit view">
        {MODES.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} title={m.hint} onClick={() => onMode(m.id)} className={`px-3 py-1 rounded-md ${mode === m.id ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-muted hover:text-zinc-100"}`}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === "driver" ? (
        <DriverView track={track} clock={clock} profile={profile} carColours={carColours} />
      ) : (
        <>
      <TrackSvg track={track} detail="full" skin={skin} clock={clock} profile={profile} carColours={carColours} activeCorner={activeCorner} onActiveCorner={onActiveCorner} className="w-full h-auto" />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {skin === "sector" ? (
            <>
              {["Sector 1", "Sector 2", "Sector 3"].map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="h-2 w-5 rounded-full" style={{ background: SECTOR_COLORS[i] }} />
                  {s}
                </span>
              ))}
            </>
          ) : (
            <span className="flex items-center gap-1.5">
              Low
              <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${ELEVATION_RAMP.join(", ")})` }} />
              High
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-[#60a5fa]" /> Left
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-[#fb923c]" /> Right
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-sm bg-[repeating-linear-gradient(90deg,#f4f4f5_0_4px,#e8322e_4px_8px)]" /> Kerb
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-sm bg-[#b8a16a]/50" /> Gravel
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-5 rounded-full" style={{ background: carColours.c1 }} /> Ghost car · hover to pause
          </span>
        </div>
        <div className="flex rounded-lg border border-line bg-ink-2 p-0.5" role="tablist" aria-label="Colour the lap by">
          {(
            [
              ["sector", "Sectors"],
              ["elevation", "Elevation"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={skin === id} onClick={() => setSkin(id)} className={`px-2.5 py-1 rounded-md ${skin === id ? "bg-zinc-100 text-zinc-900 font-semibold" : "hover:text-zinc-100"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

interface CornerListProps {
  track: Track;
  activeCorner: number | null;
  onActiveCorner: (n: number | null) => void;
  /** When given, each card is a button (the Elevation view flies its camera to the corner). */
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
