# 04 — Assets (CC0 / CC pipeline)

Goal: as realistic as free-and-open content allows, on a phone. The strategy is **great lighting + a modest number of good props**, not thousands of assets.

## Licensing rules

- Preferred: CC0 (no attribution required, but we attribute anyway).
- Acceptable: CC BY 4.0 (attribution required, in `ATTRIBUTION.md` and the in-game credits screen).
- Accepted for one library: MIT for the Microsoft Rocketbox avatars and animations (Kelbo, Nov 5, 2026). Like CC BY, it needs attribution plus the licence notice, which `ATTRIBUTION.md` carries in full.
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

**Fallback only** (if the bake pipeline hits a wall): kitbash from CC0 props plus Poly Haven textures on primitives, lit by a strong HDRI and contact-shadow decals. About 70% as good. Do not switch to this without asking Kelbo.

## Bake pipeline (decided Nov 2026, built in M3 task 1)

Everything runs headless; no one opens the Blender UI.

**Run it from a phone:** GitHub app → repo → Actions → **bake** → Run workflow → quality `preview` (default) or `full` → Run. A preview takes ~5 minutes including the Blender download on a cold cache; the result is committed and deployed automatically, and the build number in the game's corner then ends in `bake preview <commit>` (or `bake full …`). The Cycles renders from the player's eye land in `bake/out/preview.jpg` (portrait), `bake/out/preview-wide.jpg`, and `preview-left.jpg` / `preview-right.jpg` (head turned left to the storeroom door, right to the wing case; note the player looks along +z, so +x is on their left); open them in the repo to judge layout and mood. Add `?nobake=1` to the game URL to see the old procedural grey box for comparison.

1. `bake/layout.json` describes the room in three.js coordinates (metres, y up): room size (plus `annexes`, extra boxes such as the storeroom whose faces survive the outside-the-room culling), every object (box / cylinder / cone / sphere / torus for the grey box, glb props later) with position, rotation, material, optional `repeat` and seeded `jitter`, plus the light rig (ceiling pendants, counter lamp, overcast sky through window and door portals), and the two preview cameras.
2. `bake/materials.py` is the single source for static materials: colour, roughness, metalness, an optional surface `texture` (see § Surface textures), and a `kind`:
   - `baked`: diffuse, gets the lightmap; drawn as `MeshBasicMaterial` + lightmap at runtime so the two real-time lights (there for the item and the customer) don't light the room twice;
   - `dynamic`: metals; not in the lightmap, lit at runtime by the env map and the two lights (they still cast shadows in the bake);
   - `glass` and `unlit`: hidden during the bake, drawn transparent / flat at runtime.
   `kind` travels to the game as a glTF material extra; a surface texture travels as the material's base colour texture.
