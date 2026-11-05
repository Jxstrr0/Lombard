/**
 * All gameplay numbers live here. Never inline them in src/game.
 * One section per system; each system's owner edits only its own section.
 */
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
  },

  customers: {
    /** Weights for temperament rolls. */
    temperamentWeights: { stubborn: 1, flexible: 1.4, desperate: 0.8, proud: 0.8 },
    knowledge: [0.1, 0.9] as [number, number],
    desperation: [0.05, 0.95] as [number, number],
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
    /** M1 resale: the dealer pays this share of trueValue. */
    dealerRate: 0.8,
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
  },

  /** M2 walk-in buyers and the sale haggle (owner: shop worker). */
  sell: {
    /** Buyer's opening offer as a share of your tag. */
    openFactor: 0.8,
    maxRounds: 3,
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
    rent: 30_000,
    /** Electricity, heating, water, phone line. */
    utilities: 4_500,
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
    },
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
   * A call within the allowance costs fee / calls ≈ 1,000–1,500 ₽, so a call is
   * worth it on items over ~15k ₽ where a mistake costs 10k+.
   */
  specialists: {
    roster: {
      /** Sharp and accurate, but she'd like your best gold for herself. */
      jeweler: { fee: 6_000, calls: 6, perCall: 1_500, accuracy: 0.88, honesty: 0.55 },
      /** Honest to a fault; his eyes are going. */
      watchmaker: { fee: 7_500, calls: 5, perCall: 2_000, accuracy: 0.74, honesty: 0.95 },
    } as Record<string, { fee: number; calls: number; perCall: number; accuracy: number; honesty: number }>,
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

  /** M2 seasonal demand, market drift, news, career-start stock (owner: content worker). */
  demand: {},
  start: {},

  save: {
    /** Day summaries kept in full; older days are folded into career stats. */
    historyDays: 60,
    /** Longest save code (characters, after whitespace is stripped) that decoding will even try. */
    maxCodeChars: 1_000_000,
    /** Largest JSON a save code may inflate to (bytes); guards against decompression bombs. */
    maxInflatedBytes: 8_000_000,
  },
} as const

export type Tuning = typeof tuning
