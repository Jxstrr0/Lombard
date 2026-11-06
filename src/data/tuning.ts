/**
 * All gameplay numbers live here. Never inline them in src/game.
 * One section per system; each system's owner edits only its own section.
 */

/** M4 specialist arcs: a named change to a specialist (tuning.specialistArcs.changes). See the field notes there. */
export interface SpecialistChange {
  relationship?: number
  accuracy?: number
  resetAccuracy?: boolean
  lowball?: number
  driftPerMonth?: number
  callSeconds?: number | 'standard'
  callSecondsScale?: number
  freeMonths?: number
  freeCalls?: number
  firstRefusal?: boolean
  referral?: readonly string[]
  sellBoost?: { categories: readonly string[]; factor: number }
  rentIn?: number
  release?: 'gentle'
  retire?: boolean
  cash?: number
}

/** M4 specialist arcs: some walk-ins bring a particular item for a while (tuning.specialistArcs.boosts). */
export interface SpecialistBoost {
  days: number
  chance: number
  defs: readonly string[]
  authenticity: 'genuine' | 'fake' | 'frankenstein' | 'restored'
  fakeProfileId?: string
  provenance: 'clean' | 'unknown' | 'stolen' | 'heirloom'
  /** Key into src/data/stories/specialistLines.ts BOOST_STORIES (their claim); default: the def's claims. */
  story?: string
}

/** M4 specialist arcs: a specialist buying from your stock (tuning.specialistArcs.offers). */
export interface SpecialistOffer {
  categories: readonly string[]
  pick: 'dead' | 'best'
  share: number
  min: number
  deadCondition?: number
}

