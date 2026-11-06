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

## M3 — Real art pass (status: in progress. Task 1, the bake pipeline, is done: Kelbo triggered bake #5 from the GitHub app and it deployed as build 6c45ea1. The 30 item models are done (PRs #7–#12). Room layout locked Nov 5 (layout v2: glass counter and cases, back room). Shop dressed and lit (option B, full bake). Next: the customer A/B test, audio, quality tiers)

- **First task: bake pipeline end to end on a grey box.** `bake/layout.json` with the placeholder room, `bake/bake.py`, and `.github/workflows/bake.yml` (download + cache Blender, preview and full quality, gltf-transform optimize, commit outputs). Wire the lightmap into `scene.ts` on `uv1`. Done when a preview bake triggered from the GitHub mobile app lands in the deployed build. ✅ Done (bake #5 → 6c45ea1).
- Lock the room layout with Kelbo from preview-bake screenshots before dressing it (layout changes after this mean rebakes). ✅ Locked Nov 5 with Kelbo's changes: glass showcase counter, a low glass case behind it to the player's right, a freestanding glass case on the floor, and a storeroom off the wall to the player's left (see 05).
- Head look at the counter (Kelbo, Nov 5): drag to turn the head while the eye stays put (full yaw, pitch −55°…+50°); double tap, a new customer, inspect and the portrait offer view recentre it; reduce motion = no inertia and an instant recentre; `?look=<yaw>,<pitch>` for review. Tapping the item on the mat now opens inspect too. ✅ Done.
- Canal view through the window and door (Kelbo asked for a better river): scripted Cycles render from the eye on a lens-matched plane, moving water, day-clock tint. ✅ Done.
- Life outside the window (Kelbo: "animated and more alive"): passers-by, traffic on the far road, a boat with a wake, pigeons (one lands on the sill), drifting clouds, lamps and windows at dusk by season, seeded daily weather (rain on the glass, snow, a frozen canal). ✅ Done (Nov 6).
- Dress the shop: CC0 props, Poly Haven / ambientCG materials, deliberate clutter and slight misalignment (scripted jitter) so it doesn't look procedurally tidy. Surface textures ✅ (ambientCG colour maps on the room's surfaces). Props ✅ first pass (22 Poly Haven models, lighting baked per vertex). Clutter ✅ (a second wave of 29 props replacing the placeholder boxes).
- Lighting pass with Kelbo on preview bakes (warmth, window light, dark corners), then one full bake. ✅ Kelbo picked option B (warm evening, lit wall cases) on Nov 5; full bake run. Glass cases, shelves, lamp, window with a canal backdrop card.
- First 30 items as real models, Draco + KTX2 pipeline. Decided Nov 5: scripted in Blender (`art/items/`), since CC0 sources had almost nothing usable. **Done:** all 30 defs have a scripted glb (coins #7, gold #8, watches #9, militaria #10, phones #11, cameras #12). Review any one on the phone with `?gallery=1&item=<id>`.
- Customer representation decided (Plan A rigged models vs Plan B portrait cards) after a 1-day test of what CC0 humanoids look like in-scene on phone. ✅ Kelbo picked Plan A with Microsoft Rocketbox (Nov 5); a 25-person cast now plays the walk-ins.
- Audio: ambience, door, counter, tools. ✅ 13 CC0 sounds from OpenGameArt (Kenney, rubberduck, laleksic, ignasd, randommind, LEGIT Audio) plus two generated tones, ~387 KB, plain WebAudio keyed to state changes, Sound on/off and an ambience level in Settings.
- Shop life (Kelbo, Nov 6: make the store feel alive): wall clock on shop time, window light that moves with the day (passers-by, cloud), dust, a flickering storeroom tube, steaming tea on the counter. ✅ Done (`src/render/life/`, `?life=0` to compare, `?time=HH:MM` to set the room's time).
- Quality tiers wired and measured on a real mid-range Android. Tiers ✅ wired (Settings → Graphics, Auto, `?perf=1` readout). Kelbo's phone: a smooth 60 fps (Nov 6), so the tiers were raised (High = native resolution) and customers now walk in and out, with pauses between them.

Done when: screenshots look like a real shop and the phone still holds 30 fps.

## M4 — People and story (status: done Nov 6. 20 regulars on their own schedules; story engine with the Medals, Dubai Rolex Guy, Student's Laptop and Protection (first half) arcs and the five specialists' small arcs; reputation by group, shoplifting and security; title screen and career slots; on the Kelbo.Website hub)

- 20 regulars with schedules, memory, and dialogue. Ordinary regulars ✅ (Nov 6): Zinaida plus 15 more on their own schedules (see 05); the arc characters come with their arcs.
- Remaining 3 specialists (militaria, antiques, electronics) with their small arcs. Specialists ✅ (Nov 6): Gennady Shurygin (militaria), Stanislav Lyubimov (antiques, icons, instruments), Zhenya Kroshkina (phones, cameras, electronics) are in the Office next to Faina and Ilya. Arcs ✅ (Nov 6): all five small arcs run on the story engine (`src/data/stories/{faina,ilya,gennady,stanislav,zhenya}.ts`), with phone-call and morning-paper beats, retained-months and call-event conditions, specialist effects in `tuning.specialistArcs`, and the released-specialist rule (see 05). Stanislav's fourth beat (the icon through your books) waits for Volkova in M5.
- Story engine and 4 arcs: Grandmother's Medals, Dubai Rolex Guy, The Student's Laptop, Protection (first half). Dubai Rolex Guy ✅ (Nov 6): Edik Sorokin, three Dubai fakes, then Ramil's real Rolland to pawn; how you treated him decides whether he asks you to look properly or you can wave it away (see 05). The Student's Laptop ✅ (Nov 6): Fedya Ryabov pawns the same Tosaki three times, redeems twice, and asks to renew the third; renew → graduation and he sells it to you, refuse → forfeited to the safe. Engine: `same` items, redeem plans, the `pledge` condition, the `renew` effect, save v6 (see 05). Protection (first half) ✅ (Nov 6): Zhora asks for the previous owner (Gusev) and his IOU in week 1, Eduard Lvovich offers "insurance" in weeks 2–3 (accept, haggle, refuse); paying adds a monthly Insurance expense (10%/8% of the till's net takings, 4,000 ₽ minimum); refusing brings glue in the lock and then the bakery fire story. It ends on a cliffhanger either way (the box off the books, or "next month I'll ask you properly"). `?scenario=protection` shows the offer. See 05.
- Reputation by group. Shoplifting and security upgrades. ✅ Done: five groups (neighbourhood, youth, police, mob, specialists) in `src/game/reputation.ts`, shown in the ledger as vague lines; shoplifting off open shelves from day 8; door chime, convex mirror, lockable wall case and security camera in the Office (see 05).
- Title screen, career slots, settings (motion, text size), Longlight-branded menu. ✅ Done: title screen at boot over the dimmed shop, Continue, 3 slots (play, new career → intro, delete with confirm), Load save code / backup file into a chosen slot (replace confirm), device settings from the title, Settings → Main menu in game, the backup reminder, a "More from Longlight" link. The pre-M4 autosave migrates into slot 1. `?seed=N` skips the title. Loading screen ✅ (Nov 6): a pawn-ticket card with a real progress bar paints before any JavaScript, fades out when the first screen is ready, and shows a Reload button if boot fails (see 05).
- Add to Kelbo.Website hub. ✅ Lombard is on the hub's Games page (`projects.json`: play link, code link, cover).

Done when: a 30-day playthrough has recurring characters the tester can name.

## M5 — Crime layer (status: in progress. Foundation in: save v8 with homes for heat, Volkova, the fence, the bulletin and crime events, the ending axes and endCareer)

- Heat and Volkova visits, stolen bulletin, cooperate / lie / bribe branches. ✅ (Nov 6): heat from bulletin pieces, flagged sellers (Margarita) and stolen pieces' trails, × 1.5 without a passport in the book (a 2 s pill in the inspect header); a boxed РОЗЫСК bulletin in some mornings' paper whose pieces walk in days later; Detective Volkova comes once heat or a trail makes her interested, then about weekly, and asks about specific pieces: hand it over, lie (caught through the bulletin, the camera tape, your own book or a second visit) or an envelope (refused more often each time); high heat brings a raid (seizure, a fine; a second one shuts the shop). The ledger has a Police section. A careful shop stays healthy and is almost never visited; one that lies to her gets raided. `?scenario=volkova`, `bulletin`, `raid`. See 05.
- Pressure and the full Protection arc, vandalism events, mob fenced goods. ✅ (Nov 6): refusers climb a ladder on the pressure dial: Eduard Lvovich "asks properly" a month after the bakery story, and a no brings a brick through the counter case that night (the morning paper, at most one piece gone, others marked, the case open to shoplifters until the glazier's 2,500 ₽ two days on), then the window, then the ultimatum (pay three months' back pay, or no); a week after the last no, either the street stands with you (neighbourhood standing) and he gives up, or the landlord ends the lease and the career ends, pushed out. Stanislav's word holds the ladder for a month. Payers see a third of the shoplifting, and Zhora brings the crew's own stolen goods opening at half the usual ask (heat, the clean axis); the box can be kept (dirty, heat, 5,000 ₽) or refused. Paying counts dirty, refusing clean. The sim's careful refuser takes the brick in nearly every run and still grows; a mob-friendly policy pays, buys and ends dirty and noticed. `?scenario=brick`, `?scenario=delivery`. The mob played against the police waits for Volkova. See 05.
- Fence character and relationship. ✅ (Nov 6): Venya Mostovoy, the night man on the Kupetsky drawbridge, who bought from Gusev on Tuesdays. Meets you from day 12, then rings to buy your stolen pieces and drops in with cheap goods of his own every 6–10 days; deals feed heat, dirty the shop and nudge mob standing, and every no goes in his notebook (dearer goods, meaner offers, rarer calls, a sore voice; a notebook call and a standing offer). A fence-heavy sim policy grows faster and runs hotter than the careful one, which says no without a bust. `?scenario=fence`. See 05.
- Endings system: the four hidden axes, forced endings (eviction, raid, mob), Retire option from day 90, ending titles, newspaper epilogue, per-character epilogue cards; career summary screen. ✅ (Nov 6): Retire at the foot of the ledger from day 90 (with a confirmation); eviction after a landlord's final notice and a second rent night under water; a title from 19, picked once at the end from wealth, clean, heart and standing (forced endings get their own); the last newspaper, a card for each regular, specialist, Volkova and Venya you met, and the career's final ledger. An ended career is locked, its slot shows its title and reopens the summary, and "New career" replaces it. The raid and the mob call `endCareer` and get all of this. `?scenario=ending&kind=…`, `?scenario=retire`. See 05.
- The Collector and Volkova arcs. Collector ✅ (Nov 6): Leopold Germanovich Bessmertny, of the Bessmertny Foundation for Domestic Beauty, asks after one icon from day 18 and offers 350,000 ₽; days later Seryozha the roofer brings her in cheap ("my gran's"), stolen from the Church of the Intercession during the roof repairs (the loupe finds a parish number on the back; the paper names the church the next morning; Stanislav rings if he's on retainer). Hold her and he comes with the hatbox: sell (rich, dirty, heat, the police cooler), return her to the church (heart, clean, the street warmer) or hand her to the police (clean, heat down). The paper follows each answer, and he has an epilogue card. A story-only item (never in the walk-in pool). `?scenario=collector`, `?scenario=collector-offer`. See 05. Volkova's arc: separate PR. Volkova ✅ (Nov 6): her courtesy call in every career (days 8–20, hot or not) and her own arc (`src/data/stories/volkova.ts`): her father's Pobeda for his boat motor (a fair price rings back warm, a lowball cold), then one second half by how you've treated her: honest (her source; you stall a man with a hot bracelet and ring her; a patrol car on your corner; her bayan recital), bought (she's short for the motor; internal security asks about her; tell, and she's docked pay and cold, or keep quiet and keep her evidence bag), or lied to (off duty, the ex-husband in Tver: come clean, or a grudge with a fire inspection and her car outside). Stanislav routes an icon through your books (pay, refuse or tell the police) and Volkova asks about it. Informing on Eduard Lvovich's crew jumps pressure; then either the crew finds out (a brick; likelier if she takes envelopes) or her crackdown eases them off. `?scenario=volkova-intro` and `volkova-*` / `stanislav-icon`. See 05.

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
