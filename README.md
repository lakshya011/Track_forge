# Track Forge

Type a name, get a Grand Prix circuit, collect its licence. Every letter A–Z is a real stretch of a real
Formula 1 circuit (the Parabolica at Monza reads as a J, Spa's La Source as an A, Zandvoort's Scheivlak
esses as an S). The app stitches those sections into one closed lap whose length grows with the name,
detects and numbers the corners, splits it into three sectors, carries real elevation through from the
source circuits, inspects the result and hands back a homologation card: a grade, a difficulty score,
character tags, a country DNA split, rarity badges and a fictional ghost lap you can dare a friend to beat.

## The flow

1. **Landing**: a pit-wall hero with one big input and "Submit for homologation". Example chips, and a
   garage of your last eight circuits (kept in `localStorage`, purely a convenience). Each chip has a ×
   to forget that circuit, and Clear (with an inline confirm) empties the garage.
2. **Inspection**: each letter's source circuit appears with its stretch drawing on and is stamped
   APPROVED while the five start lights fill red. Lights out, the lap draws on, and corners, longest
   straight and elevation range count up. Skip at any time.
3. **Result**: the licence card sits beside the circuit, with two tabs: **Circuit** and **Poster**.
   - **Circuit** is one canvas with a small camera cluster in its corner: **Map**, **Onboard** and
     **Orbit**. The map is a furnished 2D plan: white edge lines over grained asphalt, red-and-white
     kerbs on the inside of every corner, gravel traps outside heavy-braking corners, 100 m and 50 m
     braking boards, sector flags, a DRS detection line before the longest straight, grandstands along
     the start/finish and longest straights, and a top-down Formula 1 car (front and rear wings, four
     tyres, halo, in the chosen team's colours or the ghost yellow) lapping to the model time with a
     running clock. The car follows a speed profile (`speed.ts`): it brakes for corners, crawls through
     hairpins and stretches its legs on the straights, so a lap takes exactly the card's ghost time.
     Hover to pause. Corners show their name (`T3 · La Source` when the stretch is a named corner, else
     the circuit) on hover, and hovering a corner card pulses its apex. The legend under the map is
     live: the sector chips and the elevation chip switch the lap between sector colours and an
     altitude skin. **Onboard** is the same lap in metres: a low-poly single-seater on asphalt with
     kerbs and white lines, grass banks, grandstands, braking boards, corner boards and the start
     gantry under a dusk sky, from the T-cam over the helmet or a chase camera (a second pill appears
     beside the cluster while Onboard is active). A HUD shows speed, lap time, the corner you are in or
     approaching ("T5 in 120 m") and the sector; play, pause and scrub the lap under the canvas.
     **Orbit** is a rotatable 3D ribbon from baked SRTM elevation with kerb-coloured edges, grandstand
     blocks, the same car lapping to the same clock, and a marker at every corner (a ring on the apex
     and a pylon on the inside). Hovering a corner card lights its marker and hovering a marker lights
     the card; clicking either flies the camera to that corner. All three cameras share one clock, so
     switching keeps the car where it was.
   - **Poster**: four styles to choose from, each live as a thumbnail, in 2:3, square or **Story**
     (9:16, the 2:3 sheet on its own paper with a larger code in the band below), exported as PNG (2×
     the canvas for the print sheets, 1080 × 1920 for the story) or SVG with the display font embedded.
     Every poster carries a quiet **attribution row**, a small QR code with `MADE WITH TRACK FORGE` and
     the short link, placed where each style keeps its small print: the Sector poster's empty sixth
     stat cell, a cartouche in the Engraved map's corner, a legend box over the Cartographic map's
     fade, the Team car cover's issue block. The code encodes the link that rebuilds the circuit, so
     whoever sees the picture can forge their own. **Share** next to Download PNG hands the picture to
     the phone's share sheet (Instagram stories, WhatsApp, X and the rest take the PNG directly); on a
     desktop a small menu offers download, copy link, WhatsApp and X instead. The poster tab shows only
     the gallery and the licence card; the corner list and source cards belong to the Circuit tab.
     **Sector** is the framed dark poster: title, subtitle with
     the length reference, grade seal, the furnished lap in a wide band (corner numbers only up to 16
     corners), five numbers in a three-column grid and one credit line. **Engraved** is an oak, walnut or black board with a raised circuit line, corner names
     set along the road and engraved line-art surroundings. **Team car** is a magazine cover: off-white
     paper with a giant display word in a team's pale tint, a hand-drawn vector single-seater head-on
     and slightly from above (layered front wing, slicks, suspension, sidepod inlets, halo, airbox,
     rear wing with DRS flap) recoloured to one of ten liveries picked from a swatch row, a masthead,
     a stats column with hairline rules, a thin circuit outline, crop marks and a vertical label. The
     liveries are fan colour schemes in the spirit of the ten current teams and carry the team's name
     as the giant word, in plain text only (McLaren, Ferrari, Mercedes, Red Bull, Alpine, Aston
     Martin, Racing Bulls, Sauber, Williams, Haas); two-word names run as two rotated columns on the
     tall sheet and two stacked lines on the square one. No logos, wordmarks or sponsors appear, and
     the foot of the poster says "Unofficial fan livery · not affiliated with any team". The circuit's
     name appears once, small, in the stats. Each circuit gets a default team from `hash(name) ^ seed`
     until you choose one (`&team=papaya` in the link; the ids are still the colour names).
     **Cartographic** is a charcoal street map edge to edge: highways,
     arterials, settlements with street grids and hundreds of building footprints, field parcels, woods,
     a river and ponds in pale blue, the circuit's pit complex, grandstands, car parks and run-off, a
     crisp white circuit in a dark halo, a north arrow, and a letter-spaced footer with corners, length
     in km and miles and optional seeded coordinates. The style, ratio and team ride in the link
     (`&poster=engraved&ratio=1:1`, `&poster=teamcar&team=onyx`, `&ratio=9:16`); wood, team and map
     options are remembered in the browser.
   - Source cards (Circuit tab) list which corners each letter contributed and which letters share a
     stroke.
4. **Challenge a friend**: renders the licence card itself as a 1080 × 1920 picture (the same carbon
   card: grade seal, difficulty meter, tags, DNA, ghost lap, rarity, a small outline of the lap and the
   attribution row) and hands it to the share sheet with a line like "LAKSHYA is Grade 1, difficulty
   7/10 (technical, hilly, hairpin heaven), ghost lap 2:41.108. Beat it." and the link. Square
   (1080²) and wide (1200 × 630) versions sit under the button; the wide one is also the site's link
   preview (`public/og.png`). Without a share sheet the same menu as the posters opens.

Lap length follows the name: one letter laps like Monaco (3.337 km), eleven or more like Spa (7.004 km),
snapped to the nearest real circuit so the "same lap length as …" line keeps meaning. Shared links
(`/?name=LEWIS&seed=42`) always rebuild the same track; older links with `&len=<circuit>` still honour
that length. **Shuffle sections** re-rolls which stretch is used for each letter.

Everything on the card is fictional and says so: the grade is not an FIA grade and the lap time is a model.

## Stack

Next.js (App Router, TypeScript, Tailwind v4), react-three-fiber + drei for the 3D view, `motion` for the
inspection sequence, Vitest for the geometry and stats library. No backend: all data is JSON in the repo
and generation runs in the browser (a 7-letter name builds in a few milliseconds).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Tests: `npm test`. Production build: `npm run build`. Curation tool: `/curate`.

## Data

- `data/raw/f1-circuits.geojson`: circuit outlines from
  [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT © Tomislav Bacinger).
  40 circuits, current and former, with official lap length and opening year.
- `data/circuits.json`: generated by `npm run data:bake`. Each circuit is projected to local metres,
  resampled every 10 m, and given per-vertex elevation from
  [Open Topo Data](https://www.opentopodata.org/) (SRTM 30 m, ~300 requests, resumable).
- `data/letters.json`: the curated letter sections (94 entries, 2–5 variants per letter). They were
  found with `scripts/mine-letters.ts`, which slides windows along every circuit, compares each
  window against single-stroke letter templates in `scripts/letter-templates.ts`, and writes a
  review sheet; the best candidates were then vetted by eye. Re-run with
  `npx tsx scripts/mine-letters.ts <outDir> 8` to mine again, or add entries by hand with `/curate`.

## How a track is generated (`src/lib/geo`)

1. `length.ts`: lap length from the letter count, snapped to the nearest real circuit.
2. `section.ts`: extract the stretch between two ring distances (wrapping through the start line
   when needed), rotate/mirror it per the curated entry, scale to cap height 1, and orient it so it
   is entered from the left.
3. `stitch.ts` + `route.ts`: lay glyphs left to right, connect each exit to the next entry. The router
   tries a tangent-continuous curve first, then escape paths (straight out, or a hairpin for ends that
   point into the letter such as a G's inner hook) joined directly or by a detour under/over the
   letter band through the gap between letters, checking against every outline already placed.
   A pit straight below the letters closes the loop; the start/finish line sits at its midpoint.
   Before layout, `ligature.ts` fuses adjacent letters whose exit and entry runs point the same way
   (within 30°): the shared stroke is drawn once, so a Y's arm becomes the next A's leg, an A's leg
   becomes a V's arm, an M's last leg becomes an I. Vertical letters such as I pick whichever
   direction continues the previous stroke. Layout then kerns optically: each letter slides left
   until its strokes come within the gap distance of the previous letter's strokes, so shapes nest
   (A next to V) instead of sitting in separate boxes. The generator tries fused + kerned first,
   then fused only, then plain boxes, before widening gaps.
4. `post.ts`: smooth the joins, scale x/y to the target lap length, resample at 10 m, and test for
   self-intersection; the generator widens the gaps and finally re-rolls sections if needed.
5. `corners.ts`: curvature with hysteresis, merged nearby turns, numbered from the start line;
   sectors at thirds snapped to corner exits; longest straight between corners. `generateTrack` then
   records where each letter sits along the lap (`letterRanges`) and tags every corner with the letter
   whose stretch overlaps its turning zone the most (`corner.source`).
6. `elevation.ts`: each letter keeps its real profile compressed to at most 60 m of relief;
   connectors ease between heights.
7. `homologation.ts`: the card. Corners/km, longest-straight share, hairpins (≥ 150°), chicanes
   (opposite-direction corners within 80 m), relief and mean corner angle feed a 1–10 difficulty and
   2–4 tags (High-speed, Technical, Hilly/Flat, Hairpin heaven, Flowing, Street circuit, Classic).
   Thresholds are calibrated against ~230 generated names so each tag marks a minority of circuits.
   Badges: Rare letter (B and X have only two stretches each), Ligature, Full house (5+ countries),
   Marathon (12 letters), Sprint (≤ 3). Ghost lap = lap at 215 km/h + 0.9 s + 1.4 s × |angle| / 90°
   per corner + 0.01 s per metre of relief. The licence number is `hash(name) ^ seed`.
8. `decor.ts`: track furniture in metres (kerbs, gravel traps, braking boards, sector flags, DRS
   detection, grandstands, corner names) shared by the 2D view, the poster and the 3D ribbon.
9. `svg.ts`: SVG fitting helpers and the SVG → PNG rasteriser.
10. `speed.ts`: the ghost's speed profile. Cornering speed from curvature (`v = √(aLat/|κ|)`,
    clamped between a hairpin crawl and a top speed), a forward pass capping acceleration at 12 m/s²
    and a backward pass capping braking at 40 m/s², integrated to a time at every sample and scaled
    to the card's lap time. It answers `distAt(t)`, `speedAt(d)` and emits SMIL `keyPoints` /
    `keyTimes` so the 2D car slows in the corners too. `hud.ts` names the corner the car is in or
    approaching and the sector. `src/lib/hooks/useLapClock.ts` is the one clock (play, pause, seek,
    hold-on-hover) the map, the 3D ribbon and the driver view all read.

The RNG is seeded with `hash(name) ^ seed`, so results are reproducible.

## Posters (`src/lib/poster`)

`buildPoster(track, { style, ratio, options }, meta)` returns an SVG string. Styles live in
`styles/` and compose shared primitives (`primitives.ts`: the furnished track layer, corner rings,
`<textPath>` corner names, stats grid, frame, credit, north arrow, pseudo-coordinates). The two map
styles share `cartography.ts`, which lays out a **fictional, procedurally generated town plan** in
track metres, deterministic for `hash(name) ^ seed ^ 0xC4A7`: a rounded perimeter road with overflow
car parks and trackside buildings inside it, grandstands and run-off at the two biggest corners,
service roads routed inside the loop and a tunnel from the paddock to the main car park; a river
routed across the sheet (or a lake) plus ponds; two or three settlements placed in the voids, each a
grid or ring-and-spoke street network with blocks packed with building footprints (fuller near the
centre, thinning with distance from the circuit); highways routed edge to edge with A* around the
circuit, towns and lakes, arterials from each settlement to the perimeter and the nearest highway,
and access roads from the edges (no road ever crosses the circuit); frontage buildings and
farmsteads along the roads; woodland blobs; field cells split into parcel strips, subdivided near the
lap so parcels run right up to it; and contour lines blended from the lap's own elevation into seeded
hills. The app never pretends a stitched lap sits on real land: the cartographic credit says
"Fictional location" and the coordinates are seeded make-believe. `car.ts` draws the team-car
poster's single-seater: a right half mirrored with `<use transform="scale(-1,1)">` plus whole centre
pieces, in a 2 mm-per-unit box, with livery regions filled through `--c1`/`--c2`/`--c3`/`--accent` so
`teams.ts` (ten liveries keyed by colour id, named after the teams in plain text, default from
`hash(name) ^ seed`) recolours one drawing. `fonts.ts`
fetches the next/font Barlow Condensed Latin faces once and embeds them as `@font-face` so exports and
thumbnails match the page; without them the stack falls back to condensed system fonts.

`qr.ts` turns the share link into one `<path>` of QR modules (`qrcode-generator`, level M, four
modules of quiet zone, cached per link) and `primitives.attributionRow()` sets it beside the caps
line and the short link; a style only draws the row when the render context has a `shareUrl`, so
offline builds and tests are unchanged. The 9:16 story is built in `index.ts`: the style renders its
usual 1200 × 1800 sheet, which is nested at 1080 wide on the style's own paper (`story()` on each
style names the paper and ink) with a larger row in the band below. `licence.ts` draws the licence
card as SVG in three formats (story, square, wide) from the same homologation the screen card shows.
`src/lib/share.ts` holds the link rules (`buildShareUrl` reads `window.location`, so a GitHub Pages
base path survives), the Web Share route (`navigator.share({ files })`, the only way into Instagram
and WhatsApp stories from the web, with the link inside the text because iOS drops `url` when files
are attached) and the fallback intents; `ShareMenu.tsx` is the desktop menu.

## Known limitations

- Letters that need pen lifts (B, H, K, X in particular) are approximated by continuous strokes and
  read as stylised; B is the weakest and occasionally forces a self-intersection warning, which
  Shuffle resolves.
- Poster surroundings are generated, not real, and the team-car liveries are fan colour schemes that
  borrow only the team's name as text, never a logo or sponsor; the styles say so in their credit lines.
- The ghost car on the map uses SMIL `animateMotion` with `keyPoints`; it is static in engines without
  SMIL (the clock still runs). Speeds shown in the driver view follow the fictional lap time, so they
  are lower than a real Formula 1 car's.
- The driver view has no terrain beyond the grass banks the road sits on, and the car is a primitive
  model, not a scan of any real car.

## Deploying

The app is a static export (`output: "export"`): `npm run build` writes the whole site to `out/`, which
any static host can serve. Vercel still works with no configuration (`npm i -g vercel && vercel`, or
connect the repository in the Vercel dashboard).

### Deploy to GitHub Pages

`.github/workflows/pages.yml` builds and publishes `out/` on every push to `main` (and on demand from
the Actions tab). It sets `NEXT_PUBLIC_BASE_PATH` to `/<repo>` so links, chunks and fonts resolve under
the project sub-path; for a `<user>.github.io` repository it leaves the base path empty. Locally the
variable is unset, so `npm run dev` and `npm run build` are unaffected.

1. Create an empty repository on GitHub (no README, licence or `.gitignore`).
2. Add it as the remote and push:
   ```bash
   git remote add origin git@github.com:<user>/<repo>.git
   git push -u origin main
   ```
3. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. The first push runs the workflow; a minute or two later the site is live at
   `https://<user>.github.io/<repo>/`. Shared links keep working under that prefix
   (`https://<user>.github.io/<repo>/?name=LEWIS&poster=cartographic`).

To check the sub-path build locally: `NEXT_PUBLIC_BASE_PATH=/<repo> npm run build`, then serve a folder
that contains `out/` renamed (or symlinked) to `<repo>` and open `http://localhost:<port>/<repo>/`.

### Update the site by browser

If the repository has no remote on this machine, the site is updated by dragging files into GitHub's web
uploader. `npm run export:upload` makes that repeatable: it empties `~/Documents/Track forge/track-forge-upload`
(only that folder; set `TRACK_FORGE_UPLOAD_DIR` to use another), extracts the committed tree of `HEAD` into
it, and writes `~/Documents/Track forge/UPLOAD-CHANGES.txt` listing every file added, modified or deleted
since the git tag `uploaded` (the commit GitHub currently has; on the first run everything counts as new).

1. Commit your work, then run `npm run export:upload`.
2. On github.com open the repository, **Add file → Upload files**, and drag the *contents* of the upload
   folder into the drop zone. GitHub replaces the files that exist and adds the new ones. Commit to `main`.
3. Files under **DELETE** in `UPLOAD-CHANGES.txt` have to go one by one: open each on github.com,
   **… → Delete file**, commit. (The uploader cannot remove files.)
4. The Pages workflow builds and redeploys in a minute or two.
5. Run `npm run export:upload -- --mark` so the next export lists only what changed from here.

With GitHub Desktop, or a remote and `git push`, all of this is one click: the workflow runs on every push
to `main`.

## License

The code is released under the [MIT License](LICENSE). Circuit geometry comes from
[bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT © Tomislav Bacinger); elevation comes
from [Open Topo Data](https://www.opentopodata.org/) (SRTM). See the disclaimer below: this is an
unofficial fan project, not affiliated with Formula 1, the FIA or any circuit.

## Disclaimer

Unofficial fan project. Not affiliated with, endorsed by, or associated with Formula 1, Formula One
Licensing B.V., the FIA, or any circuit. Grades, licences and lap times are fictional. Do not add
official F1 logos or trademarks to the UI.