3. `bake/bake.py` (`blender --background --factory-startup --python bake/bake.py -- --quality preview|full`):
   - generates all geometry straight into four meshes, one per kind (so the shop costs about one draw call per material: ~30 instead of ~70–100 for the old grey box), applying the seeded jitter and culling faces nobody can see;
   - welds the baked mesh so boxes that meet act as one surface: drops faces pressed flat against another opaque box (cut along that box's sides first if only partly covered), splits edges at T-junctions and beauty-triangulates the result. Each flat wall then unwraps as one lightmap island, and no hidden face sits at a visible edge to depth-fight. Without this, a wall built from several boxes shows a dark or bright line at every joint;
   - uv0 = world-metre box projection divided by the material's texture tile (tiling textures), uv1 = Smart UV Project + pack (all islands selected) with a margin for the target resolution;
   - bakes Cycles diffuse lighting (direct + indirect, no colour) to uv1, denoises it with OpenImageDenoise, regrows the margin from each island's own texels (before and after the denoiser, which blurs across islands), and stores it as an 8-bit sRGB PNG divided by `lightmapScale` (written to the manifest; the game multiplies back);
   - bakes the props' lighting per vertex (see § Props);
   - exports `bake/out/shop_raw.glb` with both UV sets and renders the two previews (AgX, exposure matched to the game's ACES).
4. `scripts/bake-pack.mjs` (glTF Transform + `ktx2-encoder`, both npm packages, no system tools): Draco-compresses the glb, re-encodes its surface textures as KTX2 (ETC1S, sRGB, mipmaps), converts the lightmap to KTX2 (UASTC + RDO + Zstd, mipmaps), and writes `public/assets/shop/{shop.glb, shop_lightmap.ktx2, shop.json}`. Preview bake: 60 KB + 180 KB.
5. `.github/workflows/bake.yml`:
   - triggers: `workflow_dispatch` with `quality` (preview default), and pushes that change `bake/**`, the pack script or `scripts/bake-hash.sh` (preview; skipped if the committed `shop.json` already has the same input hash);
   - the input hash comes from `scripts/bake-hash.sh`, used both to decide whether to bake and to check, just before committing, that the inputs on the branch haven't changed under the run (the one list of inputs; `input_files()` in `bake/bake.py` must match it);
   - downloads the pinned Blender LTS Linux build and caches it with `actions/cache`;
   - runs on the standard `ubuntu-latest` runner (never a larger runner; those are always billed);
   - commits `public/assets/shop/*` and the preview images back to the branch it ran on, then dispatches `deploy.yml` for that branch (a push made with the workflow token doesn't trigger workflows itself). `deploy.yml` publishes only from `main`; on other branches it just runs the checks.
   - Runs on the same branch queue rather than cancel, so a push never kills a full bake in progress.
6. Runtime (`src/render/bakedShop.ts`): loads `shop.json`, then the glb (Draco decoder, Basis for its textures) and the lightmap (Basis transcoder; both copied from three into `public/assets/decoders/` by `npm run dev`/`build`), builds the materials per kind, and replaces the grey box. If there's no bake, the grey box stays.

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

## Surface textures (decided Nov 2026, M3 dressing)

The room's big surfaces (parquet, plaster, ceiling, dado paint, counter and case wood, felt, rubber mat, door paint, cork, the storeroom's lino and peeling plaster, cardboard) carry a real CC0 colour map from ambientCG.

- Each `texture` entry in `bake/materials.py` names its source (`ambientcg:<asset id>`), its size in pixels, how many metres one repeat covers (`tile`), and how it's recoloured.
- `python3 art/materials/prepare.py` (system Python with Pillow and numpy, needs the network) downloads the 1K JPG, keeps only the colour map, resizes it, and recolours it so its average is the material's authored `color`. Mode `scale` keeps the texture's own hue variation (wood, cork, cardboard); mode `tint` keeps only its brightness pattern times the authored colour (plaster, paint, fabric), so a red or blue source can't leak its hue. `contrast` squeezes or stretches the variation. It writes `bake/textures/<material>.jpg`, which is committed: CI never downloads anything. Rerun it only when an entry changes.
- The bake maps the texture on uv0 and still bakes lighting only, so the lightmap doesn't change; the glb carries the textures and bake-pack turns them into KTX2 ETC1S (about 1 MB for all fourteen, a few MB of GPU memory with mips).
- Only colour maps: the shop is drawn unlit plus lightmap (`MeshBasicMaterial`), so normal and roughness maps would do nothing.
- The textures are bake inputs: changing one triggers a preview bake (`scripts/bake-hash.sh` hashes `bake/textures/*` with the other inputs).

## Props (decided Nov 2026, M3 dressing)

The shop is dressed with CC0 models from Poly Haven: a cash register, an old TV, clocks, a boombox, a cassette player, a ukulele, a suitcase, a security camera, cardboard boxes, a monobloc chair by the window, a plant on the sill, and in the storeroom a kettle, a multimeter, a toolbox, crates, a hand truck, a broom and a dustpan. A second wave (the clutter pass) put stock on the shelves and in the cases: a video camera, a drill, a film projector, binoculars, a jug, a teapot, vases, a rotary phone, brass binoculars, a microscope, a compass, lighters, spectacles, a candleholder, a chess set and an oil lamp. It also added a notepad, pen cup and stapler on the counter, two paintings, a ceiling fan, and a binder, microwave, cleaner bottle, army crate, jerrycan and trash bag in the storeroom. These replace the coloured placeholder boxes. Each was checked for real brands. Rejected for logos or real text: Poly Haven's camera, TV, extinguisher, fire alarm and postcards in the first wave; a Leica-marked camera, a 3M-style tape measure and a parody bleach bottle in the second.

- `art/props/prepare.py` (headless Blender, needs the network) lists them with a triangle budget and a texture size. It downloads the 1k glTF and keeps the listed parts (`keep`/`drop` are regexes on object names). It joins them, puts the origin at the bottom centre with the front facing glTF +z, optionally rescales (`scale`), decimates, and drops glass covers, lenses and flames (drawn opaque they'd hide the clock faces). It strips any vertex colours, subdivides big flat faces when the spec sets `densify` (see below), keeps only the base colour texture, and writes `bake/props/<id>.glb`. Those are committed bake inputs; CI never downloads anything.
- `bake/layout.json` places them with `{"shape": "prop", "prop": "<id>", "position", "rotation", "scale"?, "jitter"?}` entries (in the `props` group). Unrotated, a prop's front faces +z, away from the player at the counter.
- Their lighting is baked **per vertex**, not into the lightmap: decimated scans unwrap into thousands of tiny islands that each need a texel gutter, which no shared 512–2048 lightmap can give. After the room's lightmap bake, Cycles bakes diffuse lighting (no colour) into a `lighting` colour attribute on the joined `shop_props` mesh, divided by the lightmap's scale. It isn't denoised, so it takes more samples (`prop_samples`: 256 preview, 1024 full). Props still cast shadows into the room's lightmap. One catch: a big flat face (a painting's canvas, a notepad) gets only its corner samples, which sit in the frame's shadow, so it bakes black. Set `densify` (the longest edge, in metres) on such a prop to subdivide the faces that are big in both directions. Vertex colours a model ships with are stripped (in prepare and again in the bake). Otherwise the join copies them onto every prop as extra `COLOR_n` sets beside `lighting`, and the game reads the wrong one.
- At runtime a material with `kind: "prop"` is `MeshBasicMaterial` with its texture × vertex colours × the lightmap scale, so props and room sit in the same light.
- Budget: ~125k triangles and 60 materials (draw calls) for 59 instances of 51 kinds (the whole shop: about 106 draw calls of the 150). The shop glb is about 5.3 MB, of which textures are about 3.3 MB. Reusing a prop costs triangles but no draw call, since instances share the material. If draw calls get tight, the next step is a prop texture atlas (one material); parked for the quality-tiers task.
- Add a prop: add it to `PROPS` in `art/props/prepare.py`, run it with `--only <id>`, place it in the layout, push (the bake runs). Add its ATTRIBUTION line.

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
- A def opts in with `"glb": "<id>.glb"` in its `model`. The game shows the placeholder at once and swaps the glb in when it loads. The hidden placeholder stays as the cheap raycast proxy for hotspot occlusion. `?noglb=1` forces placeholders. `?gallery=1&item=<id>` shows one model large, front and back, which is how Kelbo reviews a model on the phone.
- `tests/itemModels.test.ts` checks that defs and packed files agree.
- **Laptop (M4, `art/items/kinds/laptop.py`)**, the Tosaki Orbita C40 for The Student's Laptop: a 14-inch 2013 machine, 336 × 236 × 26 mm base, lid open at 110°. It is built in two local frames, one for the base and one for the lid, each turned into three.js item coordinates. Keyboard with Latin and red Cyrillic legends (a few keys in gloss for the worn shine), palm-rest spec sticker, ports on both sides, battery bay with its label, service hatch, rating sticker with serial and barcode, and a metal wordmark on the lid. 33.9k triangles, 11 draw calls, AO 1024 px, ~240 KB packed.
  - Printed things (key legends, sticker text, the screen) stand **60 µm** proud. Draco quantizes positions to about 21 µm over the laptop's 34 cm, so 10 µm print collapses into its surface and disappears.
  - Print that thin drops its side walls, about two thirds of the text triangles.
  - The def sets `"rest": "upright"`. The counter and the inspect view then show the laptop standing on its base, not laid on its back like the flat items, and `src/render/items.ts` has a matching `laptop` placeholder.
- **Wave B kinds (M6).** `box.py` builds anything that is a box with a front, one function per id: the two cassette decks, the VHS recorder, the turntable under its smoked lid, both consoles, the Nevka, the two Kanon digitals and the zoom lens, the tablet, the music player, the car stereo, the dashcam, the dental crowns and the gold bar in its blister card. `record.py` builds an LP lying on its sleeve, with track bands, a run-out with a scratched matrix number, the paper label, and the cover art and price drawn as flat shapes and text. It also builds the bone record: x-ray film snipped round, with a burned centre hole, on a paper envelope. `book.py` builds a stack of three encyclopedia volumes and a signed hardback in a chipped dust jacket. Both follow the `box`/`record`/`book` placeholders in `src/render/items.ts`. They reuse the phone kind's helpers (`slab`, `F`, `pocket`/`cut`). The existing kinds got variants: four medal designs, the Order of the Patriotic War, the anchor chain, a bezel-set ruby ring, four phones, five watches, six coins and the Zenit-TTL. Results: 5k–53k triangles. Hi-fi pieces take up to 18 draw calls, because each knob, meter and key material is its own; one inspected item still leaves the shop view well under 150.
  - Print on big items is set per item: at least 0.018% of the longest side (about 77 µm on a 43 cm deck). This is the laptop's 60 µm rule scaled, because Draco's 14-bit positions step about 26 µm over a deck.
- **Wave C kinds (1.1).** `box_c.py` holds the wave C `box` builders, one function per id; `box.build` falls back to it for any id not in `box.BUILDERS`, so the defs keep `"placeholder": "box"`. Besides the phone kind's `slab`/`F` it has its own small helpers: `sweep`/`tube` (a profile along a polyline: laces, cage bars, the headphone band, the reel bail), `lathe` (puck, stopwatch, reel spool, lenses), `ellipsoid` (glove bodies), `outline` (inset rings with `lib._offset_loop`), a Liang-Barsky `clip`, and seeded `signature`/`scrawl` strokes for the signed puck and football (no real names). It builds both pairs of skates, the stick (curved blade), the puck, a truncated-icosahedron football, the goalie mask with its cage, the pair of boxing gloves, the chess clock, the marathon medal, the reel, the stopwatch, the tablet, the e-reader, the car navigator, the transistor radio, the headphones, the speaker, the Lyra TLR and the Kanon D70. The two phones are variants in `phone.py` (`galaxia(s5=True)`, `m3g(m5c=True)`). Results: 5.6k–30k triangles, 3–14 draw calls.
- The `items` workflow (`.github/workflows/items.yml`) rebuilds and commits the models when a push to `main` changes `art/items/` or the pack script, or on demand from the GitHub app (Actions → items → Run workflow). Normally the models are built and committed together with the builder change.

Run locally (Blender 4.5.15 at `~/blender`):

```
~/blender/blender --background --factory-startup --python art/items/build.py -- --kind coin --preview
node scripts/items-pack.mjs
```

### M6 wave A: CC0 items and code-drawn kinds (decided Nov 2026)

Wave A adds four categories (instruments, tools, silver & jewellery, household antiques; 44 defs). Here Poly Haven does have usable CC0 models, so the art comes two ways:

- **CC0 models (14 items).** `art/items/cc0.json` lists them, keyed by def id: the Poly Haven asset (`src`), which objects to keep, a rotation into item coordinates, a triangle budget, texture size and the hotspots as pixel picks on a front/back/top/bottom preview. `art/items/cc0.py` (headless Blender) downloads the 1k glTF, joins, re-orients and centres it, drops glass and flame materials, decimates, resizes textures (colour at 512 px, normal and roughness maps at half), resolves each hotspot onto the surface with a ray cast, and writes `art/out/items/<id>.glb` plus `<id>.json` (size, triangles, hotspots). `scripts/items-pack.mjs --only <id>` packs it like any scripted item. In the def, `model.placeholder` is `block` with `model.size` from the json: a plain box shown while the glb loads (the glb is then its own raycast proxy). Each one has an `ATTRIBUTION.md` row. About 3.8 MB for the 14 together, 170–740 KB each (the chess set is the largest at 30k triangles); each loads only when that item is at the counter, so first load doesn't grow.
  ```
  ~/blender/blender --background --factory-startup --python art/items/cc0.py -- --only drill_hartwig --preview
  node scripts/items-pack.mjs --only drill_hartwig
  ```
- **Code-drawn kinds (30 items).** Accordions, balalaika, guitars, violin, trumpet, saxophone, power tools, socket set, sewing machine, spoons, tea-glass holder, cups, beads, cameo, amber pendant, samovar, figurine, vase and gramophone are built at runtime in `src/render/itemsWaveA.ts` (same coordinates; half extents listed at the top of the file and in `tests/items.test.ts`). No download at all; they can get scripted glbs later like the M3 items.
- On the mat, anything longer than 42 cm is scaled down to fit (`MAT_MAX` in `src/render/stage.ts`); inspect shows it at full size.
- Known texture text: the ukulele's headstock reads KOLO (so the brand is Kolo), the plane's casting reads MADE IN ENGLAND (fits Leman), and the metal detector's box and coil carried the artist's invented marks (ROYAL SYSTEMS, "Gebo Hunter X"). Those are blanked: the entry's `paint` list in `art/items/cc0.json` fills the two side plates, the model line, the badge and the coil sticker on the base colour map, so the shipped texture has no maker's text (the plates and sticker stay, empty).
- Sizes on the mat: an item sits at true size unless it is smaller than 9 cm (a ring, a coin: blown up to read) or longer than the 42 cm mat (shrunk to fit). Nothing in between grows. A CC0 model whose source is bigger than the real thing is brought down with `model.scale` (vice 0.8, plane 0.75, hand drill 0.8, teapot 0.8, chess set 0.75); the coal samovar draws at 0.8 and the electric one at 0.68.

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

## Street life outside the window (decided Nov 2026, M3)

The canal render is a still photo, so the view gets a thin layer of life drawn over it (Kelbo asked for the outside to be "animated and more alive"). It is presentation only: it reads the career seed, the day, the season and the shop clock, and it never writes game state.

What moves:

- **People** on the shop's pavement (waist up through the window), on the near embankment walk, along the far railing and on the far pavement. They walk both ways at 0.95–1.4 m/s, about one every half minute past the window. One spawn in five is a pair. They carry umbrellas on a rainy day. The street is quieter in rain, in snow and after dark.
- **Traffic** on the far embankment road: cars, a minibus and a rare bus, keeping to the right.
- **A tour boat** every five minutes or so. Its wake breaks up the water's ripple behind it, and it has a reflection. There are no boats when the canal is frozen.
- **Pigeons**: a small flock crosses the sky now and then. Once in a while one lands on the outside windowsill, pecks, looks about and flies off. This only happens on dry days in daylight.
- **The sky and the season**: clouds drift. Street lamps, shop fronts and then house windows come on in two waves at dusk. Dusk follows the season's sunset (winter mid-afternoon, white nights in summer).
- **Weather**: each day's weather is seeded from the career seed and the day, so a reload keeps it. A rainy day brings streaks and beads on the window and door glass and a wet, darker street. A snowy day brings flakes and a whiter street. In winter the canal is frozen.

How it is made (all self-generated, no third-party assets beyond the Rocketbox cast already in the game):

- `art/street/build.py` (headless Blender, seeded) renders:
  - **people sheets**: 8 Rocketbox cast members (4 men, 4 women) walking side-on, 8 frames each of the cast's own walk clip, 128×256 px cells in a 2048×1024 atlas. There is a dry sheet and a rain sheet, which adds an umbrella held by IK in the near hand.
  - **a props sheet**: three cars, a minibus, a bus, a tour boat and the pigeon frames (stand, two pecks, four wing beats, landing).
  - **canal extras**: an RGBA data image at half the canal render's size. R is a depth code, so a sprite hides behind the railing, the bridge or the boat per pixel. G is the lamps and shop fronts, B is the early windows and A is the late windows, rendered in the canal scene at night with only those emitters on. It uses the backdrop's own scene and camera (`art/backdrop/scene.py`), so it lines up with the photo pixel for pixel.
- `scripts/street-pack.mjs` (`npm run street:pack`) encodes the three sheets as KTX2 (ETC1S, mipmaps, sRGB) and the data image as lossless WebP (exact, so the depth codes survive). It writes `public/assets/street/`.
- At runtime, `src/render/street/` builds its schedule in `plan.ts`, which is pure. It uses its own random streams forked from the career seed and the day, so it never shifts the game's RNG. It draws with:
  - two instanced sprite layers (people; vehicles, boat and birds);
  - one weather layer on the glass, made of two quads.
  The clouds, night lights, weather grading and boat wake are added to the canal backdrop's existing shader (`src/render/backdrop.ts`), at no extra draw. Sprites beyond the backdrop plane are pulled in along the eye ray so they sit inside the camera's far plane and look the same size.
- Everything loads after the shop is ready (`__lombardReady`). A day downloads one people sheet (dry or rain), not both. If loading fails, the street simply stays still.
- Reduce motion turns the street still: no people, traffic, boat or birds, still clouds, and on the glass the drops and flakes freeze and the streaks go. The lamps, windows and weather grading stay. The Low tier draws fewer rain and snow layers.
- Numbers (measured headless at 390×844, `?perf=1`, a busy rainy street at the counter):
  - 3 draw calls (33 → 36) and about 0.1k triangles;
  - about 4.0 MB of decoded textures (people sheet 2.7 MB, props 0.5 MB, canal data 0.8 MB);
  - downloads per day: 621 KB dry or 696 KB in rain (people sheet 361 or 434 KB, props 64 KB, canal data 179 KB), plus an 18 KB script chunk (7 KB gzipped).
- Each passer-by on the shop's pavement calls `StreetLife.onWindowPasser`. `main.ts` points this at the shop life's `passerBy()`, so their shadow crosses the sun patch on the floor, and turns off the shop life's fake passers while the street runs.
- `tests/street.test.ts` checks:
  - the schedule (gaps, pairs, directions, the effect of weather and dark, no boats on ice);
  - the weather odds and the dusk times;
  - that the packed sheets match the scripts and the current canal render (input hashes);
  - that a day's download stays under 1.5 MB.

Review flags:
- `?street=0` turns it off.
- `?street=busy` gives four times the traffic.
- `?weather=clear|rain|snow` and `?season=…` set the conditions.
- `?time=HH:MM` is the shop's own review clock (shared with the shop life), so the street, window light and wall clock agree.

`node scripts/street-shots.mjs` (after `npm run build`) writes day, dusk, rain and snow shots, plus a second day frame one second later, to `shots/street-*.png`.

Rebuild it (Blender 4.5.15; about 15 minutes for people and props at 32 samples, about 4 minutes for the canal extras at 64; commit the result together with the script change):

```
~/blender/blender -b --factory-startup --python art/street/build.py -- --samples 32 [--only people,props,canal]
npm run street:pack
```

Rerun `--only canal` after every canal backdrop rebuild. The test fails until you do, because the data image must match the photo.

Limits:
- People are flat side-on sprites, so they only walk along the street, never towards the shop.
- The near asphalt lane in front of the shop has no traffic: a car there would fill the window at a size the sprites can't hold up to.
- There is no tram, because the render has no tracks.
- There is no snow on the railing, and no rain sound yet.
## Shop life (decided Nov 2026, M3 art pass)

Kelbo asked for the shop to feel more alive. `src/render/life/` adds small moving things on top of the bake, all dynamic, all presentation (they read state like the rest of `render/`, never change it). None of it touches `bake/`: the bake is the room as it is, and these sit in its light.

- **Built in code, nothing to download.** Every mesh, shader and the two small canvas textures are made at runtime. The cost is one lazy JS chunk (`life-*.js`, ~20 KB, ~7 KB gzipped) that `main.ts` imports after `__lombardReady`, so first load doesn't grow. No third-party assets, so no new `ATTRIBUTION.md` lines (the clock's prop row notes the new dial).
- **Wall clock** (`wallClock.ts`): the baked Poly Haven clock over the street door had frozen hands and a face that bakes almost black (per-vertex lighting only sees the rim). A new dial disc sits inside its bezel, in front of the old hands: a 256 px canvas face (no maker's name) and hands drawn in the fragment shader as anti-aliased segments with a faint drop shadow. Hour and minute show the shop time (`day.clock`); the second hand ticks once per real second (one shop minute passes per tick, so a true second hand would spin) and is hidden under reduce motion. Lit flat at a level matched by eye to the plaster round it. No tick sound: the clock is 7 m away over the street ambience, and a tick every second would grate on a phone.
- **Window light** (`sunlight.ts`): one floor quad, the window opening projected along the light (`timeOfDay.ts`: elevation, azimuth, strength and tint per hour). It slides from the left wall in the morning towards the door side in the afternoon, gets longer and warmer, and fades out by about 18:40 (the sun goes behind the houses across the canal). The shader draws soft panes, the middle post and transom shadows (wider than the bars, and softer further from the glass), the sill plant's shadow, and clips to the floor in front of the counter. It brightens what is there (blend dst × (1 + light)), so the parquet keeps its colour and baked shading. The strength breathes with passing cloud over tens of seconds. It is thin March sun through cloud to match the overcast canal render, so it stays soft.
- **Passers-by**: a soft shadow crosses the sill end of the patch now and then (seeded, every 16–48 s). `ShopLife.passerBy(direction, speed)` is the hook for the street (`render/street/`) to drive real ones; `life.sunlight.setFakePassers(false)` turns the fake schedule off.
- **Dust** (`sunlight.ts`): 320 motes, one additive `Points` call. Positions live in window space (u, v across the opening, metres along the light), so they always stay in the beam however the sun moves. They twinkle as they tumble and fade with the patch strength.
- **Storeroom tube** (`tubeLight.ts`): a fluorescent batten on the storeroom's far wall over the shelves (seen through the doorway when looking up a little, `look=-95,8`), with a soft glow on the wall round it. Every 9–34 s it stutters (a run of blinks, one time in four a drop-out and restart). A dimmer quad across the doorway darkens everything seen through it with the tube, so the flicker reads in the `-95,-8` view too, where the tube itself is out of frame. Emissive and blend only, no real-time light. Steady under reduce motion.
- **Tea** (`teaGlass.ts`, `teaModel.ts`): a faceted glass in a cupronickel holder with a teaspoon, on the counter by the lamp (seen at `look=-38,14`, and in landscape and desktop). Lit like the items (env map and the counter lamp). It's sipped down a step every 7 shop minutes, cools (steam fades), and is topped up with a short pour in the first lull after it's half gone. Steam is 16 soft puffs in one `Points` call.
- **Settings**: reduce motion stops the dust, steam, cloud, passers-by and flicker and hides the second hand (the clock still shows the time). The Low tier drops the particles (dust, steam).
- **Flags**: `?life=0` leaves all of it out. `?time=HH:MM` makes the room show that shop time (window light, wall clock, canal tint) for review; the HUD and the game keep their own clock.
- **Budget**, measured headless at 390×844 with `?perf=1` (tier mid), life on vs `?life=0`: counter (`0,-4`) 35 vs 31 draw calls; window (`0,18`) 38 vs 33; wall cases (`-38,14`, tea in view) 49 vs 42; (`38,14`) 46 vs 43; storeroom (`-95,8`) 43 vs 38. At most +7 calls in a view and about +1.1k triangles (the tea glass; everything else is a few dozen). Textures: the dial (256², ~0.35 MB with mips) and the tea's contact shadow (128², ~0.09 MB), under 0.5 MB decoded. Download: the ~20 KB chunk.
- **Tests**: `tests/life.test.ts` checks shop time against the HUD clock, `?time` parsing, the hand angles, the sun table (gone before opening and after sundown, slides towards the door side, longer and warmer in the evening), the projection, the tea model, and that the window and wall-clock constants still match `bake/layout.json`.
- **Not built**: a shop cat (the CC0 sources have no realistic rigged cat: Poly Haven has only a concrete cat statue, Quaternius and Poly Pizza cats are stylised low-poly and would look cartoonish next to the baked room); the street door swinging (parked: it is baked into the room mesh, and the canal render only covers the door glass, so an open door would show nothing behind it); a counter-lamp flicker (the lamp's light is baked, so only the items would flicker); the ceiling fan turning (baked into the props mesh).

## Customers

**Decided (Nov 5, 2026): Plan A with the Microsoft Rocketbox library (MIT, accepted for this library only).** A 1-day test put a MakeHuman (CC0, via MPFB 2) and a Rocketbox man in the shop; on the phone Kelbo couldn't tell them apart, and Rocketbox won on practical grounds: a breathing idle comes with it, it's 2.5× lighter, and ~115 ready-made everyday people cover a cast without per-person work. (A survey first found no fetchable CC0 / CC BY realistic everyday adults: Quaternius's free characters are superhero bodies under an unclear licence, OpenGameArt's are fantasy-styled, Mixamo needs an account, Sketchfab CC0 scans aren't rigged.) Portrait cards (Plan B) aren't built.

**The cast.** 66 looks in `src/data/customers/cast.json` (53 avatars): 25 walk-in looks, at least one man and one woman per walk-in archetype (pensioner, student, tradesman, office worker, hustler, sailor on leave; the sailors wear the white uniform shirt and cap), and 20 **regular-only looks** (M4, `"regular": true`), ten men and ten women across the same archetypes, never given to a random walk-in so a regular's face only ever belongs to that regular. Every entry has a `note` saying who the look is (age band, gender, build, clothes, hair), so regulars can be cast by description; the regular looks include a grey-haired grandmother (`business_female_03`), a retired navy engineer type (`male_adult_14`), students, a sharp-dressed "friend in Dubai" hustler (`business_male_05`) and two tough-looking men in black (`male_adult_11`, `male_adult_20`) for the Protection arc. M6 adds one **staff-only look** (`"staff": true`): `business_male_03` (Professions), a lean man in his late thirties in a charcoal pinstripe suit and a green striped tie, worn only by the appraiser, Lev (src/data/appraiser.ts), never by a walk-in, a regular or anyone's `as`. They were picked from the Rocketbox previews to differ from the walk-in 25 and from each other; no uniforms, and nothing whose logos can't be painted out. `art/customers/build.py` (headless Blender; usage in its header) builds `public/assets/customers/<id>.glb` from a blob-less clone of the Rocketbox repo, pinned to commit 0943055, byte-for-byte reproducibly:
- the men's or women's breathing idle (`m_/f_idle_breathe_01`, ~2.7 s loop) retargeted bone for bone, first frame made the rest pose; feet on the floor, facing glTF +Z (the game turns it by π);
- a second clip, `walk` (glb clip order: `idle`, then `walk`): one stride of the men's or women's neutral walk (`m_/f_walk_neutral_01`, 1.2 s loop) from the XY-root-motion set (the static set has no walks), retargeted the same way, the stride's travel taken off so it walks in place, soles on the idle's floor (within about 1 cm; the women's clip is a heeled walk). Its ground speed is `walkSpeed` in `cast.json` (1.012 m/s men, 1.214 m/s women; every Rocketbox avatar has the clip rig's leg length, so it is one value per gender): move a walking customer at that speed, or scale the clip's time by speed / walkSpeed, and the planted foot stays put;
- 6.4k–9.8k triangles, 2–3 materials (body, head, hair or hat), no normal maps (they showed a forehead seam);
- textures: head JPEG 1024, body JPEG 768, hair PNG8 512 alpha-tested (an A/B against 1024 showed no difference at the phone framing). Decoded with mipmaps that's ~10 MB per person (11 MB at most); the game keeps two resident (the current customer and the next in line), so ~20 MB at worst;
- Draco geometry: 10.2 MB for the 25 walk-in looks with both clips (≈410 KB each; bone channels that never leave the rest pose are left out of the glb, which more than pays for the walk) plus 7.5 MB for the 20 regular looks (≈375 KB each), 17.7 MB in all, plus 7.9 MB for the M6 regular looks below (≈394 KB each; 25.6 MB in all), loaded one person at a time and never on first load;
- `PAINT_OUT` in the script blanks text, logos and real insignia before resizing: the crown over the anchor on both cap badges, a monogram-pattern tee, shoe-sole and label text, stitched pocket letters and arcuate-style pocket stitching, a brand name on a hoodie. It also holds a few recolours for the regular looks (`common.paint` mode `grey`): Rocketbox has no grey-haired woman, so the grandmother's hair (hair cards and the head texture around the face) is turned silver, the retired engineer's fringe goes grey, and one man's olive shirt and another's brown hoodie are turned black.

**In the game.** A walk-in's look is picked when they're generated (`src/game/customers/look.ts`): same archetype and the gender of their first name, never the previous customer's look, from a forked RNG stream so no other draw moves; it's stored in `portraitKey` (older saves fall back to a stable pick from the customer id). Regular looks are filtered out before any pick or hash (`walkInCast`), so the walk-in pool, and every look already stored or derived in a save, is unchanged by them (a test pins a seed's looks); a visit whose `portraitKey` names a regular look shows it (`regularCast` lists them). `src/render/customerModel.ts` loads and caches models through the shared Draco loader; the scene holds a customer back until their model is in, swaps only while nobody's at the counter, fetches the next person in line during the current visit, and shows the old silhouette if a model fails. Customers walk in from the street door and out again (`render/scene.ts` § WALK), crossfading the glb's `idle` and `walk` clips and moving at the walk clip's ground speed from `cast.json`. Review flags: `?walk=0` puts them straight at the counter, `?customer=<id>` makes everyone that cast member (regular looks too, for review), `?nocast=1` keeps the silhouette.

**M6: forty regulars.** 20 more regular-only looks for the twenty new regulars. Rocketbox's Adults folder had only ten avatars nobody wore; three are full religious or Gulf dress that the build can't take (Male_Adult_19 and 21: a keffiyeh slot with no material rule) or that cover the face (Female_Adult_16), so 7 are new faces: `female_adult_01`, `female_adult_06` (headscarf), `female_adult_10` (abaya and headscarf), `female_party_01`, `female_party_02`, `male_adult_09` (tee lettering healed out), `male_adult_15` (skullcap and kurta). The other 13 are **variants** (`<base>_b`, same Rocketbox source) of a regular's own look, re-dyed by `PAINT_OUT` with a new `common.paint` mode, `tone` (dye the masked cloth one colour, keeping its shading: luminance over its median times the colour; masks by `hue`, `sat`, `lum` and `noskin`), and some with the hair re-dyed (opacity texture plus the head texture outside the face). Each variant is **cast as that regular's relative** (Gleb's brother Zakhar in a maroon sweater with greyed hair, Alisa's twin Lera in a camel hoodie, Ulyana's sister Klava in a tram-company orange waistcoat, and so on), so the shared face reads as a family resemblance. No Business_* or profession avatar was used (the M6 Appraiser hire needs one). `tests/cast.test.ts` checks the sources, that every variant has a recolour and a "relative" note, and that no two named people (regulars, specialists, the fence, Volkova, the Collector, arc strangers) share a look.

Limits: Rocketbox has no truly elderly women, so the walk-in female pensioners read as about fifty; the regulars' grandmother is the oldest face in the library with her hair greyed by the build. Poses beyond the idle (nervous, proud, angry, from the same library) are not built yet.

## Audio

- Ambience: canal water, distant trams, rain, wind for winter. Freesound CC0.
- Foley: door bell, item set on glass, loupe click, scale beep, drawer, coins, cash register. Freesound CC0 or Kenney.
- Music: optional, low-key. Only CC0 or CC BY tracks; prefer none over a license risk.

### As built (decided Nov 2026, M3)

Freesound and kenney.nl were not reachable from the build container (403), so every sound comes from **OpenGameArt**, each pack's page checked for a CC0 licence (Kenney's packs there carry CC0 licence files too). Rows per source in `ATTRIBUTION.md`.

| File (`public/assets/audio/`) | What | Source | Plays on |
|---|---|---|---|
| `ambience.mp3` (54 s loop, 48 kbps, ~317 KB) | a street through the window, faint canal water, fridge hum as room tone | ignasd's street traffic + randommind's Vistula waves + LEGIT Audio's fridge drone | from the first tap, while sound is on |
| `door_bell.mp3` | a small bell, three strikes | rubberduck `bell_03` | a customer steps up |
| `set_down.mp3` | soft thud + faint glass tick | Kenney `bookPlace2` + rubberduck `glass_02` | their item lands on the mat (0.9 s after the bell); an item put in a display slot |
| `cash.mp3` | cash drawer + coins | laleksic `drawer_open` + Kenney `handleCoins` | bought, pawned, sold, redeemed |
| `coins.mp3` | coins | Kenney `handleCoins` | dealer sale, upgrade, acid refill, specialist retainer |
| `tool_loupe` / `tool_magnet` / `tool_page` / `tool_acid` / `tool_switch` | metal click / latch / page flip / drop / switch | Kenney `metalClick`, `metalLatch`, `bookFlip1`; rubberduck `plop_01`; laleksic `switch_on` | loupe / magnet / reference / acid / UV |
| `tool_scale.mp3`, `tool_phone.mp3` | a piezo beep; three keypad tones (DTMF 7-3-1) | generated from sine tones in `art/audio/build.py` (no third-party audio) | scale / phone and specialist |
| `ui_tap.mp3` | a short click, very quiet | Kenney `click_001` | any button tap that made no other sound |
| `lazy/door_close.mp3` | the street door shutting, its bell jingling | ElevenLabs Sound Effects v2 (Nov 2026) | a walk-in leaves, when they reach the door |
| `lazy/phone_ring.mp3` | a phone ringing (the take's silent tail trimmed) | ElevenLabs | an incoming phone visit (`via: 'phone'`) |
| `lazy/stamp.mp3` | rubber stamp + receipt torn off | ElevenLabs | a pawn is written (the cash drawer follows 0.6 s later) |
| `lazy/shutter_up.mp3` / `lazy/shutter_down.mp3` | the roller shutter going up / down (ends in a bang) | ElevenLabs | the day opens / closes |
| `lazy/newspaper.mp3` | the paper unfolded | ElevenLabs | the morning paper, 1.6 s into the shutter |
| `lazy/watch_wind.mp3` / `lazy/camera_shutter.mp3` | winding and ticking / a film camera's shutter | ElevenLabs | picking a watch / a camera up to inspect (`INSPECT_SOUND`), quiet |
| `lazy/tram_bell.mp3` | a tram passing far off with its bell, muffled | ElevenLabs | now and then while the shop is open (`src/audio/tram.ts`) |
| `lazy/rain_loop.mp3` (18 s loop, 48 kbps) | rain on the street and the window | ElevenLabs | a bed under the ambience while the street shows rain |
| `lazy/flood_loop.mp3` (18 s loop, 48 kbps) | drips and lapping water | ElevenLabs | a bed while the Flood's water stands in the shop |

- `art/audio/build.py` (system Python with numpy, plus ffmpeg with libmp3lame; needs the network) downloads the sources into `art/out/audio/` (gitignored), layers and filters them per its `RECIPES`, trims silence, and writes mono 44.1 kHz MP3s (80–96 kbps one-shots, 48 kbps ambience). Outputs are committed; CI never downloads anything.
- Loudness: one-shots to −20 LUFS momentary (loudest 400 ms), with at most 6 dB of lookahead limiting on transients and peaks under −1 dBFS; very short clicks stay a few LU under. The ambience is −26 LUFS integrated. The mix between cues is runtime gain in `src/data/audio.ts`, so a level change never needs a rebuild.
- The ambience is filtered to sound heard through glass (street low-passed to ~1.1 kHz, water to 650 Hz, hum to 380 Hz) and baked into a seamless loop (the last 3 s crossfaded, equal power, into the head). At runtime it still plays as overlapping passes with 2.5 s equal-power fades, so MP3 encoder padding can't click at the seam in any browser.
- Whole set: 13 preloaded files, ~387 KB, plus 11 lazy ones (`lazy/`), ~430 KB.
- **The ElevenLabs effects and beds (Nov 2026) load lazily.** The first load is close to its 15 MB budget, so nothing in `lazy/` joins the first-tap preload (and `scripts/check-bundle.mjs` counts only the top-level files). Each is fetched the first time its cue fires, or prefetched as its moment nears (`prefetchFor` in `src/audio/cues.ts`); a cue whose file arrives more than `AUDIO_MIX.lazyMaxLate` late is dropped. The raw takes are committed in `art/audio/src/elevenlabs/` (the generation links expire); `build.py` reads them like a source (`elevenlabs` in `SOURCES`, recipes with `"dir": "lazy"`, beds in `BEDS`), so swapping a take is replacing one file and rerunning `--only <name>`. The beds are made seamless by crossfading their last 2 s into the head (the build prints the seam step; about 1 or less is click-free) and play as the same overlapping passes as the ambience, on its bus, so the ambience level covers them.
- Add or change a sound: edit `RECIPES` (or `AMBIENCE`, `BEDS`), run `python3 art/audio/build.py --only <name>`, add the id to `SOUND_IDS` (preloaded) or `LAZY_SOUND_IDS` (fetched on demand) and `SOUND_GAIN` in `src/data/audio.ts`, map it in `src/audio/cues.ts`, add its ATTRIBUTION line.
- Not yet: winter wind, music. (Rain and a distant tram came with the ElevenLabs effects, Nov 2026.)

### Voice (pilot, Nov 2026)

| Files (`public/assets/audio/voice/`) | Who | Plays on |
|---|---|---|
| `lom_walkin_m_*` / `lom_walkin_f_*` (26 each) | any walk-in, by the gender of their first name | a hello as they step up (half of them), then a bark for each haggle or sale answer, by temperament |
| `lom_eduard_*` (3) | Eduard Lvovich | `protection.offer`, `protection.properly`, `protection.ultimatum` |
| `lom_volkova_*` (3) | Detective Volkova | her introduction, a police visit about a piece, a refused envelope |
| `lom_venya_*` (3) | Venya Mostovoy | `fence.meet`, dropping in to sell, `fence.notebook` |
| `lom_edik_*` (3) | Edik Sorokin | `rolex.dubai`, caught out by evidence, `rolex.real` |
| `lom_zinaida_*` (3) | Zinaida Petrovna | her first visit, the earrings, the ring |

- Made with ElevenLabs text to speech from the script sheet `art/audio/voice-lines.csv` (line id, character, trigger, text, voice id, the picked generation). Generating costs ElevenLabs credits, so every batch is quoted and approved by Kelbo first.
- `art/audio/voice.py` takes the downloaded takes from `art/out/voice/` (gitignored), trims silence, normalises to −18 LUFS integrated (true peak −1.5 dB) and writes mono 44.1 kHz 64 kbps MP3s. 67 files, about 1.4 MB.
- Loaded per line on first use (never at page load). Which line plays when is `src/data/voice.ts`; a new line is a row in the sheet, a run of the script, and an entry there.

## UI

Space Grotesk for menus (Longlight brand). A receipt-style mono font for tags and ledger. Paper/plastic textures from ambientCG for tag and card backgrounds. Icons: Kenney game icons or Lucide (ISC license, fine).

## Pipeline commands (to add in M3)

```
npm run assets:optimize   # gltf-transform: draco + ktx2 + prune + dedup on public/assets
npm run assets:check      # verify every file in public/assets has an ATTRIBUTION.md line
# bake: GitHub Actions 'bake' workflow (see Bake pipeline above)
# canal backdrop: art/backdrop/build.py in Blender, then npm run backdrop:pack (see Canal backdrop above)
# street life: art/street/build.py in Blender, then npm run street:pack (see Street life above)
# surface textures: python3 art/materials/prepare.py, then push (the bake runs; see Surface textures above)
# props: art/props/prepare.py in Blender, then place them in bake/layout.json and push (see Props above)
# audio: python3 art/audio/build.py [--only <name>], outputs in public/assets/audio/ (see Audio above)
```
