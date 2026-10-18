"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import CircuitSvg from "@/components/CircuitSvg";
import TrackSvg from "@/components/TrackSvg";
import { reliefOf } from "@/lib/geo/homologation";
import type { Track } from "@/lib/geo/types";

interface Props {
  track: Track;
  /** Called when the inspection finishes or is skipped. */
  onDone: () => void;
}

const LETTER_STAGGER = 560;
const LETTERS_HOLD = 700;
const DRAW_MS = 2400;
const COUNT_HOLD = 1500;

/** Counts a number up from 0 over `ms` once `go` is true. */
function CountUp({ to, ms = 1400, go, format }: { to: number; ms?: number; go: boolean; format: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!go) return;
    const el = ref.current;
    if (!el) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go, to, ms, format]);
  return (
    <span ref={ref} className="tabular">
      {format(0)}
    </span>
  );
}

const fmtInt = (v: number) => String(Math.round(v));
const fmtM = (v: number) => `${Math.round(v)} m`;

/**
 * The build moment: each letter's section is stamped "approved" in turn while the start lights
 * fill red; then the lights go out, the lap draws on and the first numbers count up.
 */
export default function Inspection({ track, onDone }: Props) {
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<"letters" | "draw">("letters");
  const n = track.sources.length;
  const relief = reliefOf(track);

  // The parent remounts this component (via key) for every new track, so state starts fresh here.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= n; i++) timers.push(setTimeout(() => setShown(i), i * LETTER_STAGGER));
    const drawAt = n * LETTER_STAGGER + LETTERS_HOLD;
    timers.push(setTimeout(() => setPhase("draw"), drawAt));
    timers.push(setTimeout(onDone, drawAt + DRAW_MS + COUNT_HOLD));
    return () => timers.forEach(clearTimeout);
  }, [track, n, onDone]);

  const current = Math.min(shown, n);
  const lights = phase === "draw" ? 0 : Math.ceil((5 * current) / Math.max(1, n));
  const src = track.sources[Math.max(0, current - 1)];
  const status =
    phase === "draw"
      ? "Lights out. Drawing the lap."
      : current === 0
        ? "Opening the file."
        : `Section ${current} of ${n} · ${src.letter} · ${src.section.label ?? src.circuit.location}`;

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2" aria-label={`${lights} of 5 start lights lit`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`light ${i < lights ? "on" : ""}`} />
          ))}
        </div>
        <p className="text-sm text-muted truncate" aria-live="polite">
          {status}
        </p>
        <button onClick={onDone} className="text-xs px-3 py-1.5 rounded-full border border-line bg-ink-2/80 text-muted hover:text-zinc-100 shrink-0">
          Skip
        </button>
      </div>
      <AnimatePresence mode="wait">
        {phase === "letters" ? (
          <motion.div key="letters" exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35 }} className="min-h-[340px] flex items-center">
            <div className="flex flex-wrap justify-center gap-3 w-full">
              {track.sources.map((s, i) => (
                <motion.div
                  key={`${s.section.id}-${i}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={i < shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
                  transition={{ duration: 0.3 }}
                  className="relative w-[140px] sm:w-[168px] rounded-xl border border-line bg-ink-2 p-2 overflow-hidden"
                >
                  <div className="aspect-square">{i < shown && <CircuitSvg circuit={s.circuit} highlight={s.section} size={220} baseColor="#3a3a44" animate />}</div>
                  <div className="flex items-baseline justify-between mt-1 gap-2">
                    <span className="display text-3xl font-bold leading-none">{s.letter}</span>
                    <span className="text-[11px] text-muted text-right leading-tight truncate">{s.section.label ?? s.circuit.location}</span>
                  </div>
                  {i < shown && (
                    <span className="stamp-in absolute top-2 right-2 display text-sm font-extrabold tracking-[0.2em] text-accent-3 border-2 border-accent-3 rounded px-1.5 py-0.5 bg-ink/70" style={{ animationDelay: "0.25s" }}>
                      APPROVED
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key="draw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-3">
            <TrackSvg track={track} detail="outline" animate lights={0} className="w-full h-auto" />
            <dl className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
              {[
                { label: "Corners counted", node: <CountUp to={track.corners.length} go format={fmtInt} /> },
                { label: "Longest straight", node: <CountUp to={track.longestStraight.length} go format={fmtM} /> },
                { label: "Elevation range", node: <CountUp to={relief} go format={fmtM} /> },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.25 }} className="rounded-xl border border-line bg-ink-2/70 px-2 py-3">
                  <dt className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted">{s.label}</dt>
                  <dd className="display text-3xl sm:text-4xl font-extrabold leading-none mt-1">{s.node}</dd>
                </motion.div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
