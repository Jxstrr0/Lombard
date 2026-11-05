import { describe, expect, it } from 'vitest'
import { ITEM_DEFS, getItemDef } from '../src/data/items'
import { saleLines } from '../src/data/saleLines'
import { tuning } from '../src/data/tuning'
import { reducer, type Action } from '../src/game/actions'
import { generateItem } from '../src/game/items/generate'
import { Rng } from '../src/game/rng'
import { planBuyers, saleRound, sellChance, startSale } from '../src/game/sell/buyer'
import { displayed, placeItem, setPrice } from '../src/game/shop/display'
import type { GameState, SlotArea } from '../src/game/state'
import type { ItemInstance, SaleState, Temperament, WalkIn } from '../src/game/types'
import { startedState } from './helpers'

const TEMPERAMENTS: readonly Temperament[] = ['stubborn', 'flexible', 'desperate', 'proud']
const run = (s: GameState, ...actions: Action[]) => actions.reduce(reducer, s)

function makeItems(seed: number, n: number): ItemInstance[] {
  const rng = new Rng(seed)
  return Array.from({ length: n }, (_, i) => generateItem(ITEM_DEFS[i % ITEM_DEFS.length]!, rng, `t${i}`))
}

/** A started career with `items` in stock, each placed in `area` and tagged at `ratio` × trueValue. */
function stocked(seed: number, items: ItemInstance[], area: SlotArea, ratio: number): GameState {
  let s: GameState = { ...startedState(seed, 'c1'), inventory: items, paid: Object.fromEntries(items.map((i) => [i.id, Math.round(i.trueValue * 0.5)])) }
  const slots = s.shop.slots.filter((sl) => sl.area === area)
  items.forEach((it, i) => {
    s = placeItem(s, it.id, slots[i]!.id)
    s = setPrice(s, it.id, Math.round(it.trueValue * ratio))
  })
  return s
}

/** Average buyers per day over many seeded rolls. */
function buyersPerDay(s: GameState, days = 400): number {
  const rng = new Rng(77)
  let n = 0
  let id = 0
  for (let d = 0; d < days; d++) n += planBuyers(s, rng, (p) => `${p}${id++}`).length
  return n / days
}

function walkIn(temperament: Temperament, knowledge = 0.5, desperation = 0.5): WalkIn {
  return { id: 'b1', name: 'Vera', archetype: 'office', temperament, knowledge, desperation, portraitKey: 'office' }
}

describe('display', () => {
  it('places, swaps and sends items to the safe', () => {
    const [a, b] = makeItems(1, 2)
    let s: GameState = { ...startedState(1, 'c1'), inventory: [a!, b!] }
    s = placeItem(s, a!.id, 'counter-1')
    s = placeItem(s, b!.id, 'wall-1')
    s = placeItem(s, b!.id, 'counter-1') // swap: a takes b's old slot
    expect(s.shop.slots.find((x) => x.id === 'counter-1')?.itemId).toBe(b!.id)
    expect(s.shop.slots.find((x) => x.id === 'wall-1')?.itemId).toBe(a!.id)
    s = placeItem(s, a!.id, null)
    expect(displayed(s).map((d) => d.item.id)).toEqual([b!.id])
    expect(placeItem(s, 'nope', 'counter-2')).toBe(s)
  })

  it('a zero tag removes the price; tags are capped', () => {
    const [a] = makeItems(2, 1)
    let s: GameState = { ...startedState(1, 'c1'), inventory: [a!] }
    s = setPrice(s, a!.id, 5000)
    expect(s.shop.prices[a!.id]).toBe(5000)
    s = setPrice(s, a!.id, 0)
    expect(a!.id in s.shop.prices).toBe(false)
    s = setPrice(s, a!.id, 1e12)
    expect(s.shop.prices[a!.id]).toBe(tuning.shop.maxTag)
  })
})

