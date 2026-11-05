/**
 * All gameplay numbers live here. Never inline them in src/game.
 * One section per system; each system's owner edits only its own section.
 */
export const tuning = {
  career: {
    startingCash: 80_000,
    startDate: '2014-03-03',
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
  },

  inspect: {
    /** In-game seconds per tool use (GDD § Inspection). */
    toolSeconds: { loupe: 10, scale: 8, magnet: 4, uv: 12, acid: 20, reference: 15, phone: 20, specialist: 60 },
    /** Miss chance on a tell = difficulty × this. */
    missFactor: 0.8,
    /** Each repeat use of the same tool lowers the miss chance by this factor. */
    repeatMissDecay: 0.6,
    /** Scale reading noise, ± grams as a fraction of expected weight. */
    scaleNoise: 0.02,
  },

  appraise: {
    /** Condition factor at condition 0 and 100, per value curve. */
    conditionFactor: {
      linear: [0.35, 1.05] as [number, number],
      collector: [0.15, 1.15] as [number, number],
    },
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
