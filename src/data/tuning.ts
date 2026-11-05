/**
 * All gameplay numbers live here. Never inline them in src/game.
 * M0 only needs the career start values; later milestones add to this file.
 */
export const tuning = {
  career: {
    startingCash: 80_000,
    startDate: '2014-03-03',
  },
} as const
