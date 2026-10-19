"use client";

import { useEffect, useRef } from "react";
import type { LapClock } from "@/lib/hooks/useLapClock";

/** Play/pause and a scrub bar for the shared lap clock; the slider follows the clock without React in the loop. */
export default function LapTransport({ clock, className = "" }: { clock: LapClock; className?: string }) {
  const sliderRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  useEffect(
    () =>
      clock.subscribe((t) => {
        if (sliderRef.current && !dragging.current) sliderRef.current.value = t.toFixed(2);
      }),
    [clock],
  );

  return (
    <div className={`flex items-center gap-3 text-xs text-muted ${className}`}>
      <button
        type="button"
        onClick={() => clock.toggle()}
        aria-label={clock.playing ? "Pause the lap" : "Play the lap"}
        className="rounded-lg border border-line bg-ink-2 hover:bg-ink-3 px-3 py-1.5 text-zinc-100 font-semibold min-w-[72px]"
      >
        {clock.playing ? "Pause" : "Play"}
      </button>
      <input
        ref={sliderRef}
        type="range"
        min={0}
        max={clock.lapSeconds.toFixed(2)}
        step={0.01}
        defaultValue={0}
        aria-label="Lap position"
        onPointerDown={() => {
          dragging.current = true;
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onInput={(e) => clock.seek(Number((e.target as HTMLInputElement).value))}
        className="flex-1 min-w-[140px] accent-[var(--accent)]"
      />
    </div>
  );
}
