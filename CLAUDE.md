# CLAUDE.md — Lombard

A Longlight Interactive game. First-person pawn shop sim set in Mostograd, a fictional 2010s Russian river city. Player stands at the counter, inspects items customers bring in, decides what they're worth, haggles, and runs one long career. Tone: warm slice-of-life with dark-comedy edges. Full crime layer (fencing, bribes, mob).

Repo settings are documented in `docs/00-REPO-SETUP.md`; don't change them from code. Read `docs/01-GDD.md` before touching gameplay. Read `docs/02-ARCHITECTURE.md` before touching code structure. Work from `docs/03-ROADMAP.md` milestone by milestone; do not start a later milestone's features early.

## Stack (fixed, do not change without asking)

- TypeScript, Vite, Three.js (latest stable). No framework for the game loop; plain classes and modules.
- UI overlay: plain HTML/CSS (no React). Game state drives DOM via a small render function per screen.
- Physics: none. Item inspection is an orbit camera on a single mesh, not a physics object.
- Save: IndexedDB via `idb` for autosave (localStorage fallback for settings only), plus a copy-paste **save code** for moving careers between devices. No cloud sync, ever.
- Assets: glTF (.glb) with Draco compression; textures KTX2 (Basis) where possible, otherwise WebP. HDRI environment from Poly Haven (small 1k version).
- Hosting: GitHub Pages at `https://lombard.longlight.games/` (the custom domain; the old `https://jxstrr0.github.io/Lombard/` address forwards there; Vite `base: './'`, relative, so the build works at any address), deployed by a GitHub Actions workflow using the official Pages deploy actions (Pages source = GitHub Actions). Static. No server, no API keys, no backend. All dialogue and content is authored data in `src/data/`.
- Tests: Vitest for pure logic (appraisal, haggling, economy, RNG). No tests for rendering.
- Shop lighting: Blender (headless, Python-scripted) bakes a Cycles lightmap in GitHub Actions. No one opens the Blender UI as part of the pipeline. See `docs/04-ASSETS.md` § Bake pipeline.

## Target devices (priority order)

1. Phone, portrait, touch. Must run at 30+ fps on a mid-range Android (2021-era) in Chrome. This is the primary target.
2. Phone landscape.
3. Desktop browser, mouse + keyboard.

Design every screen portrait-first. Landscape and desktop adapt from the portrait layout, not the reverse.

## Performance budget (phone)

- Shop scene: under 150 draw calls, under 300k triangles visible, under 60 MB of textures decoded in memory.
- Lighting: one baked lightmap for the static shop plus one environment map. At most 2 real-time lights (counter lamp, window fill). No real-time shadows on phone; use baked shadows and contact-shadow decals.
- Items in inspect mode may use higher-res textures (loaded on demand, unloaded after).
- Total first load under 15 MB. Lazy-load item models per category.
- Measure with `stats.js` in dev; a `?perf=1` query flag shows the overlay.

## Conventions

- `src/game/` is pure logic and must import nothing from `three` or the DOM. Everything in there is unit-testable.
- `src/render/` owns Three.js. `src/ui/` owns the DOM. They read from the game state and dispatch actions; they never mutate state directly.
- All gameplay numbers (prices, probabilities, reputation deltas) live in `src/data/tuning.ts`, never inline.
- RNG is seeded (`src/game/rng.ts`). Never call `Math.random()` in `src/game/`.
- Item, customer, and story content are JSON/TS data files in `src/data/`, validated by Zod schemas in `src/game/schema/`.
- Keep commits small and scoped to one roadmap task. Commit message format: `M2: add haggling state machine`.
- After every milestone, update `docs/03-ROADMAP.md` status and add any new decisions to `docs/05-OPEN-DECISIONS.md` (resolved or open).

## Versions

- The game version has four numbers, Major.Minor.Patch.Build (for example `0.1.0.0`), the same scheme as every Longlight game. It lives in the `VERSION` file at the repo root; `vite.config.ts` reads it as `__GAME_VERSION__` and the build fails if it isn't four numbers.
- It shows in the corner build number (`v0.1.0.0 · <sha> · <date>`) and in the Settings footer. The short commit hash and date stay so a fresh deploy is easy to spot.
- Bump rule: **Major** = overhaul, **Minor** = a milestone or feature batch, **Patch** = a fix, **Build** = a republish with no gameplay change. Bump `VERSION` in the PR that makes the change.
- `.github/workflows/publish-release.yml` publishes a GitHub Release (`v<version>`) whenever `VERSION` changes on `main`; the studio site reads that release for this game's version number and "what's new" line. Free, no keys, and it doesn't touch the deploy.
- `package.json` keeps a three-part semver (`0.1.0`, npm requires it); it isn't shown to players and doesn't need to track `VERSION`.

## Branding

Longlight Interactive palette (match Kelbo.Website `style.css`):
- Clay `#D97757`, purple `#7B3FC4`, slate `#141413`, ivory `#FAF9F5`, lilac `#B48CE8`.
- Dark mode surface `#1C1B19`, card `#1F1E1B`, light clay text `#E8967A`.
- Font: Space Grotesk (self-host, do not load from Google Fonts at runtime).

In-game UI should feel like the shop (paper tags, receipt fonts, worn plastic), but menus, title screen, and the hub link use the Longlight palette.

## Content rules

- Fictional city, fictional businesses, fictional people. No real brand names on items; use plausible invented ones (see `docs/01-GDD.md` § Brands).
- Crime content is allowed (stolen goods, bribes, organized crime pressure, fencing) and should feel like real consequences, not a power fantasy.
- No sexual content. No real-world political figures. Violence stays off-screen (threats, aftermath, news).
- Every third-party asset goes in `ATTRIBUTION.md` with source, author, license, and URL, even for CC0. See `docs/04-ASSETS.md`.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build to `dist/`
- `npm run test` — Vitest
- `npm run lint` — ESLint + typecheck
- `npm run shots` — headless build + Playwright screenshots (portrait phone, landscape, desktop) into `shots/` for self-review before pushing
- Bake (from M3): the `bake` GitHub Actions workflow, `workflow_dispatch` with input `quality: preview | full`; also runs on changes to `bake/`

## Workflow rules

- Kelbo reviews on a phone via GitHub Pages and does not run anything locally. Every change must be reviewable from the deployed build.
- Before pushing, run `npm run test`, `npm run lint`, and `npm run shots`, and look at the screenshots yourself. Don't push a build you haven't seen.
- The build number (short commit hash + date) is shown small in a screen corner so Kelbo can tell a fresh deploy from a cached one.

## Things not to do

- Do not add a backend, ads, payments, accounts, or external API calls. Lombard is free forever. The one exception is Cloudflare Web Analytics (Kelbo, Nov 12, 2026): the cookieless beacon at the end of `index.html` counts visits and load speed. Add no other analytics.
- Do not introduce a UI framework.
- Do not use real-time shadows or post-processing on the phone path without a perf measurement showing it's affordable.
- Do not invent item values or probabilities inline; add them to data/tuning files.
- Do not expand scope beyond the current milestone. Park ideas in `docs/05-OPEN-DECISIONS.md` § Parked.

## Studio catalogue

`LONGLIGHT-STUDIO.md` (repo root) covers every Longlight game: looks, names
already taken, storage and cache prefixes (kept from the shared-origin days), a reuse map and
improvement ideas. Read it before pitching new ideas, names or looks, and
before building a system another Longlight game may already have. This file
wins where the two disagree. Don't edit the copy here: the master is
`.github/LONGLIGHT-STUDIO.md` in Jxstrr0/Kelbo.Website; it gets recopied.
