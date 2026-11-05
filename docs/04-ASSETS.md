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
- Room: 6 m × 8 m, high ceiling (old building), one large street window with canal backdrop as a lit card or small cube-mapped exterior.
- Counter with glass top case, two wall cases, glass shelves on brackets, a safe door, a back-office door, counter lamp, ceiling pendants, a radiator, a worn parquet or linoleum floor.
- Materials from Poly Haven / ambientCG: dark wood, scuffed laminate, plaster with stains, brass trim, glass.
- Lighting baked in Cycles to a single 2048 lightmap (4096 on desktop high tier) covering the static room. Dynamic items get lit by the env map plus the counter lamp.
- Export: glTF with Draco; textures to KTX2 via `gltf-transform`. Target under 8 MB total for the shop.

**Fallback only** (if the bake pipeline hits a wall): kitbash from CC0 props plus Poly Haven textures on primitives, lit by a strong HDRI and contact-shadow decals. About 70% as good. Do not switch to this without asking Colby.

## Bake pipeline (decided Nov 2026)

Everything runs headless; no one opens the Blender UI.

1. `bake/layout.json` describes the room: dimensions, wall/floor/ceiling materials, every prop (source glb, position, rotation, scale, jitter allowance), and the light rig (window sun + sky, ceiling pendants, counter lamp, with color temperature and strength).
2. `bake/bake.py` (run as `blender --background --python bake/bake.py -- --quality preview|full`):
   - builds the room and imports props per the layout, applying seeded jitter so placement isn't grid-perfect;
   - assigns materials (`bake/materials.py`);
   - joins static meshes by material where sensible, creates a second UV set with Lightmap Pack (no overlaps, margin set for the target resolution);
   - bakes Cycles diffuse lighting (direct + indirect, no color) to that UV set and denoises;
   - exports `shop.glb` (with both UV sets) and `shop_lightmap.png`;
   - renders a preview image from the counter camera to `bake/out/preview.png` for review.
3. `gltf-transform` compresses the glb (Draco) and converts the lightmap to KTX2.
4. `.github/workflows/bake.yml`:
   - triggers: `workflow_dispatch` with `quality` input (preview default), and push to `bake/**`;
   - downloads a pinned Blender LTS Linux build and caches it with `actions/cache`;
   - runs the bake on the standard `ubuntu-latest` runner (never a larger runner; those are always billed);
   - commits `public/assets/shop/*` and the preview image back to `main`, which triggers `deploy.yml`.

Quality presets:

| Preset | Lightmap | Samples | Expected runtime | Use |
|---|---|---|---|---|
| preview | 512 | low, denoised | a few minutes | layout and mood iteration |
| full | 2048 (4096 optional desktop tier) | high, denoised | ~10–40 min | shipping |

Rules:
- Pin the Blender version in the workflow; bump it deliberately, never `latest`.
- A layout change requires a rebake. Lock layout early in M3.
- Moving props (items on the counter, customers) are not in the bake; they're lit by the env map and counter lamp at runtime.

## Items

Three tiers of effort per item definition:
1. **Hero** (~20 items): dedicated glb, 2k textures, custom hotspots for tells (hallmark decal, serial plate, caseback). These are the items the fakes system shows off: gold rings, Soviet watches, medals, a Zenit camera, a phone, an icon.
2. **Standard** (~60): CC0 model, retextured or lightly edited, 1k textures, 2–4 hotspots.
3. **Simple** (~40): shared base meshes with texture variants (coins, banknotes, small electronics, tools), 512 textures.

Fakes reuse the genuine mesh with a texture/decal variant: softer hallmark stamp, misaligned logo, wrong font on the dial, modern screw heads, UV-glow decal for glue. Authoring a fake = authoring a decal set, not a new model.

Reference photos of real counterfeit tells (Wikimedia, auction catalogues) inform the decals but are never shipped.

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
```
