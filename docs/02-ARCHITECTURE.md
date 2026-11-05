# 02 — Architecture

## Stack

TypeScript 5, Vite (current stable, pinned), Three.js (pin a current stable release in package.json), `idb`, `zod`, `vitest`, `eslint`. No UI framework. Deployed as a static site to GitHub Pages.

## Folder layout

```
/
  index.html
  CLAUDE.md
  ATTRIBUTION.md
  docs/
  public/
    assets/
      env/         # HDRI (.hdr 1k) and prefiltered env (.ktx2)
      shop/        # shop.glb + lightmap.ktx2
      items/<category>/<defId>.glb
      ui/          # fonts, icons, paper textures
  src/
    main.ts                 # boot: load config, create Game, start render loop
    game/                   # PURE LOGIC — no three, no DOM
      rng.ts                # seeded PRNG (mulberry32 or sfc32)
      state.ts              # GameState type + initial state
      actions.ts            # action types and reducer(s)
      schema/               # zod schemas for data files
      items/                # item instance generation, authenticity, tells
      inspect/              # tool application → findings
      appraise/             # trueValue, market, demand
      haggle/               # state machine
      customers/            # regulars, walk-in generation, memory
      shop/                 # inventory slots, pricing, sell rolls, shrinkage
      economy/              # cash, rent, loans, upgrades
      crime/                # heat, pressure, fence, events
      story/                # arc engine (conditions → beats)
      calendar/             # day, season, holidays, news
      save/                 # serialize / migrate
    data/
      tuning.ts
      items/*.json
      customers/regulars/*.json
      customers/archetypes.json
      stories/*.json
      brands.json
      news.json
    render/                 # THREE
      scene.ts              # shop scene setup, lightmap, env
      camera.ts             # counter camera, inspect camera, transitions
      items.ts              # lazy load item glb, materials, dispose
      customers.ts          # customer models/poses (see Assets doc)
      inspect.ts            # orbit, zoom, cursor hit for tools
      perf.ts               # stats overlay, quality tiers
    audio/                  # WebAudio: cues (pure), engine, sound settings
    ui/                     # DOM
      screens/              # counter, inspect, offer, shop, ledger, menu
      components/           # buttons, number pad, finding card
      bind.ts               # state → DOM render per screen
    input/
      touch.ts, pointer.ts, keyboard.ts
  tests/                    # vitest, mirrors src/game
```

## State model

Single `GameState` object, immutable updates via a reducer. UI and render subscribe to state and re-render the parts they own. Actions are plain objects, which also makes them loggable for debugging and replay.

```ts
interface GameState {
  meta: { version: number; seed: number; careerId: string }
  calendar: { day: number; weekday: number; season: Season; date: ISODate }
  cash: number
  shop: { slots: Slot[]; upgrades: UpgradeId[]; security: number }
  inventory: ItemInstance[]
  loans: Loan[]
  customers: Record<CustomerId, CustomerState>
  queue: QueuedVisit[]
  current: VisitState | null          // the customer at the counter
  inspect: InspectState | null
  haggle: HaggleState | null
  crime: { heat: number; pressure: number; fenceTrust: number; flags: string[] }
  story: { arcs: Record<ArcId, ArcProgress>; pendingEvents: ScheduledEvent[] }
  reputation: { general: number; byGroup: Record<Group, number> }
  stats: CareerStats
  settings: Settings
}
```

## Data schemas (zod, in `src/game/schema/`)

**ItemDef**
```ts
{
  id, category, name, brand?, era?,
  baseValue: { min, max },             // genuine, good condition
  valueCurve: 'linear' | 'collector',  // how condition maps to value
  weightGrams?: { expected, tolerance },
  tells: Tell[],                        // what each tool can reveal
  fakeProfiles: FakeProfile[],          // ways this item can be fake
  demandTags: string[],                 // 'gold', 'electronics', 'militaria'
  model: { glb, scale, inspectDistance, hotspots: Hotspot[] }
}
```
**Tell**: `{ tool, finding: string, reveals: 'authenticity'|'condition'|'provenance', difficulty: 0-1, hotspot?: string }`
**FakeProfile**: `{ id, kind: 'fake'|'frankenstein'|'restored', tells: TellOverride[], valueMultiplier }`

**ItemInstance**: `{ id, defId, condition, authenticity, fakeProfileId?, provenance, trueValue, revealed: FindingId[], story }`

**Customer (regular)**: `{ id, name, portraitKey, archetype, temperament, knowledge, schedule, arcHooks, items: WeightedItemRef[], lines: DialogueSet }`

**Story arc**: list of beats, each `{ id, trigger: Condition[], scene: DialogueScript, effects: Effect[], next: BeatRef[] }`. Conditions are a small expression set (`day >= 12`, `trust.volkova > 0.4`, `boughtStolen >= 1`, `flag('refusedProtection')`). Keep it declarative; no scripting language.

## Rendering

