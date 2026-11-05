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
| Nov 5, 2026 | **M1 economy check (throwaway sim, 40 seeds × 5 days):** a careful policy (scale, loupe, and magnet, then pass on authenticity red flags and open at ~45% of the claim) took 80k to ~129k with near-zero fake losses. A careless policy (open at 90% of the claim and take the counter-ask) bought ~6 fakes and went broke in 40/40 runs. Meets M1's "lose money on fakes, make money on real gold". The proper headless simulator comes in M2. |

## Open, decide at the milestone listed

| Item | Default until decided | Decide at |
|---|---|---|
| Customers in 3D (Plan A) vs portrait cards (Plan B) | portrait card in dialogue strip; 3D silhouette optional | M3, after a 1-day test |
| Day length / customers per day | 8–14 customers, ~10–15 real minutes | M1, with a stopwatch on a phone |
| Loan interest and holding period | 30 days, 10%/month | M2, simulator tuning |
| Retainer pricing and call allowance | ~6 calls/month per specialist | M2, simulator tuning |
| Retirement unlock day | day 90 | M5, after playtesting career pacing |

When an open item is decided, move it to the Decided table with the date.

## Parked (do not build without a decision)

- Phone landscape: the dialogue strip covers most of the counter. Revisit in the M6 desktop/landscape layout pass.
- Customers who walk out remember the price they were offered and come back later with it (GDD §4). Needs a perceived-value field on the haggle record; belongs with regulars (M4), or with M2 walk-in buyers if it's cheap.

- Walking around the shop or the street.
- A second shop location.
- Multiplayer or shared leaderboards.
- Procedural item models.
- Voice acting.
- Live-service seasonal content.
- AI-generated dialogue at runtime (no API calls in this project).
- Steam / paid desktop build (game is free forever; revisit only if that changes).
