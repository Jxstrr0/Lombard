/** M3 customer cast: data shape and who plays whom. */
import { describe, expect, it } from 'vitest'
import { CAST } from '../src/data/customers/cast'
import { archetypes, femaleFirstNames, firstNames } from '../src/data/customers/walkins'
import { castPool, genderOf, lookFor, pickLook } from '../src/game/customers/look'
import { generateDayQueue } from '../src/game/customers/walkins'
import { Rng } from '../src/game/rng'

const ids = () => {
  let n = 0
  return (prefix: string) => `${prefix}${++n}`
}

describe('cast data', () => {
  it('has unique ids and only known archetypes', () => {
    expect(new Set(CAST.map((c) => c.id)).size).toBe(CAST.length)
    const known = new Set(archetypes.map((a) => a.id))
    for (const c of CAST) expect(known.has(c.archetype), c.id).toBe(true)
  })

  it('has a man and a woman for every archetype', () => {
    for (const a of archetypes) {
      for (const g of ['m', 'f'] as const) {
        expect(CAST.some((c) => c.archetype === a.id && c.gender === g), `${a.id}/${g}`).toBe(true)
      }
    }
  })

  it('gives everyone a human walking pace for the walk clip', () => {
    for (const c of CAST) {
      expect(c.walkSpeed, c.id).toBeGreaterThan(0.6)
      expect(c.walkSpeed, c.id).toBeLessThan(1.8)
    }
  })

  it('only lists women in femaleFirstNames that are real first names', () => {
    for (const n of femaleFirstNames) expect(firstNames).toContain(n)
  })
})

describe('looks', () => {
  it('matches the name and the archetype', () => {
    expect(genderOf('Lida')).toBe('f')
    expect(genderOf('Boris')).toBe('m')
    for (const c of castPool({ name: 'Lida', archetype: 'office' })) {
      expect(c.gender).toBe('f')
      expect(c.archetype).toBe('office')
    }
  })

  it('falls back to the same gender for an unknown archetype', () => {
    const pool = castPool({ name: 'Zina', archetype: 'astronaut' })
    expect(pool.length).toBeGreaterThan(0)
    for (const c of pool) expect(c.gender).toBe('f')
  })

  it('avoids the previous look when it can', () => {
    const pool = castPool({ name: 'Boris', archetype: 'pensioner' })
    expect(pool.length).toBeGreaterThan(1)
    const first = pool[0]!.id
    for (let seed = 1; seed < 50; seed++) {
      expect(pickLook(new Rng(seed), { name: 'Boris', archetype: 'pensioner' }, first)).not.toBe(first)
    }
  })

  it('never shows the same person twice in a row in a day queue', () => {
    for (let seed = 1; seed < 30; seed++) {
      const q = generateDayQueue(new Rng(seed), 14, ids())
      for (let i = 1; i < q.length; i++) {
        const a = q[i - 1]!.customer
        const b = q[i]!.customer
        // Only possible when the pool has a single member.
        if (castPool(b).length > 1) expect(b.portraitKey).not.toBe(a.portraitKey)
        expect(lookFor(b)).toBe(b.portraitKey)
      }
    }
  })

  it('gives old saves (archetype in portraitKey) a stable, matching look', () => {
    const old = { id: 'c7', name: 'Galina', archetype: 'pensioner', portraitKey: 'pensioner' }
    const look = lookFor(old)
    expect(look).toBe(lookFor(old))
    expect(CAST.find((c) => c.id === look)).toMatchObject({ gender: 'f', archetype: 'pensioner' })
  })
})
