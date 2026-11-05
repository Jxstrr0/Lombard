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
    maxRounds: 5,
    /** Below this share of trueValue an offer is an insult. */
    insultRatio: 0.25,
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
