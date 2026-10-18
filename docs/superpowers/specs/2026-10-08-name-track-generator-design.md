# Name-to-F1-Track Generator — Implementation Plan

## Context

Greenfield project in an empty directory. The idea: F1 track design is opaque to most fans, so make it playful. Every uppercase letter A–Z is represented by a real stretch of a real F1 circuit that happens to look like that letter (Maggotts/Becketts at Silverstone reads as an "S"). A user types a name, watches each letter get carved out of its source circuit, then sees the sections stitched into one closed-loop custom circuit. Three views (plain layout, corners highlighted and numbered, 3D elevation ribbon) and a poster-style export like the Spa frame in the user's reference image.

Decisions already made with the user:
- Curation tool **and** a hand-seeded A–Z set, so the app works on day one.
- The user picks a real circuit's length from a dropdown; the generated loop is scaled to that length, laps derived from the 305 km race distance.
- Elevation view is a real 3D ribbon (Three.js / react-three-fiber).
- Static Next.js on Vercel, no database. Data is JSON in the repo, generation is client-side.

Data sources (verified):
- `bacinger/f1-circuits` on GitHub (MIT). `f1-circuits.geojson`: 40 circuits as lon/lat LineStrings (Spa has 192 points) with `{id, Location, Name, opened, firstgp, length (m), altitude}`. Includes current venues plus former ones (Hockenheim, Nürburgring, Magny-Cours, Estoril, Istanbul, Sepang, Kyalami, Watkins Glen, Buenos Aires, Jacarepaguá, Indianapolis, Sochi, Mugello, Portimão). Metadata (length, opened) to be cross-checked against formula1.com / Wikipedia during seeding; coordinates are 2D only.
- Per-vertex elevation from Open Topo Data (`api.opentopodata.org`, 100 pts/request, 1 req/s, 1000 req/day) fetched once by a build script and baked into our JSON. ~30k points total, ~300 requests, within limits.

Trademark note: do not ship the F1 logo or "Formula 1" branding as if official. Use neutral wording ("inspired by real Grand Prix circuits") and an "unofficial, not affiliated" footer.

## Assumptions (routine calls, stated so they can be overridden)
- Name input: uppercase A–Z and spaces only, 1–12 characters. Other characters are stripped. A space becomes a longer straight gap.
- Letters are laid out left to right in reading order on a common baseline; the closing "pit straight" runs underneath, and the start/finish line sits at its midpoint.
- Each letter draws one random section from the pool for that letter, seeded so `?name=JOHN&seed=1234&len=be-1925` reproduces the same track.
- "Opened" on the poster = current year; a footer lists the source circuits for each letter.

## Stack
Next.js 15 (App Router, TypeScript, Tailwind, `src/` dir), `@react-three/fiber` + `@react-three/drei` for the 3D view, `framer-motion` for the build animation, Vitest for pure geometry tests. No backend routes except static files.

## Repository layout

```
scripts/
  fetch-circuits.ts      download f1-circuits.geojson, write data/raw/
  bake-elevation.ts      project, resample at 10 m, fetch elevation, write data/circuits.json (resumable)
data/
  circuits.json          [{id,name,location,country,opened,firstgp,length,points:[[x,y,z,dist],...]}]
  letters.json           LetterSection[] (curated, A–Z, ≥1 variant each; aim 2–3 for common letters)
src/lib/geo/
  types.ts  rng.ts  project.ts  section.ts  stitch.ts  post.ts  corners.ts  elevation.ts  svg.ts  index.ts
src/lib/geo/__tests__/   Vitest specs, one per module + generateTrack integration
src/components/
  NameForm.tsx  LengthPicker.tsx  BuildSequence.tsx  TrackSvg.tsx  CornerOverlay.tsx  Track3D.tsx
  ViewTabs.tsx  Poster.tsx  ExportButtons.tsx
src/app/
  page.tsx               generator (reads/writes URL params)
  curate/page.tsx        internal curation tool
  layout.tsx
docs/superpowers/specs/2026-10-08-name-track-generator-design.md   (copy of this plan, committed as the spec)
```

## Geometry library (pure TS, DOM-free except `svgToPng`)

**project.ts** — `lonLatToLocal` (equirectangular about centroid, metres), `closeRing`, `cumulativeDist`, `resample(pts, step=10)` with linear x/y/z interpolation and `dist` on every sample.

**section.ts** — `LetterSection {id, letter, circuitId, start, end, reverse, rotation, flipX, label}`; `start`/`end` are always in ring order and extraction wraps through dist 0 when `end < start`; travel direction is only `reverse`. `extractSection` slices and re-zeros dist, throws `SectionTooShort` under 30 m or 4 samples. `normalizeGlyph` centres, rotates, optionally mirrors, scales to cap height 1, translates to minX=minY=0, returns `{pts, width, entry, exit, entryTangent, exitTangent}`. Real z is preserved (only x/y scaled).

**stitch.ts** — `layoutGlyphs` (cursor along x, gap 0.35, space gap 1.0). `connectCubic(p0,t0,p1,t1,k=0.4)` cubic Bezier with control length clamped to [0.15, 0.8]·|p1−p0|. `buildReturnPath`: last exit → hairpin down at right (`maxX+0.4, −offset`) → straight left to (`minX−0.4, −offset`) → curve up into first entry. `assembleLoop` concatenates, rotates the array so index 0 is the S/F point on the straight, closes the ring, records `joinIndices`.

