# 04 — Assets (CC0 / CC pipeline)

Goal: as realistic as free-and-open content allows, on a phone. The strategy is **great lighting + a modest number of good props**, not thousands of assets.

## Licensing rules

- Preferred: CC0 (no attribution required, but we attribute anyway).
- Acceptable: CC BY 4.0 (attribution required, in `ATTRIBUTION.md` and the in-game credits screen).
- Not acceptable: CC BY-NC (we may sell this later), CC BY-SA (viral), anything "free for personal use", Sketchfab "Standard" license, anything scraped from games.
- Every asset gets a line in `ATTRIBUTION.md`: name, author, source URL, license, what we changed.
- When unsure of a license, do not use the asset. Ask.

## Sources

| Source | What | License |
|---|---|---|
| Poly Haven (polyhaven.com) | HDRIs, PBR textures (wood, plaster, metal, glass), some models | CC0 |
| ambientCG (ambientcg.com) | PBR textures, decals | CC0 |
| Sketchfab, filter "CC0" and "CC BY" | props (watches, cameras, jewelry, icons, phones) | per asset, verify |
| Quaternius (quaternius.com) | stylized/low-poly props and characters, useful as bases | CC0 |
| Kenney (kenney.nl) | placeholders, UI icons, sounds | CC0 |
| Smithsonian Open Access (3d.si.edu) | museum scans (coins, medals, instruments, some antiques); heavy meshes, decimate | CC0 |
| Scan the World (MyMiniFactory) | sculpture and artifact scans | mostly CC BY-NC — check each; many are not usable |
| Freesound (freesound.org), filter CC0 | ambience, foley | per asset, verify |
| OpenGameArt (opengameart.org) | sounds, textures, some models | per asset, verify |
| Wikimedia Commons | reference photos for authoring Blender materials and fake tells (reference only, not shipped) | n/a |
| Google Fonts / Fontsource | Space Grotesk (OFL), a receipt/mono font (OFL) | OFL |

## Shop scene

Built in Blender (free) by script, never by hand, exported to `shop.glb`:
- Room: 6 m × 8 m, high ceiling (old building), one large street window (and the door glass) looking out on the canal: a Cycles render made from the player's eye, shown on one plane outside (see § Canal backdrop).
- Glass showcase counter, a low glass case behind it, a freestanding glass case on the floor, two tall wall cases, glass shelves on brackets, a safe door, a storeroom through a side doorway behind the counter (shelving, workbench, bare bulb), counter lamp, ceiling pendants, a radiator, a worn parquet floor (linoleum in the storeroom).
- Materials from Poly Haven / ambientCG: dark wood, scuffed laminate, plaster with stains, brass trim, glass.
- Lighting baked in Cycles to a single 2048 lightmap (4096 on desktop high tier) covering the static room. Dynamic items get lit by the env map plus the counter lamp.
- Export: glTF with Draco; textures to KTX2 via `gltf-transform`. Target under 8 MB total for the shop.

**Fallback only** (if the bake pipeline hits a wall): kitbash from CC0 props plus Poly Haven textures on primitives, lit by a strong HDRI and contact-shadow decals. About 70% as good. Do not switch to this without asking Colby.

## Bake pipeline (decided Nov 2026, built in M3 task 1)

Everything runs headless; no one opens the Blender UI.

**Run it from a phone:** GitHub app → repo → Actions → **bake** → Run workflow → quality `preview` (default) or `full` → Run. A preview takes ~5 minutes including the Blender download on a cold cache; the result is committed and deployed automatically, and the build number in the game's corner then ends in `bake preview <commit>` (or `bake full …`). The Cycles renders from the player's eye land in `bake/out/preview.jpg` (portrait), `bake/out/preview-wide.jpg`, and `preview-left.jpg` / `preview-right.jpg` (head turned left to the storeroom door, right to the wing case; note the player looks along +z, so +x is on their left); open them in the repo to judge layout and mood. Add `?nobake=1` to the game URL to see the old procedural grey box for comparison.