- **Shop**: one `shop.glb` with the room, counter, cases, shelves, lamp, window, produced by the headless Blender bake (see `04-ASSETS.md` § Bake pipeline). Static lighting baked to a lightmap in Cycles on the mesh's second UV set (`uv1` in Three.js) and shipped as KTX2. Three.js `MeshStandardMaterial` with `lightMap` + `envMap`. Glass cases: `MeshPhysicalMaterial` with transmission off on phone (use a cheap transparent material with env reflection), transmission on for desktop high tier.
- **Items**: loaded on demand with `GLTFLoader` + `DRACOLoader` + `KTX2Loader`. Cached per defId; disposed when not displayed or inspected for > 2 scene changes. Display-case items use a low LOD (same glb, or a `_lod.glb` if large).
- **Customers**: see `04-ASSETS.md`. Plan A is a small set of rigged low-cost humanoid models with 6 poses and face variation via textures; Plan B (fallback) is a stylized silhouette with a painted portrait card. Decide at M3 after testing what CC0 gives us.
- **Camera**: fixed counter camera with subtle idle sway (disabled by reduce-motion). Inspect camera is an `OrbitControls`-style controller on the item pivot with limits; tools raycast the item for hotspots.
- **Quality tiers**: `low` (phone default), `mid`, `high` (desktop). Chosen by a 3-second benchmark on first run, overridable in settings. Tiers switch: shadow decals vs none, glass transmission, anisotropy, pixel ratio cap (1.5 on low).

## Input

Pointer Events for everything (touch, mouse, pen share one code path). Inspect: one finger drag = orbit, pinch = zoom, two-finger drag = pan (limited). Tap-and-hold on a hotspot with a tool active = apply tool. Keyboard shortcuts on desktop (1–8 tools, Esc back).

## Save

IndexedDB store `careers` keyed by careerId. Save = full `GameState` JSON plus `version`. Migrations live in `src/game/save/migrations.ts` as an ordered list; every schema-changing commit must add a migration. Autosave after each customer resolves and at day end.

**Save code:** `src/game/save/code.ts`
- Format: `LMB1.` prefix (format version) + base64url of the deflate-compressed JSON state (use `fflate`), plus a short checksum so a truncated paste fails cleanly instead of loading garbage.
- Keep state lean so codes stay pasteable: store item instances by defId + minimal fields, never derived data; prune resolved story beats and old ledger days to summaries.
- Loading a code runs migrations, so a code from an older version still loads.
- Target: under ~20 KB of text for a 200-day career. Add a test that generates a long simulated career and checks code size.
- UI: copy uses the Clipboard API with a fallback text box for manual copy on older mobile browsers.

## Audio

Plain WebAudio, no library. Ambient loop (canal, trams, rain by season), bell on door, counter sounds, tool sounds. All CC0 (see Assets doc § Audio). Audio starts on first tap (mobile autoplay rules).

As built (M3), in `src/audio/`, beside `render/` and `ui/` and with the same rule (reads state, never mutates it; `src/game` may not import it):
- `cues.ts`: pure `cuesFor(prev, next, action)` → sounds for a state change (a new visit → door bell + set-down, a tool use → its sound, a paid outcome → cash drawer, display placement → set-down, dealer/upgrade money → coins). Unit-tested.
- `engine.ts`: the AudioContext, created or resumed on the first gesture; loads every sound only after that; one-shots with a little random detune; ambience as overlapping crossfaded passes; suspended while the page is hidden.
- `settings.ts`: Sound on/off and the ambience level, kept in localStorage (device settings, not in the career or the save code).
- `main.ts` subscribes it to the store next to render/UI and forwards gestures and button clicks. Files, gains and timings live in `src/data/audio.ts`.

## Build and deploy

Repo additions for the bake (M3):
```
bake/
  layout.json        # room dims, prop placements (glb path, position, rotation, scale), light rigs
  bake.py            # blender --background --python bake/bake.py -- --quality preview|full
  materials.py       # Poly Haven / ambientCG material setup
  props/             # source CC0 props used only for baking (not shipped as-is)
.github/workflows/
  bake.yml           # downloads + caches Blender, runs bake.py, optimizes, commits public/assets/shop/*
  deploy.yml         # builds and deploys to GitHub Pages on push to main
```


- `vite build` with `base: '/Lombard/'` for GitHub Pages.
- Pre-build script compresses new `.glb` with `gltf-transform` (draco, ktx2) and validates all data files against the zod schemas.
- Deploys run in GitHub Actions (`deploy.yml`) on every push to `main`, using `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`. Pages source is set to GitHub Actions; there is no `gh-pages` branch.
- Build number (short SHA + build date) is injected at build time via Vite `define` and shown in a screen corner.
- `npm run shots`: Playwright opens the built site at portrait phone (390×844), landscape, and desktop sizes and saves PNGs to `shots/` (gitignored) for Claude Code to inspect before pushing.
- Hub link: add the game card to Kelbo.Website once M4 ships.

## Testing

- `vitest` on `src/game/`: haggling outcomes under fixed seeds, appraisal math, loan interest, sell rolls, story condition evaluation, save migrations.
- A `scripts/sim.ts` headless simulator runs N days with a scripted "player policy" and prints economy stats. Use it to tune `tuning.ts` so a careful player grows slowly and a careless one busts by day ~40.

## Debug

`?debug=1` enables: free cash, skip day, spawn item by defId, force customer, show hidden heat/pressure, show trueValue. Never shipped on in production menus.
