# 03 — Roadmap (Lombard)

Work one milestone at a time. Each has a definition of done. Update the status line as you go.

## M0 — Skeleton (status: done Nov 5, 2026; phone check passed: 60 fps, occasional dips to 58–59)

Goal: a page loads on a phone and shows the shop.

- Vite + TS + Three.js project with the folder layout from `02-ARCHITECTURE.md`.
- ESLint, Vitest, `deploy.yml` GitHub Actions deploy to Pages on push to `main`.
- Build number (short SHA + date) shown small in a screen corner.
- `npm run shots` (Playwright screenshots at phone/landscape/desktop sizes) for self-review before every push.
- Placeholder shop: a boxy room built from primitives, a counter, env map lighting from a Poly Haven HDRI.
- Counter camera with idle sway. Quality tier benchmark stub.
- `GameState` type, reducer skeleton, seeded RNG with tests.
- Portrait HTML overlay with a dialogue strip and three buttons that dispatch actions.

Done when: deployed URL loads on a phone at 30+ fps with the perf overlay visible.

## M1 — The counter loop, ugly (status: built; awaiting the 5-day phone playtest)

Goal: play one day with placeholder art.

- Item definitions: 10 items across 3 categories (gold jewelry, Soviet watches, phones), each with tells and at least one fake profile. Item models are primitives or Kenney-style placeholders.
- Inspect view: orbit, zoom, 3 tools (loupe, scale, magnet), findings cards.
- Offer view: estimate entry, offer number pad, buy / pass.
- Haggle state machine with temperaments, approaches, tests under fixed seeds.
- Walk-in customer generator (no regulars yet), 8 customers per day, queue patience.
- Day end ledger, autosave to IndexedDB, continue career.
- Save code: copy and load in settings, with migrations and a size test.

Done when: a tester can play 5 days on a phone, lose money on fakes, and make money on real gold.

## M2 — Shop and economy (status: built; simulator criteria met, awaiting phone playtest)

- Display slots, drag items into cases, tag pricing, walk-in buyers who haggle.
- Pawn loans with interest and redemption.
- Rent, expenses, first upgrades (acid kit, reference book tiers, better case).
- Specialist retainers: 2 specialists (jeweler, watchmaker) with accuracy, honesty, relationship, call allowance.
- Career start: name-your-shop screen (default Lombard No. 7), short intro scene, leftover inventory from the previous owner.
- 30 item definitions across 6 categories. Demand by season.
- Headless simulator and first tuning pass.
- News screen at day start (demand hints only).

Done when: the simulator shows a careful policy growing ~15%/month and a careless one busting by day 40.

## M3 — Real art pass (status: in progress. Task 1, the bake pipeline, is done: Colby triggered bake #5 from the GitHub app and it deployed as build 6c45ea1. The 30 item models are done (PRs #7–#12). Room layout locked Nov 5 (layout v2: glass counter and cases, back room). Shop dressed and lit (option B, full bake). Next: the customer A/B test, audio, quality tiers)

- **First task: bake pipeline end to end on a grey box.** `bake/layout.json` with the placeholder room, `bake/bake.py`, and `.github/workflows/bake.yml` (download + cache Blender, preview and full quality, gltf-transform optimize, commit outputs). Wire the lightmap into `scene.ts` on `uv1`. Done when a preview bake triggered from the GitHub mobile app lands in the deployed build. ✅ Done (bake #5 → 6c45ea1).
- Lock the room layout with Colby from preview-bake screenshots before dressing it (layout changes after this mean rebakes). ✅ Locked Nov 5 with Colby's changes: glass showcase counter, a low glass case behind it to the player's right, a freestanding glass case on the floor, and a storeroom off the wall to the player's left (see 05).
- Head look at the counter (Colby, Nov 5): drag to turn the head while the eye stays put (full yaw, pitch −55°…+50°); double tap, a new customer, inspect and the portrait offer view recentre it; reduce motion = no inertia and an instant recentre; `?look=<yaw>,<pitch>` for review. Tapping the item on the mat now opens inspect too. ✅ Done.
- Canal view through the window and door (Colby asked for a better river): scripted Cycles render from the eye on a lens-matched plane, moving water, day-clock tint. ✅ Done.
- Dress the shop: CC0 props, Poly Haven / ambientCG materials, deliberate clutter and slight misalignment (scripted jitter) so it doesn't look procedurally tidy. Surface textures ✅ (ambientCG colour maps on the room's surfaces). Props ✅ first pass (22 Poly Haven models, lighting baked per vertex). Clutter ✅ (a second wave of 29 props replacing the placeholder boxes).
- Lighting pass with Colby on preview bakes (warmth, window light, dark corners), then one full bake. ✅ Colby picked option B (warm evening, lit wall cases) on Nov 5; full bake run. Glass cases, shelves, lamp, window with a canal backdrop card.
- First 30 items as real models, Draco + KTX2 pipeline. Decided Nov 5: scripted in Blender (`art/items/`), since CC0 sources had almost nothing usable. **Done:** all 30 defs have a scripted glb (coins #7, gold #8, watches #9, militaria #10, phones #11, cameras #12). Review any one on the phone with `?gallery=1&item=<id>`.
- Customer representation decided (Plan A rigged models vs Plan B portrait cards) after a 1-day test of what CC0 humanoids look like in-scene on phone. ✅ Colby picked Plan A with Microsoft Rocketbox (Nov 5); a 25-person cast now plays the walk-ins.
- Audio: ambience, door, counter, tools. ✅ 13 CC0 sounds from OpenGameArt (Kenney, rubberduck, laleksic, ignasd, randommind, LEGIT Audio) plus two generated tones, ~387 KB, plain WebAudio keyed to state changes, Sound on/off and an ambience level in Settings.
- Quality tiers wired and measured on a real mid-range Android.

Done when: screenshots look like a real shop and the phone still holds 30 fps.

## M4 — People and story (status: not started)

- 20 regulars with schedules, memory, and dialogue.
- Remaining 3 specialists (militaria, antiques, electronics) with their small arcs.
- Story engine and 4 arcs: Grandmother's Medals, Dubai Rolex Guy, The Student's Laptop, Protection (first half).
- Reputation by group. Shoplifting and security upgrades.
- Title screen, career slots, settings (motion, text size), Longlight-branded menu.
- Add to Kelbo.Website hub.

Done when: a 30-day playthrough has recurring characters the tester can name.

## M5 — Crime layer (status: not started)

- Heat and Volkova visits, stolen bulletin, cooperate / lie / bribe branches.
- Pressure and the full Protection arc, vandalism events, mob fenced goods.
- Fence character and relationship.
- Endings system: the four hidden axes, forced endings (eviction, raid, mob), Retire option from day 90, ending titles, newspaper epilogue, per-character epilogue cards; career summary screen.
- The Collector and Volkova arcs.

Done when: a clean run, a mob-friendly run, and a fence-heavy run all play differently and all can end.

## M6 — Launch polish (status: not started)

- 120 items, 40 regulars, 8 arcs, 3 seasons of news.
- The Flood event, The Appraiser hire (a visible employee who walks between the back room, the counter and the floor; see 05).
- Desktop layout pass (landscape, mouse hotspots, keyboard shortcuts).
- Save migrations tested across all milestone versions.
- Localization-ready strings (English only shipped).
- Performance final pass; first-load under 15 MB.

Done when: it ships on the hub as 1.0.

## After launch (parked, see 05)

More categories, a second shop district, Steam build via Electron/Tauri, achievements, seasonal events.
