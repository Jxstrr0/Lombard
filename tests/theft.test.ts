import { describe, expect, it } from 'vitest'
import { getItemDef, ITEM_DEFS } from '../src/data/items'
import { tuning } from '../src/data/tuning'
import { UPGRADES } from '../src/data/upgrades'
import { reducer } from '../src/game/actions'
import { protectedAreas, recordsEvidence } from '../src/game/economy/upgrades'
import { generateItem } from '../src/game/items/generate'
import { adjustRep } from '../src/game/reputation'
import { Rng } from '../src/game/rng'
import { displayed, placeItem, setPrice } from '../src/game/shop/display'
import { cheapness, rollShoplifting, theftChance } from '../src/game/shop/theft'
import type { GameState, SlotArea } from '../src/game/state'
import type { ItemInstance } from '../src/game/types'
import { startedState } from './helpers'

/** n cheap items (a Zenit-E camera at `value` ₽ each). */
function cheapItems(n: number, value = 2_500): ItemInstance[] {
  const def = ITEM_DEFS.find((d) => d.id === 'camera_zenit_e')!
  const rng = new Rng(11)
  return Array.from({ length: n }, (_, i) => ({ ...generateItem(def, rng, `z${i}`), trueValue: value, authenticity: 'genuine' as const }))
}

/** A started career, shop open for the day with `total` people through the door, items on display in the given areas. */
function shop(placements: { item: ItemInstance; area: SlotArea }[], total: number = tuning.theft.trafficBaseline, upgrades: string[] = []): GameState {
  const s0 = startedState(4, 'c')
  let s: GameState = {
    ...s0,
    inventory: placements.map((p) => p.item),
    paid: Object.fromEntries(placements.map((p) => [p.item.id, 1_000])),
    day: { ...s0.day, phase: 'open', total },
    shop: { ...s0.shop, upgrades },
  }
  s = { ...s, shop: { ...s.shop, security: upgrades.reduce((a, id) => a + (UPGRADES.find((u) => u.id === id)?.effects.security ?? 0), 0) } }
  const used = new Set<string>()
  for (const p of placements) {
    const slot = s.shop.slots.find((sl) => sl.area === p.area && !used.has(sl.id))!
    used.add(slot.id)
    s = placeItem(s, p.item.id, slot.id)
    s = setPrice(s, p.item.id, 4_000)
  }
  return s
}

/** Expected thefts per night = sum of every displayed item's chance. */
const nightlyRate = (s: GameState) => displayed(s).reduce((a, d) => a + theftChance(s, d.item, d.area), 0)

const careless = (n = 8) => cheapItems(n).map((item, i) => ({ item, area: (i % 2 === 0 ? 'wall' : 'back') as SlotArea }))

describe('theft chance', () => {
  it('cheap things on open shelves; nothing behind the counter glass', () => {
    const [a, b, c] = cheapItems(3)
    const s = shop([
      { item: a!, area: 'counter' },
      { item: b!, area: 'wall' },
      { item: c!, area: 'back' },
    ])
    expect(theftChance(s, a!, 'counter')).toBe(0)
    expect(theftChance(s, b!, 'wall')).toBeGreaterThan(theftChance(s, c!, 'back'))
    expect(theftChance(s, c!, 'back')).toBeGreaterThan(0)
  })

  it('expensive things are not what kids pocket', () => {
    expect(cheapness(1_000)).toBe(1)
    expect(cheapness(tuning.theft.cheapMax)).toBe(0)
    expect(cheapness(9_500)).toBeGreaterThan(0)
    expect(cheapness(9_500)).toBeLessThan(1)
    const [pricey] = cheapItems(1, 40_000)
    expect(theftChance(shop([{ item: pricey!, area: 'wall' }]), pricey!, 'wall')).toBe(0)
  })

  it('more people through the door, more chances; good standing with the kids, fewer', () => {
    const p = careless(2)
    const busy = shop(p, tuning.theft.trafficBaseline * 1.5)
    const quiet = shop(p, tuning.theft.trafficBaseline * 0.5)
    expect(nightlyRate(busy)).toBeGreaterThan(nightlyRate(quiet))
    const s = shop(p)
    expect(nightlyRate(adjustRep(s, 'youth', 0.8))).toBeLessThan(nightlyRate(s))
    expect(nightlyRate(adjustRep(s, 'youth', -0.8))).toBeGreaterThan(nightlyRate(s))
  })

  it('security lowers it; the wall case shuts the wall', () => {
    const p = careless()
    const bare = shop(p)
    expect(nightlyRate(shop(p, undefined, ['door_chime']))).toBeLessThan(nightlyRate(bare))
    expect(nightlyRate(shop(p, undefined, ['convex_mirror']))).toBeLessThan(nightlyRate(shop(p, undefined, ['door_chime'])))
    expect(nightlyRate(shop(p, undefined, ['camera']))).toBeLessThan(nightlyRate(shop(p, undefined, ['convex_mirror'])))
    const cased = shop(p, undefined, ['wall_case'])
    expect(protectedAreas(cased).has('wall')).toBe(true)
    for (const d of displayed(cased)) if (d.area === 'wall') expect(theftChance(cased, d.item, d.area)).toBe(0)
  })

  it('a careless shop loses something every week or two; a secured one rarely', () => {
    // 8 cheap things split between the wall and the back shelf, a normal day's traffic, no security.
    const rate = nightlyRate(shop(careless()))
    expect(1 / rate).toBeGreaterThanOrEqual(7)
    expect(1 / rate).toBeLessThanOrEqual(14)
    // Mirror, camera and wall case: the same stock goes missing about once in two months or less.
    expect(1 / nightlyRate(shop(careless(), undefined, ['convex_mirror', 'camera', 'wall_case']))).toBeGreaterThan(40)
  })
})

