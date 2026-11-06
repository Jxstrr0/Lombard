/**
 * M2 done criteria (docs/03-ROADMAP.md): the simulator shows a careful policy
 * growing ~15%/month and a careless one busting by day 40. Bands are loose so
 * small tuning changes don't break the build; `npm run sim` prints the detail.
 *
 * M5: the careful trader refuses the crew, and the Protection ladder makes that cost
 * (the brick, the glazier; GDD § 8 "clean is slower, the mob makes it hard"). So the M2
 * band measures the trade with the ladder held off (SimOptions.protectionLadder), and the
 * refuser and the mob-friendly runs get tests of their own. See docs/05.
 */
import { describe, expect, it } from 'vitest'
import { tuning } from '../src/data/tuning'
import { careful, careless, mobFriendly } from '../src/sim/policies'
import { simulate, summarize } from '../src/sim/simulate'

const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i)
const DAYS = 60

describe('economy simulator (M2 tuning)', () => {
  it('a careful shop grows roughly 15% a month and never goes under', () => {
    // The trade alone: the Protection ladder is held off (its cost has its own test below).
    const s = summarize(SEEDS.map((seed) => simulate(seed, careful, DAYS, { protectionLadder: false })), tuning.career.startingCash)
    expect(s.busted).toBe(0)
    expect(s.medianGrowth).toBeGreaterThan(0.08)
    expect(s.medianGrowth).toBeLessThan(0.3)
  })

  // Every careless shop goes under; typically by day 40 (median). A few seeds hang on into the 40s and 50s
  // (7 in 40 on the M3 tuning), so the bound is on the median, not on every seed. See docs/05.
  it('a careless shop goes under, typically by day 40', () => {
    const runs = SEEDS.map((seed) => simulate(seed, careless, DAYS))
    for (const r of runs) expect(r.bustDay, `seed ${r.seed}`).not.toBeNull()
    const days = runs.map((r) => r.bustDay!).sort((a, b) => a - b)
    expect(days[Math.floor(days.length / 2)]).toBeLessThanOrEqual(40)
  })

  it('a careful shop that refuses the crew takes the brick, pays the glazier, and still grows', () => {
    const runs = SEEDS.map((seed) => simulate(seed, careful, DAYS))
    const s = summarize(runs, tuning.career.startingCash)
    expect(s.busted).toBe(0)
    // Measured 5.5% on these seeds with the fence in (6.4% before it; 8.9% with the ladder held off). docs/05.
    expect(s.medianGrowth).toBeGreaterThan(0.04)
    // The ladder fires: most refusers get the brick, and the glazier after it.
    const bricked = runs.filter((r) => r.crew.bricks > 0 && r.crew.glaziers > 0).length
    expect(bricked).toBeGreaterThan(SEEDS.length / 2)
    for (const r of runs) expect(r.crew.insurance, `seed ${r.seed}`).toBe(0)
  })

  it('a mob-friendly shop plays differently: pays the crew, takes their deliveries, ends dirty and noticed', () => {
    const runs = SEEDS.map((seed) => simulate(seed, mobFriendly, DAYS))
    expect(summarize(runs, tuning.career.startingCash).busted).toBe(0)
    for (const r of runs) {
      expect(r.crew.insurance, `seed ${r.seed}`).toBeGreaterThan(0)
      expect(r.crew.bricks, `seed ${r.seed}`).toBe(0)
      expect(r.axes.clean, `seed ${r.seed}`).toBeLessThan(0)
      expect(r.heat, `seed ${r.seed}`).toBeGreaterThan(0)
    }
    expect(runs.filter((r) => r.crew.deliveries > 0).length).toBeGreaterThan(SEEDS.length / 2)
  })

  it('is deterministic', () => {
    expect(simulate(7, careful, 20)).toEqual(simulate(7, careful, 20))
  })
})
