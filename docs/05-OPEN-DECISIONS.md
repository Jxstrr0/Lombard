# 05 — Decisions, open items, parked ideas (Lombard)

## Decided

| Date | Decision |
|---|---|
| Nov 4, 2026 | Engine: Three.js in the browser, GitHub Pages, TypeScript + Vite. |
| Nov 4, 2026 | Art: as realistic as CC0 / CC BY content allows; strong lighting, modest prop count. |
| Nov 4, 2026 | Scope: medium to medium-plus; career mode with upgrades and authored story arcs. |
| Nov 4, 2026 | Setting: fictional 2010s Russian river city modeled on St Petersburg. English UI, Cyrillic flavor text. |
| Nov 4, 2026 | Tone: warm slice-of-life with dark-comedy edges. |
| Nov 4, 2026 | Interaction: fixed at the counter; items lift into an inspect mode with orbit/zoom; no physics; no walking. |
| Nov 4, 2026 | Progression: one long career, autosave, 3 career slots. |
| Nov 4, 2026 | Devices: phone portrait first, landscape and desktop later. |
| Nov 4, 2026 | Crime: all in (stolen goods, bribes, mob protection, fencing). Violence off-screen. |
| Nov 4, 2026 | **Title: Lombard.** |
| Nov 4, 2026 | **City: Mostograd** ("bridge city"). |
| Nov 4, 2026 | **Player character:** bought a failing shop cheap, fresh start. No name, face, or past shown. The previous owner left in a hurry and left debts and grudges behind (seeds week 1 and the Protection arc). |
| Nov 4, 2026 | **Shop name:** player names it at career start; default *Lombard No. 7*. |
| Nov 5, 2026 | **Shop lighting: Blender Cycles bake, headless, run in GitHub Actions.** Preview and full quality presets, Blender cached, outputs committed and auto-deployed. Colby never needs a PC or the Blender UI. See 04-ASSETS § Bake pipeline. |
| Nov 5, 2026 | **Review workflow:** Colby reviews on phone via GitHub Pages; build number shown on screen; Claude Code self-reviews with Playwright screenshots before pushing. |
| Nov 5, 2026 | **Career end:** retire whenever you choose (from day 90); ending title + epilogue depend on how you played. Forced endings (eviction, raid, mob) remain. See GDD § 12. |
| Nov 5, 2026 | **Saves across devices:** copy-paste save code (like PEW) plus browser autosave. No cloud sync. |
| Nov 5, 2026 | **Business model:** free forever on the Longlight hub. No ads, payments, or accounts. |
| Nov 4, 2026 | **Specialists:** monthly retainers, one named specialist per category group, with accuracy, honesty, and relationship. See GDD § 2b. |
| Nov 5, 2026 | **Repo visibility: public.** Unlimited Actions minutes for deploys and bakes. |
| Nov 5, 2026 | **Toolchain versions:** current stable Vite (8.x) and Vitest instead of Vite 5 (out of support); TypeScript stays on 5.x (typescript-eslint does not support 7.x yet). Exact versions pinned in `package.json`. |
| Nov 5, 2026 | **Placeholder counter (M0):** wooden showcase with a glass top only (no glass sides). With glass sides, the sightline through the top exits the far side and shows the floor instead of the felt bed. Worth keeping in mind for the real counter in M3. |
| Nov 5, 2026 | **Delivery:** each task goes on a branch with a PR; Claude Code squash-merges it once checks pass, and the merge to `main` deploys. |
| Nov 5, 2026 | **M1 resale path:** until display cases and walk-in buyers land in M2, bought items sell to a dealer after closing at 80% of true value (± noise, `tuning.appraise.dealerRate`). It exists only to close the loop and test the economy; M2 replaces it as the main way to sell. |
| Nov 5, 2026 | **Built-in findings:** the scale, condition, and magnet checks produce findings with reserved tell ids starting with `@` (`@weight`, `@condition`, `@magnet`). They are not entries in an item's `tells`. Code that looks up `def.tells` by id skips them. A `source` field on `Finding` may replace this convention later. |
| Nov 5, 2026 | **Shop clock:** 1 real second = 1 shop minute (`CLOCK_MINUTES_PER_SECOND`, display only). Tool buttons show their cost in real seconds; the HUD clock shows shop time. |
| Nov 5, 2026 | **New career** overwrites the autosave: the new career is written first, then the old one is deleted. 3 career slots come with the M4 title screen. |
| Nov 5, 2026 | **M1 economy check (throwaway sim, 40 seeds × 5 days):** a careful policy (scale, loupe, and magnet, then pass on authenticity red flags and open at ~45% of the claim) took 80k to ~129k with near-zero fake losses. A careless policy (open at 90% of the claim and take the counter-ask) bought ~6 fakes and went broke in 40/40 runs. Meets M1's "lose money on fakes, make money on real gold". The proper headless simulator comes in M2. |
| Nov 5, 2026 | **Pawn loans:** 30-day term at 10% per 30 days, prorated by days held with a 7-day minimum, amounts rounded up to 10 ₽. 3 days' grace (interest keeps running), then the item is forfeited to the safe at paid = principal. Pawners ask 0.6 × what they'd ask to sell. About 29% of walk-ins want a loan (more if desperate or heirloom). Redeem chance falls with desperation and rises for heirlooms; people who pawned a fake come back about 0.2× as often, so a fake pawn is how you get stuck with one. A redeemer who gives up waiting comes back the next day. |
| Nov 5, 2026 | **Rent and bills (after the M2 sim pass):** rent 38,000 ₽ + utilities 5,500 ₽ a month, charged at closing on the last day of each calendar month (first bill day 29, 31 March). Retainers are paid on the same night for the month ahead; call allowances reset then. Cash may go negative; eviction is an M5 forced ending. |
| Nov 5, 2026 | **Specialists (M2):** Faina Gelfand, jeweler (gold, coins: 6,000 ₽/month, 6 calls, 1,500 ₽ per extra call; accurate but lowballs good pieces), and Ilya Semyonovich Brodsky, watchmaker (watches: 7,500 ₽/month, 5 calls, 2,000 ₽ extra; honest, failing eyesight). Retaining mid-month is prorated; releasing gives no refund. Relationship +0.15 per month paid, −0.3 on release; it adds up to +0.1 accuracy. Findings never say FAKE. |
| Nov 5, 2026 | **Upgrades (M2):** acid kit 3,500 ₽ (10 tests; refill 1,500 ₽, cap 30); price guide 6,000 ₽ (tier 2) and auction catalogue 15,000 ₽ (tier 3, needs tier 2); better counter case 18,000 ₽ (counter visibility ×1.3). Reference tier 1 is implicit from day 1 and out of date for phones/electronics. Acid, reference and specialist work once per item per visit. |
| Nov 5, 2026 | **Selling (M2):** buyers are planned at day open from displayed, tagged items: daily chance = base 0.28 × price factor × area visibility (counter 1, wall 0.6, back 0.3) × case bonus × demand × reputation, at most 4 buyers a day. Their hidden ceiling comes from true value × demand × temperament, never above your tag; naive buyers can be partly fooled by fakes. Holding firm sells slowly for more. The dealer stays as a fallback at 58% of value. The shop sheet never shows true value; price chips are multiples of what you paid. |
| Nov 5, 2026 | **Demand and news (M2):** season tables per tag, flat holiday windows (New Year, Defender Day, Women's Day, Victory Day, White Nights, school start), a seeded mean-reverting drift per tag (0.8–1.25) with occasional shocks (ruble wobble, phone launch…). The morning paper (*Вечерний Мостоград*) runs 1–3 stories that hint at demand without numbers. |
| Nov 5, 2026 | **Career start (M2):** name the shop (default *Lombard No. 7*), three intro cards, then 3–5 leftover items in the safe at paid 0 (at least one fake and one decent genuine piece). |
| Nov 5, 2026 | **M2 simulator result (`npm run sim`, 40 seeds):** careful policy (checks every item, passes on red flags, opens at 40% of its estimate, keeps a 10-day rent reserve, tags at ~1.05× its estimate) grows ~18%/month over 60 and 90 days and never goes under; careless policy (one loupe look, offers near the claim, tags at cost, dumps stock on the dealer) is insolvent by day 29 in every run. `tests/sim.test.ts` guards the bands (careful 8–30%/month, careless bust ≤ day 40). "Bust" = worth (cash + stock at cost + loans out) below zero. |
| Nov 5, 2026 | **Bake pipeline as built (M3 task 1):** Blender 4.5.15 LTS (pinned), geometry generated by script from `bake/layout.json` into one mesh per material kind (baked / dynamic / glass / unlit, set in `bake/materials.py`). Lightmap = Cycles diffuse direct+indirect without colour on uv1, OIDN-denoised, 8-bit sRGB PNG ÷ `lightmapScale`, shipped as KTX2 UASTC (+RDO, Zstd) via the `ktx2-encoder` npm package instead of `toktx`, so CI installs no system tools. Lightmapped surfaces render as `MeshBasicMaterial` (no double lighting from the two real-time lights; also the cheapest shader on phones); metals stay `MeshStandardMaterial`. Draw calls in the counter view fell from 66–100 to 27–33. Previews are JPEG (~45 KB each) to keep the repo small. The grey box stays as a fallback when no bake exists (`?nobake=1` forces it). |
| Nov 5, 2026 | **Bake workflow commits to the branch it ran on** and then dispatches `deploy.yml` there; `deploy.yml` publishes to Pages only from `main`. Push-triggered bakes are preview quality and skip themselves when the committed bake's input hash matches. |
| Nov 5, 2026 | **Item models are scripted, not sourced (M3):** CC0 / CC BY sources have almost nothing usable for our 30 items (no Soviet watches, coins, medals; branded phones; Sketchfab downloads need a token). Every item is built by a headless Blender script in `art/items/` (real relief geometry, one baked AO texture), packed with Draco + KTX2 into `public/assets/items/`, and opted in per def with `model.glb`. Moves "Procedural item models" out of Parked. See 04-ASSETS § Scripted item models. |
| Nov 5, 2026 | **Room layout locked (M3, layout v2):** Colby kept the room size, window and door, and asked for more glass and a back room. The counter is now a full glass showcase (top still at 0.94 m, so the mat and item anchors don't move), with a low glass case behind it to the player's right (the layout's −x wall) and a freestanding glass case out on the shop floor; the two tall wall cases and the right-hand glass shelves stay. A storeroom (≈2.9 × 2.4 m, metal shelving with tagged pledge boxes, workbench, bare bulb) opens off the wall to the player's left behind the counter (the layout's +x wall), door swung open so it's visible when the player turns; it replaces the back-wall office door (a pinboard hangs there now). The door glass is see-through so the canal shows through it. Walkways stay clear between the back room, behind the counter and the shop floor for a future employee. Bake: `room.annexes` lists extra volumes whose faces survive culling; small point lights glow inside the cases. The procedural grey box (`?nobake=1`) still shows the old layout; it's only a fallback. |
| Nov 5, 2026 | **Head look at the counter (M3):** the eye stays fixed; a one-finger / mouse drag on the 3D view turns the head, camera-style (drag right = turn right), 0.3° per CSS px with light inertia (0.11 s decay), full 360° yaw, pitch −55°…+50°. It recentres (eased) on a double tap, a new customer, entering inspect and the portrait offer view, and never on its own otherwise. Reduce motion: no inertia, instant recentre. A one-time "Drag to look around" hint shows on the empty counter (seen-flag in localStorage, a per-device convenience). Camera-feel constants live in `src/render/camera.ts` and `src/input/look.ts`, not tuning.ts. `?look=<yawDeg>,<pitchDeg>` sets the start offset for review. Tapping the item on the mat opens inspect (same action as the button). |
| Nov 5, 2026 | **Canal view through the window and door (M3):** a Cycles render made from the player's eye (`art/backdrop/`, headless Blender, seeded, no third-party assets), shown on one lens-matched plane outside the street wall; the eye never moves, so it's perspective-correct. Water mask in alpha drives a cheap ripple shader (static under reduce motion); a daylight tint follows the day clock. Packed as ETC1S KTX2 (178 KB), committed, no CI workflow: rebuild only if the window, door or eye moves (a test enforces it). The canal is drawn 30 m wide with high water because the window sill hides the nearer water. `?nobackdrop=1` shows the old canvas card. |
| Nov 5, 2026 | **Day length: 10–12 real minutes** (Colby). A day is a fixed queue (8 walk-in sellers for now, plus buyers and redeemers), not a timer: the customer at the counter is always finished. `tuning.day.customersPerDay` stays 8 until Colby times a real day on the phone; then it and the shop clock's scale (`CLOCK_MINUTES_PER_SECOND` in `src/ui/format.ts`, which should read ~18:00 at closing) get tuned to the measurement. |
| Nov 5, 2026 | **Surface textures (M3 dressing):** the room's big surfaces get CC0 ambientCG colour maps, recoloured to average each material's authored colour so the tuned palette and the bake's bounce light stay the same. Prepared once by `art/materials/prepare.py` and committed in `bake/textures/`; they ride inside `shop.glb` as KTX2. Only colour maps, since the shop is unlit plus lightmap. See 04-ASSETS § Surface textures. |
| Nov 5, 2026 | **Props (M3 dressing):** 22 CC0 Poly Haven models (25 placed), vetted for real brands, prepared by `art/props/prepare.py` into committed `bake/props/*.glb`, placed from `bake/layout.json`. Their lighting is baked per vertex (a colour attribute) rather than into the room's lightmap, which can't hold their thousands of tiny UV islands. See 04-ASSETS § Props. |
| Nov 5, 2026 | **Clutter (M3 dressing):** a second wave of 29 Poly Haven props (59 instances of 51 kinds in all) replaces the placeholder boxes on the shelves, in the cases and in the storeroom. Draw calls are about 106 of 150, so a prop texture atlas is held back for quality tiers. Big flat faces are subdivided (`densify`) because per-vertex lighting only sees corners. |

## Open, decide at the milestone listed

| Item | Default until decided | Decide at |
|---|---|---|
| Customers in 3D (Plan A) vs portrait cards (Plan B) | portrait card in dialogue strip; 3D silhouette optional | M3, after a 1-day test. A roaming employee (below) needs 3D people, which favours Plan A |
| Hired employee who walks around the shop (Colby, Nov 5): the GDD's one appraiser hire becomes a visible person who moves between the back room, behind the counter and the shop floor | not built; layout keeps the walkways clear | build with The Appraiser hire (M6); depends on the Plan A/B decision |
| Retirement unlock day | day 90 | M5, after playtesting career pacing |
| Lighting mood (sky strength, pendant/lamp power and warmth) | overcast sky 0.35, pendants 12 W 2700 K, counter lamp 22 W 3000 K | M3 lighting pass on preview bakes |
| Preview render tone mapping: Cycles previews use AgX (+0.74 EV), the game uses three's ACES; midtones read darker in the previews than in game | game screenshots are the reference | M3 lighting pass |

When an open item is decided, move it to the Decided table with the date.

## Parked (do not build without a decision)

- Prop texture atlas (all prop base-colour maps in one texture, one material): cuts ~60 draw calls to 1 if the quality-tiers measurement asks for it.
- Phone landscape: the dialogue strip covers most of the counter. Revisit in the M6 desktop/landscape layout pass.
- Loan extensions/renewals (pay interest only), reputation effects of forfeits and lowballing pawners, regulars who re-pawn the same item (M4 Student's Laptop).
- Selling state awards (militaria) is a legal grey area: a hook for the M5 crime layer. Militaria heirloom provenance needs `tuning.items.heirloomCategories`.
- Displayed items rendered in the 3D cases (M3 art pass); the item a buyer wants already shows on the counter mat.
- Customers who walk out remember the price they were offered and come back later with it (GDD §4). Needs a perceived-value field on the haggle record; belongs with regulars (M4), or with M2 walk-in buyers if it's cheap.

- Canal view extras: seasonal variants (snow on the railing, ice, autumn leaves), a dusk/night render with lit windows and lamps crossfaded by the clock, passing boats and pedestrians as small sprites, rain on the glass.

- Walking around the shop or the street.
- A second shop location.
- Multiplayer or shared leaderboards.
- Voice acting.
- Live-service seasonal content.
- AI-generated dialogue at runtime (no API calls in this project).
- Steam / paid desktop build (game is free forever; revisit only if that changes).
