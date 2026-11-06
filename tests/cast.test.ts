/** M3 customer cast: data shape and who plays whom. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLLECTOR, ROOFER } from '../src/data/collector'
import { CAST } from '../src/data/customers/cast'
import { archetypes, femaleFirstNames, firstNames } from '../src/data/customers/walkins'
import { FENCE } from '../src/data/fence'
import { VOLKOVA } from '../src/data/police'
import { REGULARS } from '../src/data/regulars'
import { SPECIALISTS } from '../src/data/specialists'
import { ARCS } from '../src/data/stories'
import { castPool, genderOf, lookFor, pickLook, regularCast, walkInCast } from '../src/game/customers/look'
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

  it('has a walk-in man and woman for every archetype', () => {
    for (const a of archetypes) {
      for (const g of ['m', 'f'] as const) {
        expect(walkInCast().some((c) => c.archetype === a.id && c.gender === g), `${a.id}/${g}`).toBe(true)
      }
    }
  })

  it('gives everyone a human walking pace for the walk clip', () => {
    for (const c of CAST) {
      expect(c.walkSpeed, c.id).toBeGreaterThan(0.6)
      expect(c.walkSpeed, c.id).toBeLessThan(1.8)
    }
  })

  it('describes everyone, so regulars can be cast by description', () => {
    for (const c of CAST) expect(c.note.length, c.id).toBeGreaterThan(10)
  })

  it('keeps about twenty looks for regulars, men and women across the archetypes', () => {
    const regs = regularCast()
    expect(regs.length).toBeGreaterThanOrEqual(18)
    expect(regs.some((c) => c.gender === 'f')).toBe(true)
    expect(regs.some((c) => c.gender === 'm')).toBe(true)
    for (const a of archetypes) expect(regs.some((c) => c.archetype === a.id), a.id).toBe(true)
    // Regular looks are extra people, not a relabelled part of the walk-in cast.
    const walkInSources = new Set(walkInCast().map((c) => c.source))
    for (const c of regs) expect(walkInSources.has(c.source), c.id).toBe(false)
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

  it('never gives a walk-in a regular look', () => {
    const regular = new Set(regularCast().map((c) => c.id))
    expect(regular.size).toBeGreaterThan(0)
    for (const name of firstNames) {
      for (const a of [...archetypes.map((x) => x.id), 'astronaut']) {
        for (const c of castPool({ name, archetype: a })) expect(regular.has(c.id), `${name}/${a}: ${c.id}`).toBe(false)
        for (let seed = 1; seed < 6; seed++) expect(regular.has(pickLook(new Rng(seed), { name, archetype: a }))).toBe(false)
        // Old saves: the fallback derived from the id draws from walk-ins only.
        for (let i = 0; i < 6; i++) {
          const look = lookFor({ id: `c${i}`, name, archetype: a, portraitKey: a })
          expect(look && regular.has(look), `${name}/${a}/c${i}: ${look}`).toBe(false)
        }
      }
    }
    for (let seed = 1; seed < 30; seed++) {
      for (const v of generateDayQueue(new Rng(seed), 14, ids())) expect(regular.has(v.customer.portraitKey)).toBe(false)
    }
  })

  it('still shows a regular look when a visit names it', () => {
    const reg = regularCast()[0]!
    expect(lookFor({ id: 'r1', name: 'Boris', archetype: 'pensioner', portraitKey: reg.id })).toBe(reg.id)
  })

  it('gives every authored regular a regular-only look of their own', () => {
    // The other side of "walk-ins never get a regular look": a regular never wears a walk-in's face.
    const regularLooks = new Set(regularCast().map((c) => c.id))
    expect(REGULARS.length).toBeGreaterThan(0)
    for (const r of REGULARS) expect(regularLooks.has(r.look), `${r.id} look ${r.look}`).toBe(true)
    expect(new Set(REGULARS.map((r) => r.look)).size).toBe(REGULARS.length)
  })

  it('leaves existing walk-in looks as they were before the regular looks were added', () => {
    // Recorded on the 25-person walk-in cast (Nov 6, 2026) before any regular look existed:
    // the look streams generateWalkIn forks per customer (`look:<id>`) for seed 2026, each
    // avoiding the previous look. Names and archetypes are fixed here, so item or tuning
    // changes elsewhere don't move it.
    const picked: string[] = []
    for (let i = 0; i < 36; i++) {
      const name = firstNames[(i * 5 + 3) % firstNames.length]!
      const archetype = archetypes[(i * 7) % archetypes.length]!.id
      picked.push(pickLook(new Rng(2026).fork(`look:c${i}`), { name, archetype }, picked[i - 1]))
    }
    expect(picked.join(' ')).toBe(
      'business_male_07 male_adult_16 gardener_male_01 female_adult_05 female_adult_07 pilot_female_02 business_male_07 male_adult_18 gardener_male_01 business_female_02 female_adult_07 pilot_female_02 business_male_07 male_adult_01 delivery_male_01 female_adult_05 female_adult_07 pilot_female_02 male_adult_05 male_adult_16 wood_male_01 female_adult_05 female_adult_07 pilot_female_02 male_adult_05 male_adult_16 gardener_male_01 business_female_02 female_adult_07 pilot_female_02 male_adult_05 male_adult_01 wood_male_01 business_female_02 female_adult_07 pilot_female_02',
    )
    // Old saves (archetype in portraitKey): the look derived from the customer id.
    const old: string[] = []
    for (let i = 0; i < 24; i++) {
      const name = firstNames[(i * 7) % firstNames.length]!
      const archetype = archetypes[i % archetypes.length]!.id
      old.push(lookFor({ id: `c${i * 13 + 5}`, name, archetype, portraitKey: archetype })!)
    }
    expect(old.join(' ')).toBe(
      'male_adult_05 male_adult_18 delivery_male_01 business_female_02 female_adult_07 male_adult_13 male_adult_03 female_adult_03 female_adult_04 male_adult_08 male_adult_04 pilot_female_02 female_adult_02 male_adult_16 gardener_male_01 business_male_02 female_adult_07 pilot_female_02 business_male_07 male_adult_18 female_adult_04 female_adult_05 male_adult_07 male_adult_13',
    )
  })

  it('gives old saves (archetype in portraitKey) a stable, matching look', () => {
    const old = { id: 'c7', name: 'Galina', archetype: 'pensioner', portraitKey: 'pensioner' }
    const look = lookFor(old)
    expect(look).toBe(lookFor(old))
    expect(CAST.find((c) => c.id === look)).toMatchObject({ gender: 'f', archetype: 'pensioner' })
  })
})

/**
 * M6: forty regulars. The twenty new ones wear Rocketbox Adults avatars nobody else wears, or a
 * recoloured variant of a regular's own avatar (`<base>_b`, cast as that regular's relative). No
 * Business_* or profession avatar is used for them (another M6 task needs those). And nobody with
 * a name shares a face: regulars, specialists, the fence, Volkova, the Collector, his roofer and
 * every one-off stranger an arc sends in.
 */