describe('buyer planning', () => {
  it('is deterministic for a seed', () => {
    const s = stocked(3, makeItems(3, 6), 'counter', 1)
    const plan = (seed: number) => {
      let id = 0
      return planBuyers(s, new Rng(seed), (p) => `${p}${id++}`)
    }
    expect(plan(11)).toEqual(plan(11))
    const many = Array.from({ length: 20 }, (_, i) => plan(i).length)
    expect(Math.max(...many)).toBeGreaterThan(0)
  })

  it('every buyer is for a displayed, tagged item, with a line and patience; capped per day', () => {
    const s = stocked(4, makeItems(4, 12), 'wall', 0.6)
    const rng = new Rng(5)
    let id = 0
    for (let d = 0; d < 50; d++) {
      const buyers = planBuyers(s, rng, (p) => `${p}${id++}`)
      expect(buyers.length).toBeLessThanOrEqual(tuning.sell.maxBuyersPerDay)
      for (const b of buyers) {
        expect(b.kind).toBe('buyer')
        expect(s.shop.prices[b.item.id]).toBeGreaterThan(0)
        expect(b.line && b.line.length > 3).toBe(true)
        expect(b.line).not.toContain('{')
        expect(b.patience).toBeGreaterThan(0)
      }
    }
  })

  it('untagged items and the safe draw nobody', () => {
    const items = makeItems(6, 4)
    let s = stocked(6, items, 'counter', 1)
    for (const it of items) s = setPrice(s, it.id, 0)
    expect(buyersPerDay(s, 50)).toBe(0)
    const safe: GameState = { ...stocked(6, items, 'counter', 1), shop: { ...s.shop, slots: s.shop.slots.map((x) => ({ ...x, itemId: null })) } }
    expect(buyersPerDay(safe, 50)).toBe(0)
  })

  it('lower prices draw more buyers', () => {
    const items = makeItems(7, 3)
    const cheap = buyersPerDay(stocked(7, items, 'counter', 0.8))
    const fair = buyersPerDay(stocked(7, items, 'counter', 1))
    const dear = buyersPerDay(stocked(7, items, 'counter', 1.6))
    expect(cheap).toBeGreaterThan(fair)
    expect(fair).toBeGreaterThan(dear * 2)
  })

  it('higher visibility draws more buyers', () => {
    const items = makeItems(8, 3)
    const counter = buyersPerDay(stocked(8, items, 'counter', 1))
    const wall = buyersPerDay(stocked(8, items, 'wall', 1))
    const back = buyersPerDay(stocked(8, items, 'back', 1))
    expect(counter).toBeGreaterThan(wall)
    expect(wall).toBeGreaterThan(back)
    const s = stocked(8, items, 'counter', 1)
    expect(sellChance(s, items[0]!, 'counter', 0)).toBe(0)
  })
})

describe('sale haggle', () => {
  /** Play a sale to the end with a policy; returns the final sale. */
  function play(sale: SaleState, customer: WalkIn, rng: Rng, policy: (s: SaleState, round: number) => number): SaleState {
    let s = sale
    for (let r = 0; r < 10 && s.status === 'open'; r++) s = saleRound(s, policy(s, r), customer, rng).sale
    return s
  }

  it('opens at or under the tag and the ceiling, and never sells above the ceiling', () => {
    const rng = new Rng(99)
    const base = startedState(1, 'c1')
    const items = makeItems(9, 30)
    const policies: ((s: SaleState, r: number) => number)[] = [
      (s) => s.tag, // hold firm at the tag
      (s, r) => s.tag - (s.tag - s.offer) * 0.3 * r, // come down slowly
      (s) => Math.round((s.offer + s.tag) / 2), // split
      (s) => s.tag * 3, // absurd
      (s) => s.offer - 100, // under their offer
    ]
    let sold = 0
    for (let i = 0; i < 1500; i++) {
      const item = items[i % items.length]!
      const tag = Math.round(item.trueValue * rng.range(0.6, 2.2))
      const customer = walkIn(rng.pick(TEMPERAMENTS), rng.next(), rng.next())
      const sale = startSale(base, item, tag, customer, rng)
      expect(sale.offer).toBeLessThanOrEqual(sale.tag)
      expect(sale.offer).toBeLessThanOrEqual(sale.ceiling)
      expect(sale.ceiling).toBeLessThanOrEqual(sale.tag)
      expect(sale.offer).toBeGreaterThan(0)
      const end = play(sale, customer, rng, policies[i % policies.length]!)
      expect(end.status).not.toBe('open')
      const last = end.history[end.history.length - 1]!.response
      if (end.status === 'sold') {
        sold++
        expect(last.kind).toBe('accept')
        expect(last.price).toBeLessThanOrEqual(sale.ceiling)
        expect(last.price).toBeGreaterThanOrEqual(sale.offer)
      }
      for (const h of end.history) expect(saleLines[h.response.lineKey]?.length ?? 0).toBeGreaterThan(0)
    }
    expect(sold).toBeGreaterThan(300)
  })

  it('a counter under their offer is taking their offer', () => {
    const item = makeItems(10, 1)[0]!
    const sale = startSale(startedState(1, 'c1'), item, item.trueValue, walkIn('flexible'), new Rng(1))
    const { sale: next, response } = saleRound(sale, sale.offer - 500, walkIn('flexible'), new Rng(2))
    expect(response).toMatchObject({ kind: 'accept', price: sale.offer })
    expect(next.status).toBe('sold')
  })

  it('knowledgeable buyers pay less for fakes than naive ones', () => {
    const def = ITEM_DEFS.find((d) => d.fakeProfiles.length > 0)!
    const rng = new Rng(3)
    let fake: ItemInstance | undefined
    for (let i = 0; i < 500 && !fake; i++) {
      const it = generateItem(def, rng, `f${i}`)
      if (it.authenticity === 'fake') fake = it
    }
    expect(fake).toBeDefined()
    const s = startedState(1, 'c1')
    const tag = fake!.trueValue * 4
    const avg = (k: number) => {
      const r = new Rng(4)
      let sum = 0
      for (let i = 0; i < 300; i++) sum += startSale(s, fake!, tag, walkIn('flexible', k), r).ceiling
      return sum / 300
    }
    expect(avg(1)).toBeLessThan(avg(0) * 0.8)
    expect(avg(1)).toBeLessThan(fake!.trueValue * 1.4)
  })
})