**post.ts** — `smoothJoins` (window-3 moving average within 4 samples of each join, 2 passes), `scaleToLength` (x/y only), `resampleLoop` at 10 m, `selfIntersects` (O(n²) orientation tests, fine for ≤1500 segments). `generateTrack(name, seed, lenCircuitId, opts)` runs: sanitise → draw sections with seeded RNG → build → up to 5 retries widening gap/offset → up to 3 re-rolls → return with `warning` flag if still intersecting.

**corners.ts** — heading/curvature with ±3 sample window; hysteresis enter 0.012 rad/m, exit 0.006; discard turns under 20°; merge same-direction corners within 40 m; apex at max curvature; numbered from S/F. `sectors` at L/3, 2L/3 snapped to nearest corner exit within 150 m. `longestStraight`.

**elevation.ts** — per-glyph `zGain = min(1, 60/zRange)` so a Spa section (400 m) and Monaco (20 m) don't produce a 380 m connector climb; connectors and return path use cosine easing between end heights.

**rng.ts** — FNV-1a `hashString`, `mulberry32`; seed = `hash(name) ^ seed`. One draw per letter before any re-rolls so the first attempt is stable.

**svg.ts** — `buildPosterSvg(track, opts)`: dark background, loop fitted into upper 65% with y flipped, three sector `<path>`s with round caps, S/F tick, corner numbers offset outward along the normal, title (name), stats block (length km, corners, laps = ceil(305000/length), opened year), source-circuit footer. `svgToPng(svg, scale=2)` via Blob → Image → canvas. Embed the display font as a base64 `@font-face` in the SVG (external fonts don't load inside `<img>` rasterisation) and set explicit `width`/`height` on the root (Safari).

## UI

- **Generator page** (`/`): name input + length dropdown (40 circuits, "Spa-Francorchamps · 7.004 km"), Generate button, "Shuffle" (new seed). Below: `BuildSequence` shows one small SVG per letter, grey full circuit with the chosen section drawing on in accent colour (stroke-dash trick, staggered), then crossfades into the assembled loop. Then `ViewTabs`: Simple (SVG), Corners (same SVG + numbered badges, sector colours, S/F, longest straight highlight), Elevation (R3F canvas: custom ribbon mesh from the samples with vertex colours per sector, extruded dark wall down to ground, ground plane, OrbitControls, z exaggeration ~2.5×; no TubeGeometry). State lives in URL params.
- **Export**: "Download PNG" and "Download SVG" from the poster builder; poster preview rendered inline.
- **Curate page** (`/curate`): circuit dropdown, big SVG of the resampled ring with dist tick marks; click-drag along the path sets start/end; toggles for reverse/flipX, rotation slider, letter picker; live preview of the normalised glyph in a cap-height box; "Add" appends to an in-page list; "Copy JSON" exports entries for `data/letters.json`. Also lists existing sections per letter so gaps are visible. Visible only in dev or behind an obvious "internal" label (no auth needed for a static site).

## Seeding A–Z
After the curate tool exists, I render each circuit to PNG in the scratchpad, inspect visually, and pick sections. Easy letters from well-known shapes: S (Silverstone Maggotts/Becketts, Suzuka esses), U (hairpins: Monaco, Hungaroring T1, Montreal), L (Monza Ascari region, Jeddah), C (Spa Pouhon arc, Istanbul T8), J (Suzuka 130R into chicane, Bahrain T1), O (Zandvoort full ring crop, Mugello loop), V (Bahrain T9/10, COTA T13–15), Z (Baku castle section), W/M (Monza Lesmos + Ascari, Shanghai snail region), N/Z (Spa Les Combes). Harder letters (K, X, Q, A, E, F) will use approximate shapes with connector help; every letter gets at least one entry, and the generator falls back to another variant or a straight stub if a section fails.

## Implementation order
1. Scaffold: `create-next-app` (TS, Tailwind, App Router, src dir, eslint), add Vitest, R3F, drei, framer-motion. `git init`, commit the spec copy to `docs/superpowers/specs/`.
2. `scripts/fetch-circuits.ts` and `scripts/bake-elevation.ts`; produce `data/circuits.json` (resumable, run once).
3. Geometry library with tests, in the order types → rng → project → section → stitch → post → corners → elevation → svg → index. Fixture circuits (3 small synthetic rings) for integration tests.
4. `/curate` page.
5. Seed `data/letters.json` A–Z using the tool and visual inspection.
6. Generator page: form, build animation, Simple and Corners views.
7. 3D elevation view.
8. Poster export (SVG + PNG).
9. README with data attribution (MIT notice for bacinger/f1-circuits, Open Topo Data), unofficial disclaimer, and deploy notes. Vercel deploy requires the user to install the CLI (`npm i -g vercel`) or connect the repo in the Vercel dashboard.

## Verification
- `npm test`: all Vitest suites pass (projection round-trip, wrap extraction, glyph normalisation, bezier endpoints/tangents, loop closure, scale-to-length within 0.1%, figure-8 self-intersection detected, corner detection on arcs, seed determinism, poster has 3 sector paths).
- `npm run build` succeeds with no type errors.
- Dev server via the browser pane: generate "JOHN", "LAKSHYA", "A B", single letter "I"; confirm no self-intersection warning, corners numbered from S/F, 3D view renders and orbits, same URL reloads to the identical track, Shuffle changes it.
- Export PNG and SVG, open the PNG to confirm fonts and sector colours rendered.
- `/curate`: pick a Silverstone S, copy JSON, paste into `letters.json`, regenerate and see it appear.