describe('M6 looks', () => {
  const M6 = ['artur', 'bakhtiyor', 'dilnoza', 'jamshid', 'patimat', 'snezhana', 'kira', 'alyona', 'grisha', 'vitya', 'prokhor', 'zakhar', 'ernest', 'styopa', 'klava', 'elvira', 'zhanna', 'nonna', 'zoya', 'larisa']
  const byId = new Map(CAST.map((c) => [c.id, c]))

  it('has forty regulars, the twenty new ones in Adults avatars only', () => {
    expect(REGULARS).toHaveLength(40)
    for (const id of M6) {
      const r = REGULARS.find((x) => x.id === id)
      expect(r, id).toBeDefined()
      const look = byId.get(r!.look)!
      expect(look.source, id).toMatch(/^Assets\/Avatars\/Adults\//)
      expect(look.source, id).not.toMatch(/Business|Professions/)
    }
  })

  it('recolours every variant look, and casts it as a relative of the base look’s regular', () => {
    const build = readFileSync(path.join(path.resolve(__dirname, '..'), 'art', 'customers', 'build.py'), 'utf8')
    const variants = CAST.filter((c) => /_b$/.test(c.id))
    expect(variants.length).toBeGreaterThan(0)
    for (const v of variants) {
      const base = byId.get(v.id.slice(0, -2))
      expect(base, v.id).toBeDefined()
      expect(v.source, v.id).toBe(base!.source)
      expect(v.regular, v.id).toBe(true)
      expect(build.includes(`'${v.id}':`), `${v.id} has a PAINT_OUT recolour in build.py`).toBe(true)
      // The base is a regular's own look, so the family resemblance is with someone you know.
      expect(REGULARS.some((r) => r.look === base!.id), `${v.id}: base worn by a regular`).toBe(true)
      expect(v.note, v.id).toMatch(/relative/)
    }
  })

  it('gives everyone with a name a face of their own', () => {
    const people: [string, string][] = [
      ...REGULARS.map((r): [string, string] => [`regular ${r.id}`, r.look]),
      // (Gennady Pavlovich has no look: you only ever reach him by phone.)
      ...SPECIALISTS.flatMap((s): [string, string][] => (s.look ? [[`specialist ${s.id}`, s.look]] : [])),
      ['the fence', FENCE.look],
      ['Volkova', VOLKOVA.look],
      ['the Collector', COLLECTOR.look],
    ]
    // One-off strangers, by name (Seryozha the roofer is one, and comes in more than once).
    const strangers = new Map<string, string>([[ROOFER.name, ROOFER.look]])
    for (const arc of ARCS) for (const b of arc.beats) if (b.visit.as) strangers.set(b.visit.as.name, b.visit.as.look)
    // Volkova off duty comes in under her own name (her arc's `as`): the same person.
    strangers.delete('Alla Volkova')
    for (const [name, look] of strangers) people.push([`stranger ${name}`, look])
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const [who, look] of people) {
      expect(byId.has(look), `${who}: ${look} is in the cast`).toBe(true)
      if (seen.has(look)) clashes.push(`${who} and ${seen.get(look)} both wear ${look}`)
      seen.set(look, who)
    }
    expect(clashes).toEqual([])
  })
})
