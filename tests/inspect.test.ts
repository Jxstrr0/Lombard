import { describe, expect, it } from 'vitest'
import { ITEM_DEFS, getItemDef } from '../src/data/items'
import { tuning } from '../src/data/tuning'
import { CONDITION_TELL, MAGNET_TELL, WEIGHT_TELL, effectiveTells, missChance, referenceRange, useTool } from '../src/game/inspect/tools'
import { generateItem } from '../src/game/items/generate'
import { Rng } from '../src/game/rng'
import type { FakeProfile, ItemDef, Tell, ToolId } from '../src/game/schema/item'
import type { Finding, ItemInstance } from '../src/game/types'

const VERDICT_WORDS = /\b(fake|genuine|real)\b/i

function makeItem(def: ItemDef, profile: FakeProfile | undefined, seed: number): ItemInstance {
  const forced: ItemDef = profile ? { ...def, fakeChance: 1, fakeProfiles: [profile] } : { ...def, fakeChance: 0 }
  return generateItem(forced, new Rng(seed), `i${seed}`)
}

interface Step {
  tool: ToolId
  hotspot?: string
}

/** Play a sequence of tool uses the way the reducer does, returning every finding. */
function inspect(def: ItemDef, item: ItemInstance, steps: Step[], seed: number): Finding[] {
  const rng = new Rng(seed)
  const findings: Finding[] = []
  const uses: Partial<Record<ToolId, number>> = {}
  for (const { tool, hotspot } of steps) {
    const n = uses[tool] ?? 0
    const r = useTool({ item, def, tool, hotspot, previous: findings, uses: n, rng })
    expect(r.seconds).toBe(tuning.inspect.toolSeconds[tool])
    expect(r.findings.length).toBeGreaterThan(0)
    findings.push(...r.findings)
    uses[tool] = n + 1
  }
  return findings
}

/** A thorough inspection: general loupe passes, every hotspot, scale twice, magnet twice. */
function thorough(def: ItemDef): Step[] {
  const steps: Step[] = [{ tool: 'loupe' }, { tool: 'loupe' }]
  for (const h of def.model.hotspots) steps.push({ tool: 'loupe', hotspot: h.id }, { tool: 'loupe', hotspot: h.id })
  steps.push({ tool: 'scale' }, { tool: 'scale' }, { tool: 'magnet' }, { tool: 'magnet' })
  return steps
}

const profiles = (def: ItemDef): (FakeProfile | undefined)[] => [undefined, ...def.fakeProfiles]

describe('effectiveTells', () => {
  const base = getItemDef('gold_band_583')
  const tell = (id: string, extra: Partial<Tell> = {}): Tell => ({
    id,
    tool: 'loupe',
    finding: id,
    reveals: 'authenticity',
    polarity: 'negative',
    difficulty: 0,
    ...extra,
  })

  it('is the genuine set when there is no profile', () => {
    expect(effectiveTells(base, undefined)).toEqual(base.tells)
  })

  it('replaces same-id tells in place, appends new ones and drops removeTells', () => {
    const profile: FakeProfile = {
      id: 'p',
      kind: 'fake',
      tells: [tell('hallmark'), tell('extra')],
      removeTells: ['colour'],
      valueMultiplier: 0.1,
      weight: 1,
      weightFactor: 1,
    }
    const eff = effectiveTells(base, profile)
    const ids = eff.map((t) => t.id)
    expect(ids).not.toContain('colour')
    expect(ids[0]).toBe('hallmark')
    expect(eff[0]!.finding).toBe('hallmark')
    expect(ids[ids.length - 1]).toBe('extra')
    expect(ids.filter((i) => i === 'hallmark')).toHaveLength(1)
  })
})

describe('missChance', () => {
  const t: Tell = { id: 'x', tool: 'loupe', finding: 'x', reveals: 'authenticity', polarity: 'neutral', difficulty: 0.5 }

  it('follows difficulty × missFactor × repeatMissDecay^uses', () => {
    const { missFactor, repeatMissDecay } = tuning.inspect
    expect(missChance(t, 0, 'plain')).toBeCloseTo(0.5 * missFactor)
    expect(missChance(t, 2, 'plain')).toBeCloseTo(0.5 * missFactor * repeatMissDecay ** 2)
    expect(missChance({ ...t, difficulty: 0 }, 0, 'plain')).toBe(0)
  })

  it('aiming at the hotspot helps, a general look-over hurts', () => {
    expect(missChance(t, 0, 'focused')).toBeLessThan(missChance(t, 0, 'plain'))
    expect(missChance(t, 0, 'unfocused')).toBeGreaterThan(missChance(t, 0, 'plain'))
    expect(missChance({ ...t, difficulty: 1 }, 0, 'unfocused')).toBeLessThanOrEqual(tuning.inspect.maxMiss)
  })
})

