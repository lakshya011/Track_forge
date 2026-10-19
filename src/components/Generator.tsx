"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Camera } from "@/components/CanvasControls";
import type { CarVariant } from "@/components/Car3D";
import CircuitPanel, { CornerList, carColoursFor } from "@/components/CircuitPanel";
import Inspection from "@/components/Inspection";
import Landing from "@/components/Landing";
import LicenceCard from "@/components/LicenceCard";
import PosterGallery from "@/components/PosterGallery";
import { circuitById, circuits, letters } from "@/lib/data";
import { saveToGarage } from "@/lib/garage";
import { GenerateError, generateTrack, homologate, lapsFor, lengthCircuitFor, sanitizeName } from "@/lib/geo";
import { cornerNumbersByLetter, formatCornerRun } from "@/lib/geo/decor";
import { lapProfile } from "@/lib/geo/speed";
import type { Track } from "@/lib/geo/types";
import { useLapClock } from "@/lib/hooks/useLapClock";
import type { FlyRequest } from "@/components/Track3D";
import type { TrackSkin } from "@/components/TrackSvg";
import { isTeamId, type TeamId } from "@/lib/poster/teams";
import { displayFontStyle } from "@/lib/poster/fonts";
import { isPosterRatio, posterStyleFrom, type PosterRatio, type PosterStyle } from "@/lib/poster/types";
import { usePosterPrefs } from "@/lib/posterPrefs";
import { buildShareUrl, shareQuery } from "@/lib/share";

type View = "circuit" | "poster";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "circuit", label: "Circuit", hint: "Map, onboard and 3D orbit on one canvas" },
  { id: "poster", label: "Poster", hint: "Four styles, PNG or SVG, share" },
];

const HOMOLOGATION_YEAR = 2026;

/** A fresh seed for Shuffle: never the current one. */
function rollSeed(current: number): number {
  return (current + 1 + Math.floor(Math.random() * 1000)) % 1_000_000;
}

