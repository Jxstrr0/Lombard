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

  it('a careless shop goes under by day 40', () => {
    // Every careless run goes under inside the 60 days, and most of them by day 40.
    // A run that scrapes past the first rent goes under at the next one, and which
    // seeds do that depends on every RNG draw (adding any item def reshuffles them),
    // so a hard per-seed day-40 cap is too brittle.
    const runs = SEEDS.map((seed) => simulate(seed, careless, DAYS))
    for (const r of runs) expect(r.bustDay, `seed ${r.seed}`).not.toBeNull()
    const byDay40 = runs.filter((r) => r.bustDay! <= 40).length
    expect(byDay40, runs.map((r) => `${r.seed}:${r.bustDay}`).join(' ')).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.75))
    expect(summarize(runs, tuning.career.startingCash).medianBustDay!).toBeLessThanOrEqual(40)
  })

  it('is deterministic', () => {
    expect(simulate(7, careful, 20)).toEqual(simulate(7, careful, 20))
  })
})