1. `bake/layout.json` describes the room in three.js coordinates (metres, y up): room size (plus `annexes`, extra boxes such as the storeroom whose faces survive the outside-the-room culling), every object (box / cylinder / cone / sphere / torus for the grey box, glb props later) with position, rotation, material, optional `repeat` and seeded `jitter`, plus the light rig (ceiling pendants, counter lamp, overcast sky through window and door portals), and the two preview cameras.
2. `bake/materials.py` is the single source for static materials: colour, roughness, metalness, and a `kind`:
   - `baked`: diffuse, gets the lightmap; drawn as `MeshBasicMaterial` + lightmap at runtime so the two real-time lights (there for the item and the customer) don't light the room twice;
   - `dynamic`: metals; not in the lightmap, lit at runtime by the env map and the two lights (they still cast shadows in the bake);
   - `glass` and `unlit`: hidden during the bake, drawn transparent / flat at runtime.
   `kind` and an optional procedural `runtime` texture id travel to the game as glTF material extras.
3. `bake/bake.py` (`blender --background --factory-startup --python bake/bake.py -- --quality preview|full`):
   - generates all geometry straight into four meshes, one per kind (so the shop costs about one draw call per material: ~30 instead of ~70–100 for the old grey box), applying the seeded jitter and culling faces nobody can see;
   - welds the baked mesh so boxes that meet act as one surface: drops faces pressed flat against another opaque box (cut along that box's sides first if only partly covered), splits edges at T-junctions and beauty-triangulates the result. Each flat wall then unwraps as one lightmap island, and no hidden face sits at a visible edge to depth-fight. Without this, a wall built from several boxes shows a dark or bright line at every joint;
   - uv0 = world-metre box projection (tiling textures), uv1 = Smart UV Project + pack (all islands selected) with a margin for the target resolution;
   - bakes Cycles diffuse lighting (direct + indirect, no colour) to uv1, denoises it with OpenImageDenoise, regrows the margin from each island's own texels (before and after the denoiser, which blurs across islands), and stores it as an 8-bit sRGB PNG divided by `lightmapScale` (written to the manifest; the game multiplies back);
   - exports `bake/out/shop_raw.glb` with both UV sets and renders the two previews (AgX, exposure matched to the game's ACES).
4. `scripts/bake-pack.mjs` (glTF Transform + `ktx2-encoder`, both npm packages, no system tools): Draco-compresses the glb, converts the lightmap to KTX2 (UASTC + RDO + Zstd, mipmaps), and writes `public/assets/shop/{shop.glb, shop_lightmap.ktx2, shop.json}`. Preview bake: 60 KB + 180 KB.
5. `.github/workflows/bake.yml`:
   - triggers: `workflow_dispatch` with `quality` (preview default), and pushes that change `bake/**` or the pack script (preview; skipped if the committed `shop.json` already has the same input hash);
   - downloads the pinned Blender LTS Linux build and caches it with `actions/cache`;
   - runs on the standard `ubuntu-latest` runner (never a larger runner; those are always billed);
   - commits `public/assets/shop/*` and the preview images back to the branch it ran on, then dispatches `deploy.yml` for that branch (a push made with the workflow token doesn't trigger workflows itself). `deploy.yml` publishes only from `main`; on other branches it just runs the checks.
   - Runs on the same branch queue rather than cancel, so a push never kills a full bake in progress.
6. Runtime (`src/render/bakedShop.ts`): loads `shop.json`, then the glb (Draco decoder) and the lightmap (Basis transcoder; both copied from three into `public/assets/decoders/` by `npm run dev`/`build`), builds the materials per kind, and replaces the grey box. If there's no bake, the grey box stays.

Local run (for whoever has Blender; CI doesn't need this): `blender --background --factory-startup --python bake/bake.py -- --quality preview` then `npm run bake:pack`.

Quality presets:

| Preset | Lightmap | Samples | Runtime on the Actions runner (4 vCPU) | Use |
|---|---|---|---|---|
| preview | 512 | 96, denoised | ~30 s bake + ~2 min previews | layout and mood iteration |
| full | 2048 (4096 optional desktop tier) | 768, denoised | ~10–40 min (estimate) | shipping |

Rules:
- Pin the Blender version in the workflow (`BLENDER_VERSION`, currently 4.5.15 LTS); bump it deliberately, never `latest`.
- A layout change requires a rebake (the push trigger does a preview automatically). Lock layout early in M3.
- Moving props (items on the counter, customers) are not in the bake; they're lit by the env map and counter lamp at runtime.
- Keep `bake/layout.json` anchors in step with `src/render/scene.ts` (counter top 0.94 m, mat at z −2.13, lamp light, eye at z −3.2).
- The canal view outside is not part of the bake (see § Canal backdrop), but it is rendered for the window and door openings and the eye in `bake/layout.json`. If either opening or the eye moves, rerun `art/backdrop/build.py`; `tests/backdrop.test.ts` fails until you do.

## Items

Three tiers of effort per item definition:
1. **Hero** (~20 items): dedicated glb, 2k textures, custom hotspots for tells (hallmark decal, serial plate, caseback). These are the items the fakes system shows off: gold rings, Soviet watches, medals, a Zenit camera, a phone, an icon.
2. **Standard** (~60): CC0 model, retextured or lightly edited, 1k textures, 2–4 hotspots.
3. **Simple** (~40): shared base meshes with texture variants (coins, banknotes, small electronics, tools), 512 textures.

Fakes reuse the genuine mesh with a texture/decal variant: softer hallmark stamp, misaligned logo, wrong font on the dial, modern screw heads, UV-glow decal for glue. Authoring a fake = authoring a decal set, not a new model.

Reference photos of real counterfeit tells (Wikimedia, auction catalogues) inform the decals but are never shipped.

### Scripted item models (decided Nov 2026, M3)

A survey of CC0 / CC BY sources found almost nothing for our items: no Soviet watches, coins, medals or orders, no Helios lens, no Note-style phone. The near-matches (jewellery, a few cameras, branded phones) are Sketchfab CC BY and need an account token to download. So every item is **built by a Blender Python script**, headless, the same way as the shop bake. No licences to track, our fictional brands from the start, and the triangle budget is ours to set.

- `art/items/build.py` reads `src/data/items/*.json` and builds every def whose `model.placeholder` kind has a builder in `art/items/kinds/<kind>.py`. Raw output goes to `art/out/items/` (git-ignored): `<id>.glb`, `<id>.json` (triangles, draw calls, bounds, hotspot gaps) and, with `--preview`, `<id>.png` (Cycles render, front and back, hotspots in pink).
- `art/items/lib.py` holds the helpers. Authors work in **three.js item coordinates**, the ones `src/render/items.ts` documents and the hotspots use: metres, origin-centred, +Y up, front +Z. Helpers: lathe, cylinder, box, polygon, stroke, dots, text, arc text, bevel. Relief is real geometry. One **AO texture** per item (smart UV unwrap, Cycles AO bake, 512 px default; coins use 1024) multiplies each material's colour, so recesses darken like dirt and wear.
- Rules for builders:
  - Overlapping relief pieces must not share a top height. The helpers do this for you: each piece gets a tiny deterministic height difference, because coincident faces occlude each other in the AO bake and turn black.
  - Relief that sits on a surface leaves out its base face (`base=False`).
  - Keep an item under 60k triangles (aim for 20–30k) and every hotspot within 1.5 mm of the surface. `--strict` fails the build otherwise.
- `scripts/items-pack.mjs` writes `public/assets/items/<id>.glb`: Draco geometry, plus textures as KTX2 (ETC1S for the AO/colour, UASTC for any data map). A coin is ~230 KB.
- A def opts in with `"glb": "<id>.glb"` in its `model`. The game shows the placeholder at once and swaps the glb in when it loads. The hidden placeholder stays as the cheap raycast proxy for hotspot occlusion. `?noglb=1` forces placeholders. `?gallery=1&item=<id>` shows one model large, front and back, which is how Colby reviews a model on the phone.
- `tests/itemModels.test.ts` checks that defs and packed files agree.
- The `items` workflow (`.github/workflows/items.yml`) rebuilds and commits the models when a push to `main` changes `art/items/` or the pack script, or on demand from the GitHub app (Actions → items → Run workflow). Normally the models are built and committed together with the builder change.

Run locally (Blender 4.5.15 at `~/blender`):

```
~/blender/blender --background --factory-startup --python art/items/build.py -- --kind coin --preview
node scripts/items-pack.mjs
```

## Canal backdrop (decided Nov 2026, M3)

What the player sees through the window and the door glass: the pavement, a granite embankment with a cast-iron railing, the canal with a moored boat, a humpbacked granite bridge, and a row of 19th-century plastered houses (with shop fronts, invented Cyrillic signs, a side street, a lime tree and a church dome behind). Overcast northern daylight, like the bake's sky.

It is a **single Cycles render made from the player's eye**, not a 3D scene. The counter camera only rotates (plus a couple of centimetres of sway), so a picture taken from the eye with the camera's lens shifted onto a rectangle 7 m beyond the window is exactly right through both openings. It is drawn as one flat plane in the game, so it costs one draw call.

- `art/backdrop/scene.py` builds the street, embankments, water, bridge, boat and houses as geometry (helpers in `art/backdrop/geo.py`), in three.js coordinates like the bake. Everything is seeded; there are no third-party assets. The sign lettering is Inter, the copy bundled with Blender (see `ATTRIBUTION.md`).
- `art/backdrop/build.py` works out the smallest rectangle on the plane `z = 11` that covers the window and the door glass from the eye, from the sway extremes and from the inspect camera, plus a 1.5% margin. It renders that rectangle at 1280 px wide (about 1.5× what a DPR-2 portrait phone needs when it looks straight at the window) with 256 samples and OpenImageDenoise. A `water` AOV pass becomes the alpha channel (the water mask), and a mist pass adds the distance haze. It tone-maps with the game's ACES curve so the picture matches the room. It writes `art/out/backdrop/canal.png` and `canal.json` (git-ignored), and the committed `art/backdrop/preview.jpg` for review.
- `scripts/backdrop-pack.mjs` (`npm run backdrop:pack`) encodes the PNG as KTX2 (ETC1S with mipmaps, sRGB, about 180 KB) and writes `public/assets/backdrop/{canal.ktx2, canal.json}`. `--mode uastc` gives a sharper but much bigger file.
- At runtime, `src/render/backdrop.ts` loads after the shop. It is one `ShaderMaterial`. Inside the water mask, two layers of a small scrolling noise, laid out on the water surface in metres, nudge the lookup by a few texels so the reflections shimmer, and add faint glints. Reduce motion stops the ripples. A gentle daylight tint follows the shop clock (cool morning, neutral midday, warmer afternoon, dimming after 18:00).
- If loading fails, the old canvas card (`canalBackdropTexture()` in `src/render/textures.ts`) stays. `?nobackdrop=1` forces the card, for comparison.
- `tests/backdrop.test.ts` checks that the render still covers both openings as `bake/layout.json` places them, that it was made from the layout's eye, and that the committed render matches the scripts (input hash).

Rebuild it (Blender 4.5.15 at `~/blender`; about 9 minutes on 4 cores at 256 samples; there is no CI workflow, so commit the result together with the script change):

```
~/blender/blender --background --factory-startup --python art/backdrop/build.py -- --samples 256
npm run backdrop:pack
```

`--samples 64` is enough for composition work. `--develop` re-runs only the haze and tone step on the last render's passes, and `--exposure` sets the brightness for that step.

Limits: the water reads as a band seen through the railing. The window sill hides everything nearer than about 20 m, so the canal is drawn 30 m wide with the water at a high spring level. The inspect camera and the idle sway see a few centimetres of parallax, which nobody notices at that distance.

## Customers

Plan A: 2–3 rigged CC0 humanoid bases (check Quaternius "Universal Base Characters" and Sketchfab CC0 rigged scans), 6 outfit texture variants each, 6 upper-body poses (neutral, nervous, proud, impatient, pleased, angry) baked as animation clips. Faces: a portrait card in the dialogue strip carries the identity; the 3D model only needs silhouette and posture. Target under 15k tris per character.

Plan B (fallback if Plan A looks cheap on phone): no 3D customer; a hand-painted or AI-free illustrated portrait card in the dialogue strip, item appears on the counter from the right. Many successful shop games do this. Decide at M3 after a one-day test.

## Audio

- Ambience: canal water, distant trams, rain, wind for winter. Freesound CC0.
- Foley: door bell, item set on glass, loupe click, scale beep, drawer, coins, cash register. Freesound CC0 or Kenney.
- Music: optional, low-key. Only CC0 or CC BY tracks; prefer none over a license risk.

## UI

Space Grotesk for menus (Longlight brand). A receipt-style mono font for tags and ledger. Paper/plastic textures from ambientCG for tag and card backgrounds. Icons: Kenney game icons or Lucide (ISC license, fine).

## Pipeline commands (to add in M3)

```
npm run assets:optimize   # gltf-transform: draco + ktx2 + prune + dedup on public/assets
npm run assets:check      # verify every file in public/assets has an ATTRIBUTION.md line
# bake: GitHub Actions 'bake' workflow (see Bake pipeline above)
# canal backdrop: art/backdrop/build.py in Blender, then npm run backdrop:pack (see Canal backdrop above)
```
