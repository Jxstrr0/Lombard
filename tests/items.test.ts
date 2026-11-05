import { describe, expect, it } from 'vitest'
import { ITEM_DEFS, RAW_ITEM_FILES, getItemDef } from '../src/data/items'
import { tuning } from '../src/data/tuning'
import { fakeProfileOf, generateItem, pickItemDef } from '../src/game/items/generate'
import { Rng } from '../src/game/rng'
import { ItemDef, M1_TOOLS, type FakeProfile, type Tell } from '../src/game/schema/item'
import type { ItemInstance } from '../src/game/types'

const VERDICT_WORDS = /\b(fake|genuine|real)\b/i
const ALLOWED_BRANDS = new Set([
  // historical Soviet makers (GDD § Brands)
  'Pobeda',
  'Vostok',
  'Poljot',
  'Zenit',
  'Helios',
  // invented
  'Rolland',
  'Omeca',
  'Brequet-Fils',
  'Mangosteen',
  'Galaxia',
  'Severin',
  'Kanon',
  'Weissler',
])
/** Categories whose items carry no maker's brand (struck by a state mint or a jeweller). */
const UNBRANDED = new Set(['gold', 'militaria', 'coins'])

function makeItem(def: ItemDef, profile: FakeProfile | undefined, seed: number): ItemInstance {
  const forced: ItemDef = profile ? { ...def, fakeChance: 1, fakeProfiles: [profile] } : { ...def, fakeChance: 0 }
  return generateItem(forced, new Rng(seed), `i${seed}`)
}

const allTells = (def: ItemDef): Tell[] => [...def.tells, ...def.fakeProfiles.flatMap((p) => p.tells)]

/** Rough half-extents (m) of each placeholder model, per the render coordinate convention. */
const HALF_EXTENTS: Record<ItemDef['model']['placeholder'], [number, number, number]> = {
  ring: [0.011, 0.011, 0.004],
  signet: [0.011, 0.013, 0.006],
  chain: [0.028, 0.028, 0.006],
  earrings: [0.02, 0.016, 0.006],
  watch: [0.024, 0.024, 0.008],
  phone: [0.031, 0.0635, 0.0045],
  pendant: [0.01, 0.021, 0.003],
  camera: [0.072, 0.066, 0.068],
  lens: [0.025, 0.025, 0.032],
  medal: [0.019, 0.04, 0.006],
  order: [0.026, 0.026, 0.014],
  badge: [0.02, 0.025, 0.011],
  coin: [0.013, 0.013, 0.0015],
}

