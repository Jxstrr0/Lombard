# 01 — Game Design Document

# Lombard

## One-line pitch

You own a pawn shop (a *lombard*) on a canal in Mostograd, a Russian river city, in the 2010s. Every customer is a puzzle: what is this thing, what is it worth, and is this person lying to you?

## Pillars

1. **Every item is a puzzle.** Inspection is the core skill. Fakes are spotted through real-ish techniques (hallmarks, serials, weight, UV, references), and the player gets better, not just the character.
2. **People, not transactions.** Customers are recurring characters with histories. How you treat them matters more than any single deal.
3. **The counter is a window on the city.** The player never leaves the shop, but the city's story (the canal district, the police, the mob, the economy) arrives through the door.
4. **Consequences are slow and real.** Buy stolen goods and nothing happens today. Something happens in three weeks.

## Setting

**City:** Mostograd ("bridge city"), a fictional river city modeled on St Petersburg: canals, drawbridges that open at night and strand people on the wrong bank, 19th-century facades, a Soviet-era outer ring. The shop is in a canal-side district, ground floor of an old building, one room plus a back office door.

**Player character:** you bought a failing pawn shop cheap and are starting over. Who you were before is never specified (no name, face, or history beyond this). The shop came cheap for a reason: the previous owner left town in a hurry, and some of the regulars, one creditor, and at least one man in a leather jacket still think the shop owes them something. This is the seed for the first week's warmth and the Protection arc; it is told in one short intro scene and through what customers say, never in a lore dump.

**Shop name:** the player names it at career start. Default: *Lombard No. 7*. The name appears on the window sign, receipts, and the newspaper.

**Era:** 2010s. Smartphones exist but the shop still uses paper tags and a ledger. Online prices exist and the player can check a reference site, but it costs time and is sometimes wrong for older or local items.

**Tone:** warm slice-of-life with dark-comedy edges. Think regulars who bring tea, a grandmother selling medals to fix a roof, a guy who swears the fake Rolex is "from a friend in Dubai." The crime layer is grounded, not cartoonish: pressure from men who are polite until they aren't, a detective who may or may not be straight, a fence who is useful and dangerous.

**Currency:** rubles. 2010s-ish purchasing power (a decent used phone ~8,000 ₽, a gold wedding band ~10,000 ₽, a rare Soviet watch ~40,000 ₽).

**Language:** English UI and dialogue. Signage and some flavor text in Cyrillic (shop sign, tags, newspaper headlines) with no need to read it.

## Core loop

```
Day start → customer enters → [story | item presented]
  → INSPECT (tools, time pressure)
  → DECIDE (buy / pawn loan / pass / call it in)
  → HAGGLE
  → outcome (item to inventory | customer leaves | consequence seeded)
→ between customers: price and place inventory, handle walk-in buyers, phone calls
→ Day end: ledger, reputation summary, news, events seeded for future days
```

A day is 8–14 customers depending on reputation and season. Real-time within a customer (the line builds; a clock runs during inspection), turn-based between customers.

## Systems

### 1. Items

Every item instance has:
- `defId`: an item definition (e.g. `watch_pobeda_1958`)
- `condition` 0–100
- `authenticity`: `genuine | fake | frankenstein | restored` (frankenstein = real parts, wrong combination; restored = real but refinished, which affects value)
- `provenance`: `clean | unknown | stolen | heirloom` (hidden)
- `traits`: visible/discoverable facts (hallmark present, serial, scratches, wear pattern, smell, weight)
- `trueValue`: what the market would pay today
- `story`: the customer's claim about it (may be true)

Item **definitions** cover categories: jewelry & gold, watches, Soviet militaria & medals, cameras & optics, electronics & phones, instruments, icons & religious art, coins & banknotes, tools & workshop, sports gear, antiques & porcelain, luxury handbags/apparel. Launch target: 120 definitions, 30 at M2.

Each definition declares its **tell set**: the specific checks that reveal authenticity or condition for that category, and how hard they are.

### 2. Inspection

The item lifts to eye level. Player orbits with drag, pinches to zoom. Tools are a radial/bottom bar:

| Tool | Reveals | Cost |
|---|---|---|
| Loupe | hallmarks, engravings, serials, surface wear | 10 s |
| Scale | weight vs expected (gold, silver, coins) | 8 s |
| UV light | restoration, repainting, modern glue, paper whiteners | 12 s |
| Magnet | ferrous vs non-ferrous (gold, silver, coins, "titanium" junk) | 4 s |
| Acid kit (unlock) | gold purity | 20 s, consumable |
| Reference book (unlock tiers) | model/year/value ranges; out of date for some categories | 15 s |
| Phone lookup (unlock) | serial lookup, online price, stolen database (limited queries/day) | 20 s |
| Specialist call (retainer) | expert opinion from your retained specialist for that category; accuracy depends on the specialist and your relationship | 60 s, call allowance |

Each tool use produces a **finding** card. Findings are the player's evidence. The game never says "FAKE"; it says "hallmark reads 583 but stamp edges are soft" and the player decides.