/** State and routing for the homologation flow: landing, inspection, result. */
export default function Generator() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const urlName = sanitizeName(params.get("name") ?? "");
  const urlSeed = Number(params.get("seed") ?? 0) || 0;
  // Lap length follows the name. An explicit ?len= (older shared links) silently overrides it.
  const urlLenRaw = params.get("len");
  const urlLen = urlLenRaw && circuitById.has(urlLenRaw) ? urlLenRaw : urlName ? lengthCircuitFor(urlName, circuits).id : "";
  // Poster style, ratio and team livery ride along in the link so a shared poster opens on the same look.
  const posterParam = params.get("poster");
  const posterStyle: PosterStyle = posterStyleFrom(posterParam) ?? "sector";
  const ratioParam = params.get("ratio");
  const posterRatio: PosterRatio = isPosterRatio(ratioParam) ? ratioParam : "2:3";
  const teamParam = params.get("team");
  const posterTeam: TeamId | null = isTeamId(teamParam) ? teamParam : null;

  const [view, setView] = useState<View>(posterParam ? "poster" : "circuit");
  // The circuit canvas: which camera, which onboard rig and which map skin.
  const [camera, setCamera] = useState<Camera>("map");
  const [rig, setRig] = useState<CarVariant>("cockpit");
  const [skin, setSkin] = useState<TrackSkin>("sector");
  const [inspecting, setInspecting] = useState(false);
  const prefs = usePosterPrefs();
  // The display font, embedded once per page so posters, thumbnails and the shared licence card match the screen.
  const [fontFace, setFontFace] = useState("");
  useEffect(() => {
    let live = true;
    displayFontStyle().then((css) => {
      if (live && css) setFontFace(css);
    });
    return () => {
      live = false;
    };
  }, []);
  const [activeCorner, setActiveCorner] = useState<number | null>(null);
  // A corner card or 3D marker was clicked: the orbit camera flies there (nonce so repeats work).
  const [flyTo, setFlyTo] = useState<FlyRequest | null>(null);
  const flyToCorner = useCallback((n: number) => setFlyTo((f) => ({ n, nonce: (f?.nonce ?? 0) + 1 })), []);

  const generated = useMemo((): { track: Track | null; error: string | null } => {
    if (!urlName) return { track: null, error: null };
    try {
      return { track: generateTrack(urlName, urlSeed, urlLen, { circuits, letters }), error: null };
    } catch (e) {
      return { track: null, error: e instanceof GenerateError ? e.message : "Something went wrong generating this track." };
    }
  }, [urlName, urlSeed, urlLen]);
  const track = generated.track;
  const homologation = useMemo(() => (track ? homologate(track, letters) : null), [track]);
  // One lap clock and speed profile drive the map's ghost, the 3D car and the driver view together.
  const lapSeconds = homologation?.lapTime.seconds ?? 60;
  const clock = useLapClock(lapSeconds);
  const profile = useMemo(() => (track ? lapProfile(track, lapSeconds) : null), [track, lapSeconds]);

  // Remember finished circuits in the garage (a convenience; failures are swallowed).
  useEffect(() => {
    if (!track || !homologation || inspecting) return;
    saveToGarage({
      name: track.name,
      seed: track.seed,
      len: urlLenRaw && circuitById.has(urlLenRaw) ? urlLenRaw : undefined,
      grade: homologation.grade,
      difficulty: homologation.difficulty,
      lapTime: homologation.lapTime.formatted,
    });
  }, [track, homologation, inspecting, urlLenRaw]);

  const push = useCallback(
    (name: string, seed: number, lenId?: string, poster?: { style: PosterStyle; ratio: PosterRatio; team: TeamId | null }) => {
      const q = shareQuery({ name, seed }, { ...poster, len: lenId });
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [router, pathname],
  );
  const setPoster = (style: PosterStyle, ratio: PosterRatio, team: TeamId | null = posterTeam) => {
    if (!track) return;
    push(track.name, track.seed, urlLenRaw ?? undefined, { style, ratio, team });
  };

  const submit = (name: string) => {
    setView("circuit");
    setInspecting(true);
    push(name, 0);
  };
  const reopen = (name: string, seed: number, len?: string) => {
    setView("circuit");
    setInspecting(false);
    push(name, seed, len);
  };
  const shuffle = () => {
    if (!track) return;
    setInspecting(false);
    push(track.name, rollSeed(urlSeed), urlLenRaw ?? undefined, { style: posterStyle, ratio: posterRatio, team: posterTeam });
  };
  const startOver = () => {
    setInspecting(false);
    router.replace(pathname, { scroll: false });
  };
  const onInspected = useCallback(() => setInspecting(false), []);

  if (!track || !homologation) {
    return <Landing key={urlName} initialName={urlName} onSubmit={submit} onReopen={reopen} error={generated.error} />;
  }

  const lengthCircuit = circuitById.get(urlLen);
  // Built from the real location (not usePathname, which drops a GitHub Pages base path).
  const shareUrl = buildShareUrl(track, { style: posterStyle, ratio: posterRatio, team: posterTeam, len: urlLenRaw });
  const cornersByLetter = cornerNumbersByLetter(track);
  const carColours = carColoursFor(posterTeam, prefs.team);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-accent">{inspecting ? "Under inspection" : "Homologated circuit"}</p>
          <h1 className="display text-5xl sm:text-7xl font-extrabold tracking-wide leading-none break-words">{track.name}</h1>
          <p className="text-muted text-sm mt-2">
            {(track.length / 1000).toFixed(3)} km · {track.corners.length} corners · {lapsFor(track.length)} laps · longest straight {Math.round(track.longestStraight.length)} m
            {lengthCircuit && <> · same lap length as {lengthCircuit.name}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={shuffle} title="Pick different circuit sections for the same name" className="display rounded-lg border border-line bg-ink-3 hover:bg-zinc-800 px-4 py-2.5 text-lg font-bold">
            Shuffle sections
          </button>
          <button onClick={startOver} className="display rounded-lg border border-line bg-ink-2 hover:bg-ink-3 px-4 py-2.5 text-lg font-bold text-muted hover:text-zinc-100">
            New name
          </button>
        </div>
      </header>

      {track.warning && !inspecting && <p className="text-sm text-amber-300 bg-amber-950/40 border border-amber-900 rounded-lg px-3 py-2">{track.warning}</p>}

      {inspecting ? (
        <div className="rounded-2xl border border-line bg-ink-2 p-3 sm:p-5">
          <Inspection key={`${track.name}-${track.seed}-${track.lengthCircuitId}`} track={track} onDone={onInspected} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
          <div className="space-y-6 min-w-0">
            <div className="space-y-4 min-w-0">
              <nav className="flex rounded-lg border border-line bg-ink-2 p-1 text-sm w-fit" aria-label="Views">
                {VIEWS.map((v) => (
                  <button key={v.id} onClick={() => setView(v.id)} title={v.hint} className={`px-3 py-1.5 rounded-md ${view === v.id ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-muted hover:text-zinc-100"}`}>
                    {v.label}
                  </button>
                ))}
              </nav>
              <div className="rounded-2xl border border-line bg-ink-2 p-3 sm:p-5">
                {view === "poster" ? (
                  <PosterGallery
                    track={track}
                    homologation={homologation}
                    lengthCircuit={lengthCircuit}
                    year={HOMOLOGATION_YEAR}
                    style={posterStyle}
                    ratio={posterRatio}
                    team={posterTeam}
                    shareUrl={shareUrl}
                    fontFace={fontFace}
                    onStyle={(s) => setPoster(s, posterRatio)}
                    onRatio={(r) => setPoster(posterStyle, r)}
                    onTeam={(t) => setPoster(posterStyle, posterRatio, t)}
                  />
                ) : (
                  <CircuitPanel
                    track={track}
                    clock={clock}
                    profile={profile!}
                    carColours={carColours}
                    camera={camera}
                    onCamera={setCamera}
                    rig={rig}
                    onRig={setRig}
                    skin={skin}
                    onSkin={setSkin}
                    activeCorner={activeCorner}
                    onActiveCorner={setActiveCorner}
                    onSelectCorner={flyToCorner}
                    flyTo={flyTo}
                  />
                )}
              </div>
            </div>

            {/* The poster tab is about the picture; the corner list and source cards belong to the Circuit view. */}
            {view !== "poster" && (
              <section className="space-y-2 min-w-0">
                <h2 className="text-xs uppercase tracking-[0.25em] text-muted">
                  {track.corners.length} corners · hover to find each apex{camera === "orbit" && " · click to fly there"}
                </h2>
                <CornerList track={track} activeCorner={activeCorner} onActiveCorner={setActiveCorner} onSelectCorner={camera === "orbit" ? flyToCorner : undefined} />
              </section>
            )}

            {view !== "poster" && (
              <section className="space-y-2 min-w-0">
                <h2 className="text-xs uppercase tracking-[0.25em] text-muted">Where each letter comes from</h2>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {track.sources.map((s, i) => (
                    <div key={i} className="rounded-xl border border-line bg-ink-2 p-3 flex gap-3 items-center">
                      <span className="display text-4xl font-extrabold w-10 text-center">{s.letter}</span>
                      <div className="min-w-0 text-sm">
                        <div className="font-medium truncate">{s.circuit.name}</div>
                        <div className="text-muted text-xs truncate">
                          {s.circuit.location} · {s.section.label ?? `${s.section.start}–${s.section.end} m`}
                        </div>
                        <div className="text-xs mt-0.5">
                          {cornersByLetter[i].length > 0 ? <span className="text-zinc-300">{formatCornerRun(cornersByLetter[i])}</span> : <span className="text-muted">No corners of its own</span>}
                          {track.ligatures.includes(i) && <span className="text-accent-2"> · shares a stroke with the next letter</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="lg:sticky lg:top-6">
            <LicenceCard track={track} homologation={homologation} shareUrl={shareUrl} year={HOMOLOGATION_YEAR} fontFace={fontFace} />
          </div>
        </div>
      )}
    </section>
  );
}