describe('item definitions', () => {
  it('all raw defs parse against the zod schema', () => {
    for (const raw of Object.values(RAW_ITEM_FILES).flat()) {
      const r = ItemDef.safeParse(raw)
      expect(r.success, `${(raw as { id: string }).id}: ${r.success ? '' : r.error.message}`).toBe(true)
    }
  })

  it('ships 30 defs across 6 categories with unique ids', () => {
    expect(ITEM_DEFS).toHaveLength(30)
    const count = (c: string) => ITEM_DEFS.filter((d) => d.category === c).length
    expect(count('gold')).toBe(6)
    expect(count('watches')).toBe(6)
    expect(count('phones')).toBe(5)
    expect(count('cameras')).toBe(4)
    expect(count('militaria')).toBe(5)
    expect(count('coins')).toBe(4)
    expect(new Set(ITEM_DEFS.map((d) => d.id)).size).toBe(30)
    expect(getItemDef('gold_band_583').category).toBe('gold')
  })

  it('every def has genuine tells for each M1 tool and at least one fake profile', () => {
    for (const def of ITEM_DEFS) {
      for (const tool of M1_TOOLS) {
        expect(def.tells.some((t) => t.tool === tool), `${def.id} lacks a ${tool} tell`).toBe(true)
      }
      expect(def.fakeProfiles.length).toBeGreaterThanOrEqual(1)
      expect(def.weightGrams, `${def.id} has no weight`).toBeDefined()
    }
  })

  it('every tell hotspot exists in the model, and removeTells refer to genuine tells', () => {
    for (const def of ITEM_DEFS) {
      const hotspots = new Set(def.model.hotspots.map((h) => h.id))
      expect(hotspots.size).toBe(def.model.hotspots.length)
      for (const t of allTells(def)) {
        if (t.hotspot) expect(hotspots.has(t.hotspot), `${def.id}/${t.id} → ${t.hotspot}`).toBe(true)
      }
      const genuineIds = new Set(def.tells.map((t) => t.id))
      for (const p of def.fakeProfiles) for (const id of p.removeTells) expect(genuineIds.has(id)).toBe(true)
    }
  })

  it('tell ids are unique per def and never use the reserved "@" prefix', () => {
    for (const def of ITEM_DEFS) {
      expect(new Set(def.tells.map((t) => t.id)).size).toBe(def.tells.length)
      for (const p of def.fakeProfiles) expect(new Set(p.tells.map((t) => t.id)).size).toBe(p.tells.length)
      for (const t of allTells(def)) expect(t.id.startsWith('@')).toBe(false)
    }
  })

  it('a profile tell that replaces a genuine one uses the same tool', () => {
    for (const def of ITEM_DEFS) {
      const genuine = new Map(def.tells.map((t) => [t.id, t]))
      for (const p of def.fakeProfiles) {
        for (const t of p.tells) {
          const g = genuine.get(t.id)
          if (g) expect(t.tool, `${def.id}/${p.id}/${t.id}`).toBe(g.tool)
        }
      }
    }
  })

  it('finding text is evidence, not a verdict: no fake/genuine/real, at most 140 chars', () => {
    for (const def of ITEM_DEFS) {
      for (const t of allTells(def)) {
        expect(t.finding, `${def.id}/${t.id}`).not.toMatch(VERDICT_WORDS)
        expect(t.finding.length, `${def.id}/${t.id}`).toBeLessThanOrEqual(140)
      }
    }
  })

  it('every non-genuine profile carries at least one negative tell', () => {
    for (const def of ITEM_DEFS) {
      for (const p of def.fakeProfiles) {
        expect(p.tells.some((t) => t.polarity === 'negative'), `${def.id}/${p.id}`).toBe(true)
      }
    }
  })

  it('watches include a frankenstein and a restored profile; gold and phones have a fake kind', () => {
    const kinds = (cat: string) => new Set(ITEM_DEFS.filter((d) => d.category === cat).flatMap((d) => d.fakeProfiles.map((p) => p.kind)))
    expect(kinds('watches').has('frankenstein')).toBe(true)
    expect(kinds('watches').has('restored')).toBe(true)
    expect(kinds('gold').has('fake')).toBe(true)
    expect(kinds('phones').has('fake')).toBe(true)
  })

  it('has 2–4 claims per def and only uses the allowed (fictional or historical) brands', () => {
    for (const def of ITEM_DEFS) {
      expect(def.claims.length).toBeGreaterThanOrEqual(2)
      expect(def.claims.length).toBeLessThanOrEqual(4)
      if (def.brand) expect(ALLOWED_BRANDS.has(def.brand), def.brand).toBe(true)
    }
    for (const d of ITEM_DEFS) expect(Boolean(d.brand), d.id).toBe(!UNBRANDED.has(d.category))
  })

  it('hotspots sit on the placeholder model (metres, centred at the origin)', () => {
    for (const def of ITEM_DEFS) {
      const ext = HALF_EXTENTS[def.model.placeholder]
      for (const h of def.model.hotspots) {
        h.position.forEach((v, i) => expect(Math.abs(v), `${def.id}/${h.id}[${i}]`).toBeLessThanOrEqual(ext[i]!))
      }
    }
  })

  it('weight tolerances leave room for scale noise, so a genuine reading stays in range', () => {
    for (const def of ITEM_DEFS) {
      const w = def.weightGrams!
      const worstGenuine = w.tolerance * tuning.items.weightSpread + tuning.inspect.scaleNoise * w.expected
      expect(worstGenuine, def.id).toBeLessThan(w.tolerance * 0.9)
    }
  })
})