export const tuning = {
  career: {
    startingCash: 80_000,
    startDate: '2014-03-03',
    defaultShopName: 'Lombard No. 7',
    /** Longest shop name the name-your-shop screen accepts. */
    shopNameMaxLength: 24,
  },

  day: {
    /** Walk-in customers per day in M1 (GDD: 8–14 once reputation exists). */
    customersPerDay: 8,
    /** In-game seconds a customer will wait in the queue, [min, max]. */
    queuePatience: [140, 260] as [number, number],
    /** Reputation lost when someone gives up waiting. */
    walkoutRepPenalty: 1,
    /** In-game seconds that pass per real second while a customer is at the counter. */
    realTimeScale: 1,
    /** In-game seconds each haggle round takes. */
    haggleRoundSeconds: 6,
    /** Quiet before the first customer walks in after opening, in-game seconds [min, max]. */
    firstArrivalSeconds: [4, 8] as [number, number],
    /**
     * The lull between one customer leaving and the next walking in, in-game
     * seconds [min, max]. Kelbo (Nov 6): keep 8 sellers a day and add pauses
     * rather than more customers; this is most of a day's length.
     */
    lullSeconds: [15, 35] as [number, number],
  },

  customers: {
    /** Weights for temperament rolls. */
    temperamentWeights: { stubborn: 1, flexible: 1.4, desperate: 0.8, proud: 0.8 },
    knowledge: [0.1, 0.9] as [number, number],
    desperation: [0.05, 0.95] as [number, number],
  },

  /** M4: authored regulars (src/data/regulars) and their memory of you. */
  regulars: {
    /** At most this many regulars drop in on an ordinary day (story beats come on top). */
    maxPerDay: 2,
    /** Extra days, [min, max], added to a regular's first scheduled day so they don't all arrive on schedule.from. */
    firstVisitJitter: [0, 2] as [number, number],
    /**
     * In-game seconds of queue patience a regular has on top of a walk-in's
     * (tuning.day.queuePatience): they came to see you and will wait for it.
     * Was an inline 60; at 60, a careful (slow) player lost about a third of
     * regulars' visits to the queue (docs/05, Nov 6 2026).
     */
    extraPatience: 240,
    /** A regular this cold waits longer between visits (× every). */
    coldAt: -0.25,
    coldEveryScale: 1.6,
    /** Greets you warmly from this trust up. */
    warmAt: 0.35,
    /**
     * Trust change by how a visit ended. A buy or pawn is judged by price ÷
     * true value (what's fair, not what you knew): at or over `fair` is a
     * good deal for them, under `low` stings, under `insult` burns.
     */
    trust: {
      bought: { fair: 0.45, low: 0.3, insult: 0.2, fairDelta: 0.12, okDelta: 0.04, lowDelta: -0.08, insultDelta: -0.2 },
      pawned: { fair: 0.3, low: 0.15, fairDelta: 0.08, okDelta: 0.02, lowDelta: -0.08 },
      redeemed: 0.06,
      walked: -0.1,
      passed: -0.04,
    },
    /** Haggling with a regular: ask × (1 − askPerTrust × trust), floor × (1 − floorPerTrust × trust). */
    askPerTrust: 0.08,
    floorPerTrust: 0.05,
  },

  /** M4: story arcs (src/data/stories). */
  story: {
    /** At most this many beats play on one day, and one per arc. */
    maxBeatsPerDay: 2,
    /** Story visitors wait as long as it takes (in-game seconds of patience). */
    patience: 100_000,
    /** Walk-in sellers never drop below this when regulars and beats take their places. */
    minWalkIns: 4,
  },

  items: {
    /** Multiplies every def's fakeChance. */
    fakeChanceScale: 1,
    condition: [35, 98] as [number, number],
    /** Restored items look refinished: their condition is the best of this many draws. */
    restoredConditionDraws: 2,
    /** Instance weight varies within ± this share of the def's weight tolerance (fakes: × weightFactor). */
    weightSpread: 0.5,
    /** Provenance roll for M1 walk-ins (stolen arrives in M5). */
    provenanceWeights: { unknown: 0.55, clean: 0.33, heirloom: 0.12 },
    /** Only these categories can be heirlooms. */
    heirloomCategories: ['gold', 'watches'] as readonly string[],
  },

  inspect: {
    /** In-game seconds per tool use (GDD § Inspection). */
    toolSeconds: { loupe: 10, scale: 8, magnet: 4, uv: 12, acid: 20, reference: 15, phone: 20, specialist: 60 },
    /** Miss chance on a tell = difficulty × this. */
    missFactor: 0.8,
    /** Each repeat use of the same tool lowers the miss chance by this factor. */
    repeatMissDecay: 0.6,
    /** Loupe aimed at a tell's own hotspot: miss chance × this. */
    hotspotFocus: 0.5,
    /** Loupe not aimed at any hotspot: hotspot tells get this much extra miss chance (before repeat decay). */
    offHotspotMiss: 0.4,
    /** No tell is ever missed more often than this. */
    maxMiss: 0.95,
    /** Scale reading noise, ± grams as a fraction of expected weight. */
    scaleNoise: 0.01,
    /** Loupe condition finding bands (lower bounds). Below `worn` the finding is negative evidence. */
    conditionBands: { mint: 85, good: 65, worn: 45 },
  },

  appraise: {
    /** Condition factor at condition 0 and 100, per value curve. */
    conditionFactor: {
      linear: [0.35, 1.05] as [number, number],
      collector: [0.15, 1.15] as [number, number],
    },
    /** Collector curve: condition is raised to this power, so wear costs more. */
    collectorExponent: 1.5,
    /** Values are rounded to `step` while below `below` rubles. */
    roundSteps: [
      { below: 1_000, step: 10 },
      { below: 10_000, step: 50 },
      { below: Number.POSITIVE_INFINITY, step: 100 },
    ] as readonly { below: number; step: number }[],
    /** Dealer resale (fallback): the dealer pays this share of trueValue. Kept well under display prices (M2). */
    dealerRate: 0.58,
    /** ± noise on the dealer's price. */
    dealerNoise: 0.08,
  },

  haggle: {
    /** Hard cap on rounds (GDD: 2–5). */
    maxRounds: 5,
    /** Fewest rounds any customer gives you. */
    minRounds: 2,
    /** Rounds each temperament gives before a final answer (capped by maxRounds). */
    roundsByTemperament: { stubborn: 4, flexible: 5, desperate: 5, proud: 4 },
    /** Chance a customer has one round less patience than their temperament allows. */
    shortRoundChance: 0.3,
    /**
     * Below this share of claimedValue an offer is an insult (the customer
     * anchors on what it would be worth if genuine; they don't know trueValue).
     * Only applies while the offer is also under their current floor.
     */
    insultRatio: 0.25,

    // --- opening position (startHaggle) ---
    /** ± spread of the customer's perceived value at knowledge 0 (shrinks linearly to 0 at knowledge 1). */
    perceptionNoise: 0.3,
    /** Knowledgeable sellers lean slightly high: perceived × (1 + this × knowledge). */
    knowledgeBias: 0.06,
    /** Opening ask = perceived × this. */
    askMarkup: { stubborn: 1.06, flexible: 0.97, desperate: 0.88, proud: 1.12 },
    /** Floor = perceived × (share − desperationFloorDrop × desperation). */
    floorShare: { stubborn: 0.74, flexible: 0.64, desperate: 0.6, proud: 0.72 },
    desperationFloorDrop: 0.25,
    /** The floor never starts below this share of perceived value. */
    minFloorShare: 0.3,
    /** Tidy prices: round to `big` at or above `bigFrom` ₽, else to `small`. */
    roundTo: { bigFrom: 2_000, big: 100, small: 10 },

    // --- per round ---
    /** Share of the gap (ask − offer) a counter gives up, by temperament. */
    concession: { stubborn: 0.2, flexible: 0.45, desperate: 0.42, proud: 0.25 },
    /** Concession grows by this much per round already played (they tire). */
    concessionPerRound: 0.05,
    /** Chance to accept an offer that is at or above the floor but under the ask. */
    acceptBase: { stubborn: 0.12, flexible: 0.45, desperate: 0.5, proud: 0.22 },
    /** Added to the accept chance per round already played. */
    acceptPerRound: 0.1,
    /** Added × (offer − floor) / (ask − floor): offers nearer the ask land more often. */
    acceptCloseness: 0.3,
    /** Added × desperation. */
    acceptDesperation: 0.15,
    /** Irritation added by every counter, by temperament. */
    irritationPerRound: { stubborn: 0.08, flexible: 0.04, desperate: 0.03, proud: 0.1 },
    /** Extra irritation × how far the offer falls under gapGrace of the ask. */
    gapIrritation: 0.3,
    gapGrace: 0.6,
    /** Irritation at which a counter carries a warning line. */
    warnIrritation: 0.75,

    // --- insults ---
    insultIrritation: { stubborn: 0.35, flexible: 0.25, desperate: 0.15, proud: 0.6 },
    /** Chance a proud seller walks out on an insult even before irritation hits 1. */
    proudInsultWalkChance: 0.5,

    // --- Evidence ---
    /** Strong evidence (negative, reveals authenticity/condition): floor × (1 − drop). */
    evidenceDrop: 0.08,
    /** Extra drop × knowledge (they know you're right). */
    evidenceKnowledgeDrop: 0.08,
    /** Extra drop when the finding reveals authenticity and the item really isn't genuine. */
    evidenceFakeDrop: 0.25,
    /** …plus this × knowledge (a knowing faker caught out folds hard). */
    evidenceFakeKnowledgeDrop: 0.2,
    /** The ask drops by drop × this. */
    evidenceAskFactor: 1.3,
    /** Proud sellers bristle at being corrected even when you're right. */
    evidenceProudIrritation: 0.1,
    /** Weak evidence (negative, reveals provenance or nothing): this share of a strong drop. */
    evidenceWeakFactor: 0.4,
    evidenceWeakIrritation: 0.12,
    /** Citing a positive/neutral/missing finding. */
    evidenceBackfireIrritation: 0.25,
    /** Backfire firms the floor by this share (capped at the ask). */
    evidenceBackfireFloorRise: 0.04,
    /** Citing a finding you already used. */
    evidenceRepeatIrritation: 0.08,

    // --- Sympathy ---
    /** Irritation change when sympathy lands (proud, desperate). */
    sympathyIrritation: -0.15,
    /** Concession multiplier when sympathy lands. */
    sympathyConcession: 1.4,
    /** Accept-chance bonus when sympathy lands. */
    sympathyAccept: 0.2,
    /** The margin it costs: floor × (1 + this), first use only. */
    sympathyFloorRise: 0.07,
    /** Irritation change when sympathy falls flat, by temperament. */
    sympathyFlatIrritation: { stubborn: 0.06, flexible: 0 },

    // --- Walk (threaten to pass) ---
    /** Floor × (1 − this × (0.5 + desperation)), by temperament; halves with each repeat. */
    threatFloorDrop: { stubborn: 0, flexible: 0.05, desperate: 0.14, proud: 0 },
    /** Concession multiplier when the threat works. */
    threatConcession: 1.5,
    /** Accept-chance bonus when the threat works. */
    threatAccept: 0.15,
    /** Irritation added, by temperament. */
    threatIrritation: { stubborn: 0.1, flexible: 0.06, desperate: 0.02, proud: 0.35 },
    /** Chance a proud seller tells you to go ahead and pass. */
    proudThreatWalkChance: 0.3,
    /** Chance a stubborn seller calls your bluff on a lowball threat (offer under floor). */
    stubbornThreatWalkChance: 0.15,
  },

  economy: {},

  /** M2 display (owner: shop worker). Slot counts per GDD § 6. */
  shop: {
    slots: { counter: 6, wall: 12, back: 20 },
    /** How often walk-in buyers notice an item in each area (× the economy worker's visibilityBonus). */
    visibility: { counter: 1, wall: 0.6, back: 0.3 },
    /** Highest tag the price pad accepts, rubles. */
    maxTag: 9_999_999,
    /** Quick multiples of what you paid on the price pad. */
    tagChips: [1.5, 2, 3] as readonly number[],
  },

  /** M2 walk-in buyers and the sale haggle (owner: shop worker). */
  sell: {
    // --- who comes in (planBuyers) ---
    /**
     * Daily chance a fairly priced item (tag = trueValue) in the counter case draws a buyer, at normal demand and reputation.
     * Tuned with `npm run sim` (M2): 0.28 puts the careful policy at ~18%/month over 60 and 90 days (target ~15%).
     */
    baseChance: 0.28,
    /** Tag under value: chance × (1 + underBoost × (1 − tag/value)), capped at maxUnderBoost. */
    underBoost: 2.5,
    maxUnderBoost: 1.8,
    /** Tag over value: chance × exp(−overDecay × (tag/value − 1)). 1.3× value ≈ ½ the buyers, 2× ≈ ⅛. */
    overDecay: 2.2,
    /** No item draws a buyer more often than this per day. */
    maxChance: 0.85,
    /** Reputation: chance × (1 + general × repPerPoint), clamped to repClamp. */
    repPerPoint: 0.01,
    repClamp: [0.6, 1.4] as [number, number],
    /** Most walk-in buyers per day (GDD: the shop is a small place). */
    maxBuyersPerDay: 4,
    /** In-game seconds a buyer waits in the queue, [min, max]. Browsers are less patient than sellers. */
    patience: [120, 220] as [number, number],

    // --- what they will pay (startSale) ---
    /** ± spread of a buyer's sense of value at knowledge 0 (shrinks to 0 at knowledge 1). */
    perceptionNoise: 0.25,
    /** Share of the gap (claimed − true value) a naive buyer is fooled into paying for a fake: × (1 − knowledge). */
    fakeFooled: 0.35,
    /** How much they want it today: perceived × a draw in this range (+ temperament premium). */
    valuation: [0.88, 1.12] as [number, number], // M2 sim pass: was 0.92–1.18
    premium: { stubborn: -0.04, flexible: 0, desperate: 0.08, proud: 0.05 },
    /** A tag above their value pulls naive buyers up: × (1 + tagAnchor × (1 − knowledge) × (tag/perceived − 1)). */
    tagAnchor: 0.45,
    /** Opening offer = ceiling × openShare (never above tag × openTagCap). */
    openShare: { stubborn: 0.76, flexible: 0.84, desperate: 0.9, proud: 0.9 },
    openTagCap: 0.95,
    /** Rounds each temperament gives you (capped by maxRounds). Proud buyers don't haggle long. */
    roundsByTemperament: { stubborn: 3, flexible: 4, desperate: 4, proud: 2 },
    maxRounds: 4,

    // --- per round (saleRound) ---
    /** Chance to take a counter that is within their ceiling, before the final round (where it is certain). */
    acceptBase: { stubborn: 0.25, flexible: 0.5, desperate: 0.6, proud: 0.45 },
    acceptPerRound: 0.12,
    /** Added × how far the counter sits under their ceiling (relative to the gap from their offer). */
    acceptRoom: 0.3,
    /** Share of the gap (your counter − their offer) a raise covers. */
    raise: { stubborn: 0.25, flexible: 0.5, desperate: 0.55, proud: 0.4 },
    raisePerRound: 0.05,
    /** Counter above their ceiling: walk chance = overshootWalk × (counter/ceiling − 1). */
    overshootWalk: 0.8,
    /** Holding firm = not coming down from your last counter (or opening at ≥ firmTagShare of the tag). */
    firmTagShare: 0.97,
    /** Firm, by temperament: raise multiplier, accept bonus (within ceiling), walk chance (above ceiling). */
    firmRaise: { stubborn: 0.6, flexible: 1.2, desperate: 1.5, proud: 1 },
    firmAccept: { stubborn: -0.1, flexible: 0.1, desperate: 0.2, proud: 0.25 },
    firmWalk: { stubborn: 0.35, flexible: 0.08, desperate: 0.03, proud: 0.45 },
    /** Tidy prices: round to `big` at or above `bigFrom` ₽, else to `small`. */
    roundTo: { bigFrom: 2_000, big: 100, small: 10 },
  },

  /** M2 pawn loans (owner: loans worker). */
  loans: {
    /** Loan amount a pawner hopes for, as a share of what they'd ask to sell. */
    askFactor: 0.6,
    termDays: 30,
    /** Interest per 30 days (GDD: ~10%/month). */
    monthlyRate: 0.1,
    /** Interest is prorated by days held, but never less than this many days' worth. */
    minInterestDays: 7,
    /** Amounts due are rounded up to this many rubles. */
    roundTo: 10,
    /** Days after dueDay the item is still held before it is forfeited. */
    graceDays: 3,

    // --- who pawns (generateDayQueue) ---
    /** Chance a seller wants a loan instead of a sale: base + desperation × perDesperation (+ heirloom). */
    pawnChance: { base: 0.12, perDesperation: 0.3, heirloom: 0.3, max: 0.75 },

    // --- will they come back (createLoan) ---
    /** Redeem chance before adjustments. */
    redeemBase: 0.75,
    /** Added when the item is an heirloom (sentiment brings people back). */
    redeemHeirloom: 0.22,
    /** Added for proud customers (family honour). */
    redeemProud: 0.08,
    /** Subtracted × desperation (some people never get back on their feet). */
    redeemDesperation: 0.3,
    /** Multiplies the chance by authenticity: someone pawning a fake rarely comes back. */
    redeemAuthenticity: { genuine: 1, restored: 0.9, frankenstein: 0.45, fake: 0.2 },
    /** Lent more than this share of trueValue: × overLentFactor (why repay more than it's worth?). */
    overLentRatio: 0.9,
    overLentFactor: 0.5,
    redeemMin: 0.03,
    redeemMax: 0.95,
    /** Earliest redemption, in days after the loan starts (latest is dueDay). */
    minRedeemDays: 3,
    /** In-game seconds a redeeming customer will wait in the queue, [min, max]. */
    redeemPatience: [320, 480] as [number, number],
  },

  /** M2 rent, bills, upgrades, specialists (owner: economy worker). */
  /**
   * Monthly bills, charged at the close of the last day of each calendar month
   * (the career opens on 3 March 2014, so the first bills land on day 29).
   *
   * Reasoning (first pass; the simulator worker retunes): a small ground-floor
   * shop on a canal in a big Russian city ran ~25–40k ₽/month in 2014. Rent +
   * utilities = 34,500 ₽ ≈ 43% of the 80,000 ₽ start, so a shop that only breaks
   * even on deals is visibly sinking by the second bill, while ~1,200 ₽/day of
   * margin covers it. The M2 target (careful +15%/month after bills) then needs
   * ~46k ₽/month of trading profit on ~80–100k of working capital: a couple of
   * good buys a week at 40–60% of value. A careless player who overpays on fakes
   * loses far more than rent; rent just takes away the cushion.
   */
  expenses: {
    rent: 38_000, // M2 sim pass: was 30,000
    /** Electricity, heating, water, phone line. */
    utilities: 5_500, // M2 sim pass: was 4,500
  },

  /**
   * Upgrades bought from the office while closed (definitions in src/data/upgrades.ts).
   * Costs are sized against a ~1.2k ₽/day margin: the acid kit pays for itself
   * with one avoided plated ring (~10k ₽), the case and the catalogue are
   * month-two purchases.
   */
  upgrades: {
    cost: {
      acid_kit: 3_500,
      reference_2: 6_000,
      reference_3: 15_000,
      case_counter: 18_000,
      // M4 security (theft numbers in tuning.theft): a mirror is a week of small margin,
      // the wall case and the camera are month-two purchases like the counter case.
      door_chime: 1_200,
      convex_mirror: 2_500,
      wall_case: 14_000,
      camera: 22_000,
    },
    /** Security points (see tuning.theft.perSecurity): chime 0.5 (×0.85 theft), mirror 1 (×0.74), camera 3 (×0.49). */
    security: { door_chime: 0.5, convex_mirror: 1, camera: 3 },
    /** Lockable wall case: thieves can't reach the wall; buyers have to ask, so wall visibility × this. */
    wallCaseVisibility: 0.9,
    /** Tests in a new acid kit. */
    acidKitCharges: 10,
    /** Restock: price and tests per bottle; charges never exceed acidMaxCharges. */
    acidRestockCost: 1_500,
    acidRestockCharges: 10,
    acidMaxCharges: 30,
    /** Better counter case: counter-area buyer visibility × this; security +securityGain. */
    caseCounterVisibility: 1.3,
    caseCounterSecurity: 1,
    /**
     * Reference book by tier (index 0 = tier 1, the basic book everyone starts with).
     * The book quotes def.baseValue's midpoint, shifted by up to ±centreError
     * (a fixed per-def misprint, the same every time you look) and widened to
     * ±halfWidth around it.
     */
    reference: {
      halfWidth: [0.35, 0.22, 0.12] as readonly number[],
      centreError: [0.12, 0.06, 0.02] as readonly number[],
    },
  },

  /**
   * Specialists on retainer (definitions and lines in src/data/specialists.ts).
   * A call within the allowance costs fee / calls ≈ 450–2,250 ₽ (the electronics
   * tech is cheap, the antiques dealer dear), so a call is worth it on items over
   * ~15k ₽ where a mistake costs 10k+. A call takes inspect.toolSeconds.specialist
   * unless the roster entry sets its own callSeconds.
   */
  specialists: {
    roster: {
      /** Sharp and accurate, but she'd like your best gold for herself. */
      jeweler: { fee: 6_000, calls: 6, perCall: 1_500, accuracy: 0.88, honesty: 0.55 },
      /** Honest to a fault; his eyes are going. */
      watchmaker: { fee: 7_500, calls: 5, perCall: 2_000, accuracy: 0.74, honesty: 0.95 },
      /** M4. Straight and sure on medals; wants first refusal, but rarely shades a price to get it. */
      collector: { fee: 5_500, calls: 5, perCall: 1_500, accuracy: 0.85, honesty: 0.9 },
      /** M4. Almost never wrong, and the least honest of them all: the good pieces "aren't worth much". */
      antiquary: { fee: 9_000, calls: 4, perCall: 2_500, accuracy: 0.93, honesty: 0.35 },
      /** M4. Cheap, quick on the phone (callSeconds), and a bit careless. */
      technician: { fee: 3_500, calls: 8, perCall: 800, accuracy: 0.72, honesty: 0.8, callSeconds: 30 },
    } as Record<string, { fee: number; calls: number; perCall: number; accuracy: number; honesty: number; callSeconds?: number }>,
    /** Relationship on first retaining; + perMonth at each month-end paid in full (cap 1). */
    relationshipStart: 0.1,
    relationshipPerMonth: 0.15,
    /** Lost on release (the relationship cools, it doesn't reset). */
    releaseRelationshipLoss: 0.3,
    /** Accuracy + relationship × this (capped at maxAccuracy). */
    relationshipAccuracy: 0.1,
    maxAccuracy: 0.97,
    /** Chance of the wrong verdict = (1 − accuracy) × this. */
    wrongVerdictFactor: 0.6,
    /** Value estimate error: ± (1 − accuracy) × this of the value. */
    valueNoise: 0.35,
    /** Quoted range = estimate ± this share. */
    rangeHalfWidth: 0.12,
    /** A specialist who doubts a sound piece values it at value × this. */
    doubtValueFactor: 0.6,
    /** Lowball: genuine items worth at least minValue; chance = (1 − honesty) × chance; value × factor range. */
    lowballMinValue: 15_000,
    lowballChance: 0.6,
    lowballFactor: [0.5, 0.7] as [number, number],
  },

  /**
   * M4 specialists' small arcs (GDD § 2b; the arcs are src/data/stories/<first name>.ts).
   * Beats name these presets; no arc file carries a specialist number of its own.
   */
  specialistArcs: {
    /** "Retained N months" = retainers paid in full since sinceDay, and at least N × monthDays days on retainer. */
    monthDays: 30,
    /** A sound call on a "piece worth ≥ 15k" (Gennady's first beat): genuine, called sound, worth at least this. */
    bigValue: 15_000,
    /** Accuracy drift (Ilya's eyes) never takes anyone below this. */
    minAccuracy: 0.5,
    /** Gennady's first-refusal call that evening: he offers true value × this (his mid-range price, take it or leave it). */
    firstRefusalShare: 0.85,
    /**
     * Named changes a beat applies with { do: 'specialist', id, change }. Fields:
     * relationship (added, 0–1), accuracy (added for good), resetAccuracy (back to the roster's, drift stops),
     * lowball (× their lowball chance), driftPerMonth (accuracy added at each month end on retainer),
     * callSeconds ('standard' = inspect.toolSeconds.specialist) or callSecondsScale, freeMonths (next retainers free),
     * freeCalls (extra calls each month), firstRefusal, referral (one buyer a month for these categories),
     * sellBoost (buyer chance × factor for these categories while retained), rentIn (₽ a month to you while retained),
     * release 'gentle' (no relationship loss), retire (released for good), cash (one-off, ledger text from the beat).
     */
    changes: {
      /** Faina 2: you rang and said you noticed; she cools, and stops shading your prices so much. */
      'faina.noticed': { relationship: -0.2, lowball: 0.5 },
      /** Faina 2: you said nothing; she sends you a gold buyer once a month. */
      'faina.quiet': { referral: ['gold'] },
      /** Faina 4: her customer book. */
      'faina.book': { cash: -20_000, sellBoost: { categories: ['gold'], factor: 1.3 } },
      'faina.retire': { retire: true },
      /** Ilya 2: you keep him on; his eyes slip each month until the operation. */
      'ilya.keep': { relationship: 0.2, driftPerMonth: -0.02 },
      'ilya.let_go': { release: 'gentle' },
      'ilya.busy': { relationship: -0.1 },
      /** Ilya 4: you advance him the money for the operation (the slipping stops). */
      'ilya.advance': { cash: -25_000, driftPerMonth: 0 },
      /** Ilya, weeks after the operation: eyes as they were, and a call a month on the house. */
      'ilya.restored': { resetAccuracy: true, freeCalls: 1 },
      /** Ilya 4, refused: he works on, worse each month. */
      'ilya.worse': { driftPerMonth: -0.03 },
      'ilya.retire': { retire: true },
      'gennady.grant': { firstRefusal: true },
      'gennady.refuse': { relationship: -0.1 },
      'gennady.family': { relationship: 0.2 },
      'gennady.market': { firstRefusal: false },
      'stanislav.turned_away': { relationship: -0.15 },
      'zhenya.free_month': { freeMonths: 1 },
      /** Zhenya 2: slower, as long as anyone's call, and right more often for good. */
      'zhenya.slow_down': { callSeconds: 'standard', accuracy: 0.08 },
      /** Zhenya 4, yes: a repair desk in your corner. */
      'zhenya.desk': { rentIn: 4_000, sellBoost: { categories: ['phones', 'electronics'], factor: 1.25 }, callSeconds: 15 },
      /** Zhenya 4, no: she moves across the river. */
      'zhenya.across_river': { callSecondsScale: 1.5 },
    } as Readonly<Record<string, SpecialistChange>>,
    /**
     * "Turn up more for two weeks" ({ do: 'boost', boost }): for `days` from the beat, each walk-in
     * who came to sell (not pawn) brings one of `defs` instead, with this chance (seeded, own stream).
     */
    boosts: {
      /** Faina 3: a real 585 clasp soldered onto a plated rope; the clasp is a different colour. */
      plated_chains: { days: 14, chance: 0.1, defs: ['gold_rope_chain_585'], authenticity: 'frankenstein', fakeProfileId: 'clasp_swap', provenance: 'unknown' },
      /** Gennady 3: cast Orders of the Red Star with pressed numbers. */
      cast_orders: { days: 14, chance: 0.08, defs: ['order_red_star'], authenticity: 'fake', fakeProfileId: 'cast_copy', provenance: 'unknown' },
      /** Zhenya 3: good phones off the back of a lorry (stolen; Heat reads provenance in M5). */
      lorry_phones: { days: 14, chance: 0.1, defs: ['phone_mangosteen_m5', 'phone_galaxia_nota3', 'phone_galaxia_stella4'], authenticity: 'genuine', provenance: 'stolen', story: 'lorry_phones' },
    } as Readonly<Record<string, SpecialistBoost>>,
    /**
     * A specialist buys from your stock ({ do: 'sellTo', id, offer }): which items and at what share of true value.
     * dead = not genuine or condition ≤ deadCondition; best = the most valuable genuine one.
     */
    offers: {
      /** Zhenya 1: your dead phones, for parts, at a fair parts price. */
      'zhenya.parts': { categories: ['phones'], pick: 'dead', share: 0.9, min: 300, deadCondition: 40 },
      /** Gennady 4: the medal he wants back for a family, below market. */
      'gennady.family': { categories: ['militaria'], pick: 'best', share: 0.6, min: 500 },
    } as Readonly<Record<string, SpecialistOffer>>,
  },

  /** M2 seasonal demand, market drift, news, career-start stock (owner: content worker). */
  demand: {
    /**
     * Season multiplier per demandTag (GDD § 7). Missing tag or season = 1.
     * Cameras peak with the tourists and white nights, electronics before the school year,
     * laptops before term starts, gold and watches over the New Year gift season.
     */
    seasons: {
      gold: { winter: 1.05, spring: 1, summer: 1.05, autumn: 0.95 },
      jewelry: { winter: 1.1, spring: 1.05, summer: 1, autumn: 0.9 },
      watches: { winter: 1.1, spring: 0.95, summer: 0.95, autumn: 1 },
      luxury: { winter: 1.1, spring: 1, summer: 1.05, autumn: 0.9 },
      soviet: { winter: 0.9, spring: 1.05, summer: 1.15, autumn: 0.95 },
      militaria: { winter: 0.9, spring: 1.1, summer: 1.05, autumn: 0.95 },
      electronics: { winter: 1.05, spring: 0.95, summer: 0.9, autumn: 1.1 },
      phones: { winter: 1.05, spring: 0.95, summer: 0.9, autumn: 1.1 },
      /** Students: buy before term, sell (or pawn) in the dead summer months. */
      laptops: { winter: 1, spring: 1, summer: 0.85, autumn: 1.15 },
      cameras: { winter: 0.85, spring: 1.05, summer: 1.2, autumn: 0.9 },
      coins: { winter: 1.05, spring: 1, summer: 0.95, autumn: 1 },
      silver: { winter: 1, spring: 1, summer: 1, autumn: 1 },
    } as Readonly<Record<string, Readonly<Partial<Record<'winter' | 'spring' | 'summer' | 'autumn', number>>>>>,
    /**
     * Holidays as date windows (MM-DD, inclusive; a window may wrap the year end) that
     * multiply demand for some tags. Overlapping boosts multiply. Women's Day lands in the
     * first week (the career starts 3 March).
     */
    holidays: [
      { id: 'new_year', from: '12-10', to: '01-07', boost: { gold: 1.2, jewelry: 1.25, watches: 1.25, luxury: 1.15, phones: 1.2, electronics: 1.15, laptops: 1.1, cameras: 1.1 } },
      { id: 'defender_day', from: '02-16', to: '02-23', boost: { watches: 1.15, militaria: 1.1 } },
      { id: 'womens_day', from: '02-28', to: '03-08', boost: { jewelry: 1.35, gold: 1.2, watches: 1.05 } },
      { id: 'victory_day', from: '04-25', to: '05-10', boost: { militaria: 1.45, soviet: 1.15 } },
      { id: 'white_nights', from: '06-01', to: '07-10', boost: { cameras: 1.2, soviet: 1.1 } },
      { id: 'school_start', from: '08-15', to: '09-05', boost: { phones: 1.3, electronics: 1.25, laptops: 1.35 } },
    ] as readonly { id: string; from: string; to: string; boost: Readonly<Record<string, number>> }[],
    /** Per-tag random walk, stepped once a day at day open: d += U(−step, step) + revert × (1 − d), clamped. */
    drift: { step: 0.025, revert: 0.05, min: 0.8, max: 1.25 },
    /**
     * Occasional market shocks: on a day one fires (chance `shockChance`, then picked by
     * weight), its deltas are added to the drift (then clamped) and the paper reports it.
     */
    shockChance: 0.12,
    shocks: [
      { id: 'ruble_wobble', weight: 3, delta: { gold: 0.12, coins: 0.1, watches: 0.06, luxury: 0.05, electronics: -0.04 } },
      { id: 'import_prices', weight: 2, delta: { phones: 0.1, electronics: 0.08, laptops: 0.1 } },
      { id: 'phone_launch', weight: 2, delta: { phones: -0.1 } },
      { id: 'flea_market_raid', weight: 1.5, delta: { militaria: -0.12 } },
      { id: 'collectors_fair', weight: 2, delta: { coins: 0.1, militaria: 0.06, cameras: 0.05 } },
      { id: 'film_fad', weight: 1.5, delta: { cameras: 0.12 } },
    ] as readonly { id: string; weight: number; delta: Readonly<Record<string, number>> }[],
    /** demandMultiplier (mean over an item's tags of season × holiday × drift) is clamped to this. */
    multiplier: { min: 0.6, max: 1.8 },
    news: {
      /** Weights for printing 1, 2 or 3 stories. */
      storyCountWeights: [1, 2, 1.2] as readonly number[],
      /** Chance a running holiday gets a story (always on the window's first day). */
      holidayChance: 0.7,
      /** A tag drifted at least this far from 1 can get a hint story… */
      driftHintThreshold: 0.08,
      /** …with this chance per day. */
      driftHintChance: 0.6,
    },
  },
  start: {
    /** Leftovers from the previous owner: one surely-fake piece, one decent genuine one, plus 1–3 odds and ends. */
    extraItems: [1, 3] as [number, number],
    /** The decent genuine piece is in at least this condition. */
    genuineMinCondition: 60,
    /** Attempts at rolling a forced fake/genuine before taking what came. */
    maxRolls: 30,
  },

  /**
   * M4 reputation by group (owner: reputation worker; rules in src/game/reputation.ts).
   * Every group sits in −1…1 (0 = nobody has an opinion yet). Deltas are small so a
   * reputation is built over weeks: ~25 fair deals with desperate people take the
   * neighbourhood from 0 to "warm" (0.5).
   */
  reputation: {
    min: -1,
    max: 1,
    /** "Fair" and "lowball" are judged on what the deal paid against the item's real worth (trueValue). */
    fairBuyShare: 0.5,
    fairLoanShare: 0.3,
    /** GDD § 3: under ~25% of value is a lowball. */
    lowballBuyShare: 0.25,
    lowballLoanShare: 0.12,
    /** Who counts as vulnerable: desperation at or above this, or one of these archetypes. */
    vulnerableDesperation: 0.65,
    vulnerableArchetypes: ['pensioner'] as readonly string[],
    /** Archetypes the local kids and students hear about. */
    youthArchetypes: ['student'] as readonly string[],
    neighbourhood: {
      /** A fair buy or loan for a vulnerable seller (genuine or restored items only: a fake's worth says nothing about fairness). */
      fair: 0.02,
      /** Lowballing a vulnerable seller. */
      lowball: -0.03,
      /** Any offer that insults (haggle mood 'insulted'). */
      insult: -0.02,
      /**
       * Someone gave up waiting in the queue. Small: a slow counter loses two or three people
       * a day, which alone drifts the street to "cool" (−0.15…−0.5) over a couple of months.
       */
      walkout: -0.004,
      /** A pawner got their thing back. */
      redeem: 0.01,
    },
    youth: {
      /** A fair buy or loan for a student. */
      fair: 0.04,
      /** Lowballing or insulting a student. */
      lowball: -0.05,
      /** A student gave up waiting. */
      walkout: -0.02,
      /** Sold something to a student. */
      sale: 0.01,
    },
    effects: {
      /** Buyer chance × (1 + neighbourhood × this). */
      buyerPerNeighbourhood: 0.15,
      /** Queue patience × (1 + neighbourhood × this). */
      patiencePerNeighbourhood: 0.2,
      /** Shoplifting chance × (1 − youth × this). */
      theftPerYouth: 0.6,
    },
    /** Ledger lines: band edges (cold | cool | neutral | warm | close) and a day's change that reads as a trend. */
    bands: [-0.5, -0.15, 0.15, 0.5] as readonly number[],
    trendDelta: 0.03,
  },

  /**
   * M4 shoplifting (owner: reputation worker; rules in src/game/shop/theft.ts). Rolled once
   * per open day at closing, per displayed item:
   *   chance = base × exposure[area] × cheapness(value) × traffic × youth factor × security factor
   * Tuned with `npm run sim` and tests/theft.test.ts: a shop with ~8 cheap things on open
   * shelves and no security loses one every 1–2 weeks; mirror + camera + wall case, rarely.
   */
  theft: {
    /** Nobody has cased a new shop yet: no thefts on days before this (the first week is for learning the counter). */
    fromDay: 8,
    base: 0.016,
    /** How exposed each area is: the counter case is behind glass, the back shelf is out of the way. */
    exposure: { counter: 0, wall: 1, back: 0.6 },
    /** Cheapness: 1 at or under cheapFull ₽ of real worth, fading linearly to 0 at cheapMax. */
    cheapFull: 4_000,
    cheapMax: 15_000,
    /** Foot traffic = people through the door today / trafficBaseline, clamped. */
    trafficBaseline: 10,
    traffic: [0.5, 1.5] as [number, number],
    /** Security factor = 1 / (1 + shop.security × perSecurity). */
    perSecurity: 0.35,
    /** No item is ever more likely than this to go in one night. */
    maxChance: 0.25,
  },

  /**
   * M4 Protection arc, first half (src/data/stories/protection.ts; the charge is in
   * src/game/economy/expenses.ts). Pressure is the hidden mob dial (GDD § 8): 0 = they
   * haven't noticed you; M5 builds the escalation ladder on it.
   */
  protection: {
    /** "Insurance": this share of the calendar month's takings (everything sold), charged with the rent. */
    share: 0.1,
    /** The rate if you talked them down when they made the offer. */
    haggledShare: 0.08,
    /** Never less than this a month, however slow the month was. */
    minimum: 4_000,
    /** Refusing: the locksmith after someone glues the door lock. */
    locksmith: 2_800,
    /** Pressure moved by each beat and choice (unbounded; 0 = unnoticed). */
    pressure: { asked: 0.05, accepted: -0.05, refused: 0.2, glueRefused: 0.15, gluePolice: 0.2, gluePaid: -0.1, bakery: 0.1 },
    /** Standing with the mob group. */
    rep: { accepted: 0.15, haggled: 0.05, refused: -0.1, gluePaid: 0.05, gluePolice: -0.15, glueRefused: -0.1 },
  },

  /**
   * M5 ending axes (src/game/endings/axes.ts, GDD § 12). Signed weights; the unit is one
   * story choice. Clean ↔ dirty: stolen goods, bribes, the fence, protection. Heart ↔
   * hustle: fair offers to people who needed them, loans, regulars helped or burned.
   */
  axes: {
    /** A story choice stored as a heart.* flag. */
    storyHeart: 1,
    /** A story choice stored as a dirty.* flag (on the clean axis). */
    storyDirty: -1,
    /** A fair buy or loan for a vulnerable seller (the same test as the neighbourhood's, src/game/reputation.ts). */
    fairDeal: 0.25,
    /** Lowballing a vulnerable seller. */
    lowball: -0.35,
    /** Buying, or lending on, a piece that turns out to be stolen, known or not. */
    stolenBought: -0.5,
    /** Any deal with the fence, either way (src/game/crime/fence.ts); on top of stolenBought for a stolen piece. */
    fenceDeal: -0.3,
  },

  /**
   * M5 the fence (src/game/crime/fence.ts, src/data/fence.ts, the arc src/data/stories/fence.ts;
   * GDD § 8): Venya Mostovoy sells you suspicious goods cheap and buys your problem pieces.
   * Contacts are planned from the career seed (never the game Rng). fenceTrust is −1…1.
   */
  fence: {
    /** The meeting beat (fence.meet): from this day, this chance per morning. */
    meetDay: 12,
    meetChance: 0.35,
    /** Days from one contact to the next [min, max] (seeded). */
    every: [6, 10] as [number, number],
    /** Each refusal on record stretches that gap by this share, up to maxStretch ×. */
    refusalStretch: 0.3,
    maxStretch: 3,
    /** Trust above 0 shortens it: × (1 − trustShorten × trust). */
    trustShorten: 0.3,
    /** A contact is a phone call to buy one of your problem pieces with this chance, when you hold one. */
    buyCallChance: 0.6,
    /**
     * Selling to you: his price as a share of what the piece would fetch if genuine (appraise
     * claimedValue), + perRefusal per refusal on record, + perTrust × trust, clamped. Tidied.
     */
    ask: { base: 0.35, perRefusal: 0.04, perTrust: -0.1, min: 0.25, max: 0.6 },
    /** His floor as a share of his price (he barely moves), and haggle rounds before his answer is final. */
    floorShare: 0.9,
    rounds: 2,
    /** Buying from you: his offer as a share of the piece's real worth, same shape. */
    offer: { base: 0.35, perRefusal: -0.03, perTrust: 0.1, min: 0.15, max: 0.5 },
    /** What he brings (by weight): portable, mid-value pieces. */
    goods: [
      { defId: 'gold_band_583', weight: 2 },
      { defId: 'gold_signet_583', weight: 2 },
      { defId: 'gold_rope_chain_585', weight: 2 },
      { defId: 'gold_bracelet_585', weight: 1 },
      { defId: 'gold_earrings_583', weight: 1 },
      { defId: 'camera_kanon_ae2', weight: 2 },
      { defId: 'phone_mangosteen_m5', weight: 2 },
      { defId: 'phone_galaxia_nota3', weight: 2 },
      { defId: 'laptop_tosaki_orbita_c40', weight: 1 },
      { defId: 'watch_vostok_komandirskie', weight: 1 },
      { defId: 'watch_poljot_strela', weight: 1 },
      { defId: 'watch_pobeda_gold', weight: 0.5 },
      { defId: 'coin_chervonets_sower', weight: 1 },
    ],
    /** Provenance of his goods: stolen with this chance, otherwise unknown. */
    stolenChance: 0.7,
    /** He slips you a fake or a mixed-up piece with this chance, more often the more you've refused him. */
    fakeChance: { base: 0.04, perRefusal: 0.04, max: 0.25 },
    condition: [55, 92] as [number, number],
    /** fenceTrust per deal and per refusal. */
    trust: { deal: 0.08, refusal: -0.05 },
    /** Heat per deal (addHeat; what heat does is the police's). */
    heat: { bought: 0.06, sold: 0.03 },
    /** Mob standing per deal: the crew notices who trades in what. */
    mobRep: { deal: 0.01 },
    /** Lines: warm from this trust; sore once refusals reach soreAt and outnumber deals. */
    warmAt: 0.3,
    soreAt: 3,
    /** Story beats: the notebook call after this many refusals; the standing offer after these deals and trust. */
    notebookAt: 3,
    standing: { deals: 4, trust: 0.3, heat: 0.03, mobRep: 0.03 },
    /**
     * Named changes the fence arc's choices make (story effect { do: 'fence' }): met, a trust
     * delta, a refusal on record, and the next contact in [min, max] days.
     */
    changes: {
      meet_yes: { met: true, trust: 0.1 },
      meet_no: { met: true, refusal: true },
      notebook_yes: { trust: 0.1, nextIn: [2, 4] },
      notebook_no: { refusal: true, nextIn: [30, 40] },
      standing: { trust: 0.15 },
      casual: { trust: -0.05 },
    } as Record<string, { met?: boolean; trust?: number; refusal?: boolean; nextIn?: [number, number] }>,
  },

  /** M5 endings (src/game/endings/). */
  endings: {
    /** GDD § 12: the Retire option appears in the ledger from this day. */
    retireDay: 90,
  },

  save: {
    /** Day summaries kept in full; older days are folded into career stats. */
    historyDays: 60,
    /** Longest save code (characters, after whitespace is stripped) that decoding will even try. */
    maxCodeChars: 1_000_000,
    /** Largest JSON a save code may inflate to (bytes); guards against decompression bombs. */
    maxInflatedBytes: 8_000_000,
    /** Days after the last backup (code copied or file saved) before the quiet reminder shows again. */
    backupReminderDays: 14,
  },
} as const

export type Tuning = typeof tuning