describe('useTool', () => {
  it('gives unique finding ids and never reports the same tell twice in a visit', () => {
    for (const def of ITEM_DEFS) {
      for (const p of profiles(def)) {
        for (let s = 0; s < 10; s++) {
          const steps = [...thorough(def), ...thorough(def)]
          const f = inspect(def, makeItem(def, p, s), steps, s)
          expect(new Set(f.map((x) => x.id)).size).toBe(f.length)
          const tellIds = f.flatMap((x) => (x.tellId ? [x.tellId] : []))
          expect(new Set(tellIds).size, `${def.id}/${p?.id}`).toBe(tellIds.length)
        }
      }
    }
  })

  it('skips ids already taken on the visit', () => {
    const def = getItemDef('gold_band_583')
    const previous: Finding[] = [{ id: 'f2', tool: 'magnet', text: 'x', polarity: 'neutral' }]
    const r = useTool({ item: makeItem(def, undefined, 1), def, tool: 'loupe', previous, uses: 0, rng: new Rng(1) })
    expect(r.findings.map((f) => f.id)).not.toContain('f2')
  })

  it('says "Nothing new" (one neutral finding) once everything is found', () => {
    const def = getItemDef('gold_band_583')
    const item = makeItem(def, undefined, 2)
    const steps: Step[] = Array.from({ length: 12 }, () => ({ tool: 'loupe' as const }))
    for (const h of def.model.hotspots) steps.push({ tool: 'loupe', hotspot: h.id })
    const found = inspect(def, item, steps, 2)
    const loupeTells = def.tells.filter((t) => t.tool === 'loupe').map((t) => t.id)
    for (const id of loupeTells) expect(found.some((f) => f.tellId === id)).toBe(true)
    const r = useTool({ item, def, tool: 'loupe', previous: found, uses: 99, rng: new Rng(3) })
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]!.text).toBe('Nothing new under the loupe.')
    expect(r.findings[0]!.polarity).toBe('neutral')
    expect(r.findings[0]!.tellId).toBeUndefined()
  })

  it('copies tellId, reveals, polarity and hotspot from the tell', () => {
    const def = getItemDef('watch_rolland_abyssal')
    const profile = def.fakeProfiles.find((p) => p.id === 'cheap_copy')!
    const item = makeItem(def, profile, 4)
    const f = inspect(def, item, thorough(def), 4)
    const ticking = f.find((x) => x.tellId === 'seconds')!
    expect(ticking).toBeDefined()
    expect(ticking.reveals).toBe('authenticity')
    expect(ticking.polarity).toBe('negative')
    expect(ticking.hotspot).toBe('dial')
    expect(ticking.tool).toBe('loupe')
  })

  it('never phrases a finding as a verdict, and keeps text short', () => {
    for (const def of ITEM_DEFS) {
      for (const p of profiles(def)) {
        for (let s = 0; s < 5; s++) {
          for (const f of inspect(def, makeItem(def, p, s), thorough(def), s)) {
            expect(f.text, f.text).not.toMatch(VERDICT_WORDS)
            expect(f.text.length).toBeLessThanOrEqual(140)
          }
        }
      }
    }
  })
})

describe('loupe hotspots', () => {
  it('aimed at a hotspot, reports only tells there (plus the first-use condition note)', () => {
    for (const def of ITEM_DEFS) {
      for (const h of def.model.hotspots) {
        for (let s = 0; s < 20; s++) {
          const f = inspect(def, makeItem(def, undefined, s), [{ tool: 'loupe', hotspot: h.id }], s)
          for (const x of f) {
            if (x.tellId === CONDITION_TELL || !x.tellId) continue
            expect(x.hotspot, `${def.id}@${h.id}: ${x.tellId}`).toBe(h.id)
          }
        }
      }
    }
  })

  it('finds a hotspot tell more often when aimed at it than in a general look-over', () => {
    const def = getItemDef('gold_band_583')
    let aimed = 0
    let general = 0
    for (let s = 0; s < 1000; s++) {
      const item = makeItem(def, undefined, s)
      if (inspect(def, item, [{ tool: 'loupe', hotspot: 'inner' }], s).some((f) => f.tellId === 'hallmark')) aimed++
      if (inspect(def, item, [{ tool: 'loupe' }], s).some((f) => f.tellId === 'hallmark')) general++
    }
    expect(general).toBeGreaterThan(0)
    expect(aimed).toBeGreaterThan(general * 1.3)
  })

  it('a general look-over can still turn up hotspot tells', () => {
    const def = getItemDef('watch_rolland_abyssal')
    const item = makeItem(def, def.fakeProfiles[0], 1)
    const hits = Array.from({ length: 200 }, (_, s) => inspect(def, item, [{ tool: 'loupe' }], s)).filter((f) => f.some((x) => x.hotspot))
    expect(hits.length).toBeGreaterThan(0)
  })

  it('an unknown hotspot yields nothing new (beyond the condition note)', () => {
    const def = getItemDef('gold_band_583')
    const f = inspect(def, makeItem(def, undefined, 1), [{ tool: 'loupe' }, { tool: 'loupe', hotspot: 'nowhere' }], 1)
    expect(f[f.length - 1]!.text).toBe('Nothing new under the loupe.')
  })
})