describe('generateItem', () => {
  it('is deterministic for a given rng state', () => {
    for (const def of ITEM_DEFS) {
      expect(generateItem(def, new Rng(42), 'x')).toEqual(generateItem(def, new Rng(42), 'x'))
    }
    const a = new Rng(7)
    const b = new Rng(7)
    expect(pickItemDef(ITEM_DEFS, a)).toBe(pickItemDef(ITEM_DEFS, b))
    expect(a.state).toBe(b.state)
  })

  it('produces fakes at about fakeChance × fakeChanceScale', () => {
    const n = 4000
    for (const def of ITEM_DEFS) {
      const rng = new Rng(1234)
      let fakes = 0
      for (let i = 0; i < n; i++) if (generateItem(def, rng, `i${i}`).authenticity !== 'genuine') fakes++
      const expected = Math.min(1, def.fakeChance * tuning.items.fakeChanceScale)
      expect(Math.abs(fakes / n - expected), def.id).toBeLessThan(0.03)
    }
  })

  it('takes authenticity from the profile kind and picks profiles by weight', () => {
    const def = getItemDef('watch_rolland_abyssal')
    const rng = new Rng(99)
    const counts = new Map<string, number>()
    for (let i = 0; i < 6000; i++) {
      const item = generateItem(def, rng, `i${i}`)
      const p = fakeProfileOf(def, item)
      if (!p) {
        expect(item.authenticity).toBe('genuine')
        expect(item.fakeProfileId).toBeUndefined()
        continue
      }
      expect(item.authenticity).toBe(p.kind)
      counts.set(p.id, (counts.get(p.id) ?? 0) + 1)
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0)
    const weightSum = def.fakeProfiles.reduce((a, p) => a + p.weight, 0)
    for (const p of def.fakeProfiles) {
      expect(Math.abs((counts.get(p.id) ?? 0) / total - p.weight / weightSum), p.id).toBeLessThan(0.03)
    }
  })

  it('keeps condition in the tuning range, fakes included, and restored pieces skew high', () => {
    const [lo, hi] = tuning.items.condition
    const def = getItemDef('watch_pobeda_gold')
    const restored = def.fakeProfiles.find((p) => p.kind === 'restored')!
    const fake = def.fakeProfiles.find((p) => p.kind === 'fake')!
    let sumGenuine = 0
    let sumRestored = 0
    let fakeMax = 0
    for (let s = 0; s < 500; s++) {
      const g = makeItem(def, undefined, s)
      const r = makeItem(def, restored, s)
      const f = makeItem(def, fake, s)
      for (const it of [g, r, f]) {
        expect(it.condition).toBeGreaterThanOrEqual(lo)
        expect(it.condition).toBeLessThanOrEqual(hi)
      }
      sumGenuine += g.condition
      sumRestored += r.condition
      fakeMax = Math.max(fakeMax, f.condition)
    }
    expect(sumRestored).toBeGreaterThan(sumGenuine * 1.08)
    expect(fakeMax).toBeGreaterThan(90)
  })

  it('fixes weight at generation: genuine within tolerance, weightFactor applied to profiles', () => {
    for (const def of ITEM_DEFS) {
      const w = def.weightGrams!
      for (let s = 0; s < 200; s++) {
        const g = makeItem(def, undefined, s)
        expect(Math.abs(g.weightGrams! - w.expected), def.id).toBeLessThanOrEqual(w.tolerance * tuning.items.weightSpread + 0.01)
        for (const p of def.fakeProfiles) {
          const f = makeItem(def, p, s)
          const centre = w.expected * p.weightFactor
          expect(Math.abs(f.weightGrams! - centre)).toBeLessThanOrEqual(w.tolerance * tuning.items.weightSpread * p.weightFactor + 0.01)
        }
      }
    }
  })

  it('gold fakes weigh outside the genuine tolerance', () => {
    for (const def of ITEM_DEFS.filter((d) => d.category === 'gold')) {
      const w = def.weightGrams!
      for (const p of def.fakeProfiles) {
        for (let s = 0; s < 100; s++) expect(Math.abs(makeItem(def, p, s).weightGrams! - w.expected), `${def.id}/${p.id}`).toBeGreaterThan(w.tolerance)
      }
    }
  })

  it('provenance is unknown/clean/heirloom only, with heirlooms only in heirloom categories', () => {
    const seen = new Set<string>()
    const rng = new Rng(5)
    for (let i = 0; i < 3000; i++) {
      const def = pickItemDef(ITEM_DEFS, rng)
      const item = generateItem(def, rng, `i${i}`)
      seen.add(item.provenance)
      expect(item.provenance).not.toBe('stolen')
      if (item.provenance === 'heirloom') expect(tuning.items.heirloomCategories).toContain(def.category)
    }
    expect(seen).toEqual(new Set(['unknown', 'clean', 'heirloom']))
  })

  it('tells the story from the def claims and starts with nothing revealed', () => {
    for (const def of ITEM_DEFS) {
      const item = generateItem(def, new Rng(3), 'x')
      expect(def.claims).toContain(item.story)
      expect(item.revealed).toEqual([])
      expect(item.defId).toBe(def.id)
      expect(item.id).toBe('x')
    }
  })

  it('survives a JSON round trip unchanged (save-friendly: no undefined keys)', () => {
    const rng = new Rng(77)
    for (let i = 0; i < 200; i++) {
      const item = generateItem(pickItemDef(ITEM_DEFS, rng), rng, `i${i}`)
      expect(JSON.parse(JSON.stringify(item))).toStrictEqual(item)
    }
  })
})