describe('selling through the reducer', () => {
  /** Day 1 → close → stock the counter case cheaply → open day 2 until a buyer reaches the counter. */
  function buyerAtCounter(seed: number): GameState | null {
    const items = makeItems(seed, 6)
    let s = run(startedState(seed, 'c1'), { type: 'day/open' })
    s = { ...s, queue: [], day: { ...s.day, total: 0 } }
    s = run(s, { type: 'day/close' })
    s = { ...s, inventory: [...s.inventory, ...items], paid: { ...s.paid, ...Object.fromEntries(items.map((i) => [i.id, 1000])) } }
    items.forEach((it, i) => {
      s = run(s, { type: 'shop/place', itemId: it.id, slotId: `counter-${i + 1}` }, { type: 'shop/price', itemId: it.id, price: Math.round(it.trueValue * 0.8) })
    })
    s = run(s, { type: 'day/open' }, { type: 'news/dismiss' })
    while (s.queue.length > 0) {
      s = run(s, { type: 'counter/next' })
      if (s.current?.kind === 'buyer' && s.current.phase === 'present') return s
      s = run(s, ...(s.current?.phase === 'resolved' ? [] : [{ type: 'counter/pass' } as Action]), { type: 'counter/dismiss' })
    }
    return null
  }

  function findBuyer(): GameState {
    for (let seed = 1; seed < 40; seed++) {
      const s = buyerAtCounter(seed)
      if (s) return s
    }
    throw new Error('no buyer in 40 seeds')
  }

  it('accepting their offer updates cash, inventory, slot, prices, paid, stats and the log', () => {
    const s = findBuyer()
    const c = s.current!
    expect(c.sale?.status).toBe('open')
    const id = c.item.id
    const offer = c.sale!.offer
    const paid = s.paid[id]!
    const after = run(s, { type: 'sale/accept' })
    expect(after.current?.outcome).toBe('sold')
    expect(after.current?.price).toBe(offer)
    expect(after.cash).toBe(s.cash + offer)
    expect(after.inventory.some((i) => i.id === id)).toBe(false)
    expect(after.shop.slots.some((sl) => sl.itemId === id)).toBe(false)
    expect(id in after.shop.prices).toBe(false)
    expect(id in after.paid).toBe(false)
    expect(after.stats.itemsSold).toBe(s.stats.itemsSold + 1)
    expect(after.stats.totalEarned).toBe(s.stats.totalEarned + offer)
    expect(after.stats.bestDeal).toBe(Math.max(s.stats.bestDeal, offer - paid))
    expect(after.day.log[after.day.log.length - 1]).toMatchObject({ kind: 'sell', amount: offer, itemId: id })
  })

  it('countering plays the sale haggle and resolves to sold or walked', () => {
    const s0 = findBuyer()
    let s = s0
    for (let i = 0; i < 6 && s.current?.phase === 'present'; i++) s = run(s, { type: 'sale/counter', amount: s.current.sale!.tag })
    expect(s.current?.phase).toBe('resolved')
    expect(['sold', 'walked']).toContain(s.current?.outcome)
    if (s.current?.outcome === 'sold') expect(s.cash).toBeGreaterThan(s0.cash)
    else expect(s.inventory.some((i) => i.id === s0.current!.item.id)).toBe(true)
  })

  it('refusing keeps the item', () => {
    const s = findBuyer()
    const after = run(s, { type: 'counter/pass' })
    expect(after.current?.outcome).toBe('passed')
    expect(after.inventory.some((i) => i.id === s.current!.item.id)).toBe(true)
    expect(after.cash).toBe(s.cash)
  })

  it('a buyer whose item has sold out leaves', () => {
    const s = findBuyer()
    const id = s.current!.item.id
    // Put the buyer back in the queue, sell the item to them first, then send a second buyer for it.
    const visit = { visitId: 'vx', kind: 'buyer' as const, customer: { ...s.current!.customer, id: 'cx' }, item: s.current!.item, patience: 500 }
    let after = run(s, { type: 'sale/accept' })
    after = { ...after, queue: [visit, ...after.queue] }
    after = run(after, { type: 'counter/dismiss' }, { type: 'counter/next' })
    expect(after.current?.visitId).toBe('vx')
    expect(after.current?.outcome).toBe('left')
    expect(after.current?.sale).toBeNull()
    expect(after.inventory.some((i) => i.id === id)).toBe(false)
  })

  it('the dealer pays clearly less than display', () => {
    expect(tuning.appraise.dealerRate).toBeGreaterThanOrEqual(0.55)
    expect(tuning.appraise.dealerRate).toBeLessThanOrEqual(0.6)
    expect(getItemDef(ITEM_DEFS[0]!.id)).toBeDefined()
  })
})
