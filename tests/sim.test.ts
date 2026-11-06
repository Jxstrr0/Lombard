/**
 * M2 done criteria (docs/03-ROADMAP.md): the simulator shows a careful policy
 * growing ~15%/month and a careless one busting by day 40. Bands are loose so
 * small tuning changes don't break the build; `npm run sim` prints the detail.
 */
import { describe, expect, it } from 'vitest'
import { tuning } from '../src/data/tuning'
import { careful, careless } from '../src/sim/policies'
import { simulate, summarize } from '../src/sim/simulate'

const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i)
const DAYS = 60

describe('economy simulator (M2 tuning)', () => {
  it('a careful shop grows roughly 15% a month and never goes under', () => {
    const s = summarize(SEEDS.map((seed) => simulate(seed, careful, DAYS)), tuning.career.startingCash)
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

  it('is deterministic', () => {
    expect(simulate(7, careful, 20)).toEqual(simulate(7, careful, 20))
  })
})