describe('loupe condition note', () => {
  it('comes once per visit, banded by condition, negative when poor', () => {
    const def = getItemDef('phone_mangosteen_m5')
    const base = makeItem(def, undefined, 1)
    const bands = tuning.inspect.conditionBands
    const expectations: [number, Finding['polarity']][] = [
      [bands.mint, 'positive'],
      [bands.good, 'neutral'],
      [bands.worn, 'neutral'],
      [bands.worn - 1, 'negative'],
    ]
    const texts = new Set<string>()
    for (const [condition, polarity] of expectations) {
      const item = { ...base, condition }
      const f = inspect(def, item, [{ tool: 'loupe' }, { tool: 'loupe' }, { tool: 'loupe', hotspot: 'screen' }], 1)
      const notes = f.filter((x) => x.tellId === CONDITION_TELL)
      expect(notes).toHaveLength(1)
      expect(notes[0]!.reveals).toBe('condition')
      expect(notes[0]!.polarity).toBe(polarity)
      texts.add(notes[0]!.text)
    }
    expect(texts.size).toBe(4)
  })
})

describe('scale', () => {
  const readingOf = (f: Finding) => Number(/(?:Reads|Weighed again:) ([\d.]+) g/.exec(f.text)![1])

  it('quotes the expected range and repeat readings agree within noise', () => {
    for (const def of ITEM_DEFS) {
      const w = def.weightGrams!
      const item = makeItem(def, undefined, 9)
      const f = inspect(def, item, [{ tool: 'scale' }, { tool: 'scale' }, { tool: 'scale' }, { tool: 'scale' }], 9)
      const readings = f.filter((x) => x.tellId === WEIGHT_TELL || x.tellId === undefined).map(readingOf)
      expect(readings).toHaveLength(4)
      const step = w.expected < 20 ? 0.1 : 1
      const noise = tuning.inspect.scaleNoise * w.expected
      for (const r of readings) expect(Math.abs(r - item.weightGrams!), def.id).toBeLessThanOrEqual(noise + step)
      expect(Math.max(...readings) - Math.min(...readings)).toBeLessThanOrEqual(2 * noise + step)
      const first = f.find((x) => x.tellId === WEIGHT_TELL)!
      const lo = (w.expected - w.tolerance).toFixed(w.expected < 20 ? 1 : 0)
      const hi = (w.expected + w.tolerance).toFixed(w.expected < 20 ? 1 : 0)
      expect(first.text).toContain(`${lo}–${hi} g`)
      expect(f.filter((x) => x.tellId === WEIGHT_TELL)).toHaveLength(1)
    }
  })

  it('reads the example band text the way the GDD phrases it', () => {
    const def = getItemDef('gold_band_583')
    const f = inspect(def, makeItem(def, def.fakeProfiles[0], 1), [{ tool: 'scale' }], 1)
    expect(f[0]!.text).toMatch(/^Reads \d+\.\d g\. A solid band this size usually weighs 4\.4–5\.2 g\.$/)
  })

  it('is positive for genuine weights and negative for gold fakes', () => {
    for (const def of ITEM_DEFS) {
      for (let s = 0; s < 50; s++) {
        const g = inspect(def, makeItem(def, undefined, s), [{ tool: 'scale' }], s).find((x) => x.tellId === WEIGHT_TELL)!
        expect(g.polarity, def.id).toBe('positive')
        if (def.category !== 'gold') continue
        for (const p of def.fakeProfiles) {
          const f = inspect(def, makeItem(def, p, s), [{ tool: 'scale' }], s).find((x) => x.tellId === WEIGHT_TELL)!
          expect(f.polarity, `${def.id}/${p.id}`).toBe('negative')
        }
      }
    }
  })

  it('has a sensible message for an item with no reference weight', () => {
    const base = getItemDef('gold_band_583')
    const def: ItemDef = { ...base, weightGrams: undefined }
    const { weightGrams: _w, ...item } = makeItem(base, undefined, 1)
    const f = useTool({ item, def, tool: 'scale', previous: [], uses: 0, rng: new Rng(1) }).findings
    expect(f[0]!.polarity).toBe('neutral')
    expect(f[0]!.text).toMatch(/no standard weight/)
  })
})