describe('rollShoplifting', () => {
  it('is deterministic and leaves the main RNG alone', () => {
    const base = shop(careless(12))
    const s = { ...base, calendar: { ...base.calendar, day: 30 } }
    const a = rollShoplifting(s)
    const b = rollShoplifting(s)
    expect(a).toEqual(b)
    expect(a.state.meta.rng).toBe(s.meta.rng)
  })

  it('leaves a brand-new shop alone for the first week', () => {
    const base = shop(careless(14))
    for (let day = 1; day < tuning.theft.fromDay; day++) expect(rollShoplifting({ ...base, calendar: { ...base.calendar, day } }).stolen).toEqual([])
  })

  it('takes the item out of stock, display, tags and paid; logs it; counts it', () => {
    // Search seeds for a night with a theft (chances are small).
    let found = false
    for (let day = 1; day < 400 && !found; day++) {
      const base = shop(careless(12))
      const s = { ...base, calendar: { ...base.calendar, day } }
      const r = rollShoplifting(s)
      if (r.stolen.length === 0) continue
      found = true
      const id = r.stolen[0]!
      expect(r.state.inventory.some((i) => i.id === id)).toBe(false)
      expect(r.state.shop.slots.some((sl) => sl.itemId === id)).toBe(false)
      expect(id in r.state.shop.prices).toBe(false)
      expect(id in r.state.paid).toBe(false)
      expect(r.state.stats.itemsStolen).toBe(r.stolen.length)
      const entry = r.state.day.log.find((e) => e.kind === 'theft' && e.itemId === id)!
      expect(entry.amount).toBe(0)
      expect(entry.text).toMatch(/Zenit-E/)
      expect(entry.text).toMatch(/wall shelf|back shelf/)
    }
    expect(found).toBe(true)
  })

  it('security that stops a theft says so (once a night)', () => {
    let notes = 0
    for (let day = 1; day < 400; day++) {
      const base = shop(careless(12), undefined, ['camera'])
      const r = rollShoplifting({ ...base, calendar: { ...base.calendar, day } })
      const deterred = r.state.day.log.filter((e) => e.kind === 'deterred')
      expect(deterred.length).toBeLessThanOrEqual(1)
      notes += deterred.length
      for (const e of deterred) expect(e.text).toMatch(/camera|monitor|lens/)
    }
    expect(notes).toBeGreaterThan(0)
  })

  it('runs at closing: ledger entry, day summary, career stats, closing narration', () => {
    let s: GameState = startedState(21, 'c')
    s = reducer(s, { type: 'day/open' })
    // Fill the open shelves with cheap stock and play many empty days.
    const items = cheapItems(14)
    s = { ...s, queue: [], inventory: [...s.inventory, ...items] }
    const shelf = s.shop.slots.filter((sl) => sl.area !== 'counter')
    items.forEach((it, i) => (s = placeItem(s, it.id, shelf[i]!.id)))
    let stolen = 0
    for (let d = 0; d < 60; d++) {
      s = reducer({ ...s, queue: [], current: null, day: { ...s.day, phase: 'open', total: 10, log: [] } }, { type: 'day/close' })
      const last = s.history[s.history.length - 1]!
      const gone = s.day.log.filter((e) => e.kind === 'theft').length
      expect(last.stolen).toBe(gone)
      if (gone > 0) expect(s.narration).toMatch(/gone|gap|isn’t on/)
      stolen += gone
    }
    expect(stolen).toBeGreaterThan(0)
    expect(s.stats.itemsStolen).toBe(stolen)
    expect(s.inventory.length).toBe(items.length + startedState(21, 'c').inventory.length - stolen)
  })
})

describe('security upgrades', () => {
  it('are in the office with tuning costs, and the camera records', () => {
    for (const id of ['door_chime', 'convex_mirror', 'wall_case', 'camera']) {
      const u = UPGRADES.find((x) => x.id === id)!
      expect(u.group).toBe('security')
      expect(u.cost).toBe(tuning.upgrades.cost[id as keyof typeof tuning.upgrades.cost])
    }
    let s: GameState = { ...startedState(1, 'c'), cash: 100_000 }
    expect(recordsEvidence(s)).toBe(false)
    s = reducer(s, { type: 'upgrade/buy', id: 'camera' })
    expect(s.shop.upgrades).toContain('camera')
    expect(s.shop.security).toBe(tuning.upgrades.security.camera)
    expect(recordsEvidence(s)).toBe(true)
    s = reducer(s, { type: 'upgrade/buy', id: 'wall_case' })
    expect(protectedAreas(s).has('wall')).toBe(true)
  })

  it('names stay generic (no brands)', () => {
    for (const u of UPGRADES.filter((x) => x.group === 'security')) expect(u.name).toMatch(/^[A-Z][a-z]+( [a-z]+)*$/)
    expect(getItemDef('camera_zenit_e').name).toMatch(/Zenit/)
  })
})