Time pressure: a queue counter shows waiting customers. Each waiting customer loses patience; impatient ones leave (lost sale, small rep hit). Players learn which checks matter per category and get faster.

### 2b. Specialists (retainers)

Specialists are named characters, one per category group, hired on a monthly retainer:

| Specialist group | Categories covered |
|---|---|
| Jeweler | gold, jewelry, coins |
| Watchmaker | watches, small mechanisms |
| Militaria collector | medals, Soviet militaria, banknotes |
| Antiques dealer | icons, porcelain, antiques, instruments |
| Electronics tech | phones, electronics, cameras |

- Retainer: a monthly fee buys a call allowance (e.g. 6 calls/month). Extra calls cost a per-call fee. Numbers live in `tuning.ts`.
- Each specialist has hidden `accuracy`, `honesty`, and `relationship`. Accuracy is good but not perfect; honesty matters because some specialists will lowball an item so they can buy it from you themselves.
- Relationship grows with steady payment and good referrals; it improves accuracy and unlocks favors (a quick verdict for free, a buyer for an odd item, a warning about a fake in circulation).
- Firing or switching specialists is possible. Each has a small arc (the watchmaker with failing eyesight, the antiques dealer with mob ties).
- Start of career: no retainers. The first one unlocks in week 1 as part of onboarding.

### 3. Appraisal and offer

After inspection the player enters an **offer** (buy) or a **loan amount** (pawn). The game tracks `trueValue` vs offer. Profit is made on resale, so buying at 40–60% of true value is the healthy range; lowballing below ~25% insults and can cost reputation; overpaying on a fake is the main way to lose money.

Pawn loans: customer gets cash, item held 30 days, interest accrues (tunable, ~10%/month). If unredeemed, the item is yours. Loans are the slow, warm money; buys are the fast money.

### 4. Haggling

A short state machine, 2–5 rounds:

- Customer has a hidden `ask`, `floor`, `temperament` (stubborn, flexible, desperate, proud), and `knowledge` (how well they know the value).
- Player counters with a number plus an optional **approach**: *Straight* (just the number), *Evidence* (cite a finding; strong if the finding is real and relevant, backfires if irrelevant), *Sympathy* (works on proud/sentimental sellers, costs margin), *Walk* (threaten to pass; works on desperate, insults proud).
- Each round moves the customer's acceptance threshold based on temperament and approach fit. Tells (posture, line delivery) hint at temperament.
- Outcome: accept, counter, or walk. Walking customers may come back later in the day or the week at a different price.

Buying side (walk-in buyers): same machine in reverse. Customers haggle you down on displayed items; pricing high and holding firm sells slowly for more.

### 5. Customers

Two pools:
- **Regulars** (authored, ~40 at launch): named characters with arcs, schedules, and memory of how you treated them. Examples: the retired navy engineer selling instruments one at a time, the student who keeps pawning the same laptop, the woman who brings things from "her late husband" that are suspiciously new.
- **Walk-ins** (generated): archetype + name + item + story, drawn from templates. Keep the city feeling alive.

Customer state: `trust` (toward you), `desperation`, `temperament`, `knowledge`, `flags` (owes you, warned, offended, referred by X).

### 6. Shop and inventory

The shop is the 3D scene. Inventory lives in **display positions**: counter case (6 slots, high visibility), wall shelves (12), back shelf (20, low visibility), safe (unlimited, not for sale). Position affects how often walk-in buyers ask about an item and whether thieves notice it.

Pricing: player sets a tag price. Sell probability per day = f(price / trueValue, visibility, category demand this season, shop reputation).

Shrinkage: shoplifting is a thing. Cheap items on open shelves disappear if reputation with the local kids is low or security isn't upgraded.

### 7. Economy and progression

- Start: ~80,000 ₽ cash after buying the shop, a near-empty shop with a few leftover items from the previous owner, loupe + scale + magnet, basic reference book.
- Expenses: rent (monthly), utilities, specialist retainers, protection "insurance" if you accept it, employee wages later.
- Upgrades: tools, better cases (visibility + security), lighting, a sign, a security camera (deters theft, also records evidence), a second counter (hire an appraiser).
- Employee: one appraiser hire mid-game. They handle overflow customers with their own accuracy stat; mistakes are yours to eat.
- Category demand drifts by season (electronics before school year, gold when the ruble wobbles, medals around Victory Day).

Failure: cash below negative rent for 2 months = eviction (game over, career stats shown). The mob and police can also end a career. No permadeath mid-day; it's a slow slide you can see coming.

### 8. Crime, police, and the mob

Three dials, all hidden, all shown through events:

- **Heat** (police): rises when you buy items on the stolen bulletin, buy from flagged people, or fail to keep a ledger. Weekly, Detective Volkova visits. She asks about specific items. Options: cooperate (lose the item, gain her trust), lie (risky, rises heat if caught), bribe (works until it doesn't). High heat: raid, items seized, fine, possible shutdown.
- **Pressure** (mob): a crew "offers" protection in week 2–3. Paying costs 8–12% monthly but removes certain thefts and brings fenced goods at a discount. Refusing invites vandalism, a brick through the case, then escalation. Mid-game arc lets you play them against the police, with real risk.
- **Fence relationship**: a character who sells you suspicious goods cheap and buys your problem items. Great margins, feeds Heat, and the fence remembers every time you said no.

The player can run a totally clean shop. It's slower and the mob makes it hard, but it's a valid path with its own arc (the honest-shop ending).

### 9. Story arcs

Authored multi-week arcs triggered by conditions. Launch target: 8 arcs.
- The Grandmother's Medals (tutorial-ish warmth: a real Order, a fake Order, and a choice)
- The Dubai Rolex Guy (recurring fake-seller comic relief who eventually brings something real)
- The Collector (wants one specific icon; pays absurdly; it's stolen from a church)
- Protection (the mob arc; opens with the previous owner's debts landing on you)
- Volkova (the detective arc; branches on honesty)
- The Student's Laptop (slice-of-life, loan system tutorial)
- The Flood (city event: canal floods, demand and supply shift, chance to be a hero or a vulture)
- The Appraiser (hiring arc: competent, hiding something)

### 10. Day/time and events

- Calendar with weekdays, seasons, holidays (New Year, Victory Day, start of school). Holidays change customer mix and demand.
- Newspaper at day start: hints at demand shifts, stolen-goods bulletin, story beats.
- Phone calls between customers: specialists, the fence, Volkova, the landlord.

### 11. Save and career

One career per slot, three slots. Autosave after every customer and at day end, to the browser (IndexedDB).

**Save code (moving between devices):** Settings → "Copy save code" produces one text string (compressed, versioned) the player can paste into Notes, a message, or email. Settings → "Load save code" on another device restores the career into a slot, and autosave continues from there. Same idea as PEW's save code. No accounts, no cloud, no backend. The title screen shows a small reminder if the player hasn't copied a code in 14 in-game days.

### 12. Retirement and endings

The career has no fixed length. From **day 90** (tunable), a "Retire" option appears in the ledger. Retiring ends the career and plays an ending built from how you ran the shop.

Forced endings still exist: eviction (broke), shutdown (police raid), and being pushed out (mob). These are endings too, not just game-over screens.

**How the ending is chosen.** Four hidden axes accumulate over the whole career:
- **Wealth:** final cash plus shop value.
- **Clean ↔ dirty:** stolen goods bought, bribes paid, fence dealings, protection paid vs refused.
- **Heart ↔ hustle:** fair offers to desperate people, loans extended, regulars helped vs lowballed and burned.
- **Standing:** reputation with the neighbourhood, Volkova, the mob, and the specialists.

The ending is a **title** plus an **epilogue**. Example titles (final list authored in M5/M6):
- *The Honest Lombard*: clean, warm, modest money.
- *Banker of the Canal*: clean, rich, respected but not loved.
- *The Neighbourhood's Pawnbroker*: warm, scrappy, everyone knows your name.
- *Fence of Mostograd*: dirty, rich, untouchable for now.
- *A Front*: the mob owns the shop in all but name.
- *Sold Out*: rich, cold, alone.
- *Got Out Clean*: dirty money, then you went straight before it caught up.

**Epilogue:** a short newspaper-style wrap-up, then one card per major regular and arc character (the grandmother, the student, Volkova, the fence, the specialists) saying what became of them, shaped by how you treated them. This is where the people pillar pays off.

The career summary screen (days run, best deal, worst mistake, people helped, people hurt, ending title) follows every ending and stays viewable from the title screen.

## Brands

No real brands. Invented equivalents the player learns:
- Watches: *Pobeda* and *Vostok* are real Soviet brands and fine to use as historical items (they are not trademarks in the luxury sense); invented luxury brands: *Rolland*, *Omeca*, *Brequet-Fils*.
- Phones: *Mangosteen* (fruit-logo phone), *Galaxia*.
- Cameras: *Zenit* (historical, fine), *Kanon*.
- Handbags: *Louis Vieux*, *Guccio*.
Each fake brand has deliberate tells that mirror real-world counterfeit tells without naming real companies.

## UI (portrait phone first)

- **Counter view**: 3D scene fills the screen. Customer stands across the counter. Item on the counter mat. Bottom third: dialogue strip and action buttons.
- **Inspect view**: item centered, dark vignette, tools in a bottom bar, findings as stacked cards on the left edge (swipe to expand).
- **Offer view**: number pad with quick-chips (25%, 40%, 60% of your own estimate, which the player enters first), approach buttons, customer reaction animation.
- **Shop management**: tap a display case to see slots; drag item cards into slots; tag price with a slider.
- **Ledger**: day summary, cash, loans outstanding, heat/pressure as vague indicators ("Volkova has been asking around").

Touch targets 44px minimum. All haggling and inspection playable one-handed.

## Accessibility

- Color never the only signal for findings (icon + text).
- Camera orbit sensitivity setting; reduce-motion option disables camera sway.
- Text scale setting.

## Business model

Free forever on the Longlight hub. No ads, no payments, no accounts.

## Out of scope for launch

Walking around the shop, multiple shops, multiplayer, voice acting, procedurally generated item models, real-money anything.