describe('magnet', () => {
  const magnetNote = (def: ItemDef, profile: FakeProfile | undefined) =>
    inspect(def, makeItem(def, profile, 1), [{ tool: 'magnet' }], 1).find((x) => x.tellId === MAGNET_TELL)!

  it('gold that pulls is negative evidence; gold that does not is neutral', () => {
    const def = getItemDef('gold_band_583')
    expect(magnetNote(def, undefined).polarity).toBe('neutral')
    expect(magnetNote(def, undefined).text).toBe('No pull at all from the magnet.')
    const steel = def.fakeProfiles.find((p) => p.magnetic)!
    expect(magnetNote(def, steel).polarity).toBe('negative')
    expect(magnetNote(def, steel).text).toMatch(/jumps to the magnet/)
  })

  it('watch cases are judged against the def; phones and laptops are admitted to be uninformative', () => {
    const rolland = getItemDef('watch_rolland_abyssal')
    expect(magnetNote(rolland, undefined).polarity).toBe('neutral')
    expect(magnetNote(rolland, rolland.fakeProfiles.find((p) => p.magnetic)).polarity).toBe('negative')
    for (const def of ITEM_DEFS.filter((d) => d.category === 'phones' || d.category === 'electronics')) {
      for (const p of profiles(def)) {
        const n = magnetNote(def, p)
        expect(n.polarity).toBe('neutral')
        expect(n.text).toMatch(/tells you little/)
      }
    }
  })

  it('gives the pull note once per visit', () => {
    const def = getItemDef('gold_rope_chain_585')
    const f = inspect(def, makeItem(def, undefined, 1), Array.from({ length: 5 }, () => ({ tool: 'magnet' as const })), 1)
    expect(f.filter((x) => x.tellId === MAGNET_TELL)).toHaveLength(1)
    expect(f[f.length - 1]!.text).toBe('Nothing new from the magnet.')
  })
})

describe('the student\'s laptop (electronics)', () => {
  const def = getItemDef('laptop_tosaki_orbita_c40')

  it('stands upright on the counter and has a laptop condition note', () => {
    expect(def.category).toBe('electronics')
    expect(def.model.rest).toBe('upright')
    const f = inspect(def, makeItem(def, undefined, 2), [{ tool: 'loupe' }], 2)
    expect(f.find((x) => x.tellId === CONDITION_TELL)!.text).toMatch(/lid|keys|palm rest|screen/)
  })

  it('weighs light with the aftermarket battery, and right with any other profile', () => {
    for (const p of profiles(def)) {
      for (let s = 0; s < 30; s++) {
        const w = inspect(def, makeItem(def, p, s), [{ tool: 'scale' }], s).find((x) => x.tellId === WEIGHT_TELL)!
        expect(w.polarity, `${p?.id ?? 'genuine'} ${s}`).toBe(p?.id === 'aftermarket_battery' ? 'negative' : 'positive')
      }
    }
  })

  it('is missing from the old price guide and listed from the 2013 edition', () => {
    expect(referenceRange(def, 1)).toBeNull()
    const r = referenceRange(def, 2)!
    expect(r.lo).toBeLessThan(r.hi)
    expect(r.lo).toBeGreaterThan(def.baseValue.min * 0.6)
  })
})

describe('evidence', () => {
  const negativeAuth = (f: Finding[]) => f.filter((x) => x.polarity === 'negative' && x.reveals === 'authenticity')

  it('every fake profile can be caught: a thorough inspection usually turns up negative evidence', () => {
    for (const def of ITEM_DEFS) {
      for (const p of def.fakeProfiles) {
        let caught = 0
        const n = 100
        for (let s = 0; s < n; s++) if (negativeAuth(inspect(def, makeItem(def, p, s), thorough(def), s)).length > 0) caught++
        expect(caught / n, `${def.id}/${p.id}`).toBeGreaterThan(0.6)
      }
    }
    // 100 seeds for every fake profile of all 120 items: about 3 s alone, over the 5 s default on a busy CI runner
  }, 30_000)

  it('a genuine item never produces negative authenticity evidence', () => {
    for (const def of ITEM_DEFS) {
      for (let s = 0; s < 50; s++) {
        expect(negativeAuth(inspect(def, makeItem(def, undefined, s), thorough(def), s)), def.id).toEqual([])
      }
    }
  })

  it('is deterministic for a given rng state', () => {
    const def = getItemDef('phone_galaxia_stella4')
    const item = makeItem(def, def.fakeProfiles[0], 5)
    expect(inspect(def, item, thorough(def), 5)).toEqual(inspect(def, item, thorough(def), 5))
  })
})
