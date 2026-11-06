/** M5 the fence (src/game/crime/fence.ts, src/data/fence.ts, src/data/stories/fence.ts). */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { atDay, beatAtCounter, choose, eligible, offer, pass, run } from './storyHelpers'
import { reducer } from '../src/game/actions'
import { FENCE, FENCE_LINES } from '../src/data/fence'
import { CAST } from '../src/data/customers/cast'
import { firstNames } from '../src/data/customers/walkins'
import { getItemDef } from '../src/data/items'
import { REGULARS } from '../src/data/regulars'
import { SPECIALISTS } from '../src/data/specialists'
import { ARCS } from '../src/data/stories'
import { tuning } from '../src/data/tuning'
import { claimedValue } from '../src/game/appraise/value'
import {
  FENCE_SOLD_EVENT,
  fenceAsk,
  fenceBuyCall,
  fenceGoods,
  fenceOffer,
  fenceTier,
  isFence,
  planFence,
  problemPiece,
  soldByFence,
} from '../src/game/crime/fence'
import { scriptedItem } from '../src/game/story/scripted'
import { Rng } from '../src/game/rng'
import type { FenceState, GameState } from '../src/game/state'
import type { ItemInstance, QueuedVisit } from '../src/game/types'
import { simulate } from '../src/sim/simulate'
import { careful, fenceFriend } from '../src/sim/policies'

const F = tuning.fence
/** Looks reserved for arc characters (tests/specialistArcs.test.ts). */
const RESERVED_LOOKS = new Set(['business_male_05', 'male_adult_06', 'male_adult_20', 'male_adult_11'])

/** Closed on the morning of `day`, the fence met with these numbers. */
function metState(day: number, fence: Partial<FenceState> = {}, trust = 0): GameState {
  const s = atDay(startedState(31, 'fence'), day)
  return { ...s, cash: 200_000, crime: { ...s.crime, fenceTrust: trust, fence: { met: true, deals: 0, refusals: 0, nextDay: day, ...fence } } }
}

const ids = (day: number) => (prefix: string, who: string) => `${prefix}s${day.toString(36)}_${who}`

function stolenPiece(id: string, defId = 'gold_bracelet_585'): ItemInstance {
  return scriptedItem(getItemDef(defId), { authenticity: 'genuine', provenance: 'stolen', story: 'x' }, new Rng(5), id)
}

/** Put a visit first in line on an open day and call it to the counter. */
function atCounter(s: GameState, visit: QueuedVisit): GameState {
  let open = reducer(s, { type: 'day/open' })
  open = { ...open, queue: [visit, ...open.queue.filter((q) => !isFence(q.customer))] }
  return reducer(open, { type: 'counter/next' })
}

describe('the fence: content', () => {
  it('wears a male walk-in look no regular, specialist or reserved arc character wears', () => {
    const look = CAST.find((c) => c.id === FENCE.look)
    expect(look).toBeDefined()
    expect(look!.regular ?? false).toBe(false)
    expect(look!.gender).toBe('m')
    expect(RESERVED_LOOKS.has(FENCE.look)).toBe(false)
    expect(REGULARS.some((r) => r.look === FENCE.look)).toBe(false)
    expect(SPECIALISTS.some((s) => s.look === FENCE.look)).toBe(false)
  })

  it('has a name no walk-in or regular shares', () => {
    const first = FENCE.name.split(' ')[0]!
    expect(firstNames).not.toContain(first)
    expect(REGULARS.some((r) => r.name.split(' ')[0] === first)).toBe(false)
  })

  it('brings real items and his arc names real changes', () => {
    for (const g of F.goods) expect(() => getItemDef(g.defId)).not.toThrow()
    const arc = ARCS.find((a) => a.id === 'fence')!
    expect(arc.beats.map((b) => b.id)).toEqual(['fence.meet', 'fence.notebook', 'fence.standing'])
    for (const b of arc.beats) {
      expect(b.visit.who).toBe(FENCE.id)
      for (const c of b.visit.scene?.choices ?? []) {
        expect(['fence_yes', 'refuse']).toContain(c.id)
        for (const e of c.effects) if (e.do === 'fence') expect(F.changes[e.change], e.change).toBeDefined()
      }
    }
  })
})

describe('the fence: meeting', () => {
  it('comes in from meetDay and plays at the counter as himself', () => {
    const s0 = startedState(31, 'fence')
    expect(eligible(atDay(s0, F.meetDay - 1), 'fence.meet')).toBe(false)
    expect(eligible(atDay(s0, F.meetDay), 'fence.meet')).toBe(true)
    const s = beatAtCounter(s0, 'fence.meet', F.meetDay)
    expect(isFence(s.current!.customer)).toBe(true)
    expect(s.current!.customer.portraitKey).toBe(FENCE.look)
  })

  it('keeping the Tuesdays: met, a little trust, a next contact', () => {
    const s = choose(beatAtCounter(startedState(31, 'fence'), 'fence.meet', 14), 'fence_yes')
    expect(s.crime.fence.met).toBe(true)
    expect(s.crime.fence.refusals).toBe(0)
    expect(s.crime.fenceTrust).toBeCloseTo(F.changes.meet_yes!.trust!)
    expect(s.crime.fence.nextDay).toBeGreaterThan(14)
  })

  it('"not that kind of shop": met all the same, and his first no in the notebook', () => {
    const s = choose(beatAtCounter(startedState(31, 'fence'), 'fence.meet', 14), 'refuse')
    expect(s.crime.fence.met).toBe(true)
    expect(s.crime.fence.refusals).toBe(1)
    expect(s.crime.fenceTrust).toBeLessThan(0)
    expect(s.crime.fence.nextDay).toBeGreaterThan(14)
  })

  it('the notebook call after enough refusals; the standing offer after deals and trust', () => {
    let s = metState(40, { refusals: F.notebookAt - 1 })
    s = choose(beatAtCounter(s, 'fence.meet', 20), 'refuse') // third no
    expect(eligible(atDay(s, 41), 'fence.notebook')).toBe(true)
    expect(eligible(atDay(s, 41), 'fence.standing')).toBe(false)
    const after = choose(beatAtCounter(s, 'fence.notebook', 41), 'refuse')
    expect(after.crime.fence.refusals).toBe(F.notebookAt + 1)
    expect(after.crime.fence.nextDay).toBeGreaterThanOrEqual(41 + F.changes.notebook_no!.nextIn![0])

    let w = metState(40, { deals: F.standing.deals }, F.standing.trust)
    w = choose(beatAtCounter(w, 'fence.meet', 20), 'fence_yes')
    expect(eligible(atDay(w, 41), 'fence.standing')).toBe(true)
    const yes = choose(beatAtCounter(w, 'fence.standing', 41), 'fence_yes')
    expect(yes.story.flags).toContain('dirty.fence_standing')
    expect(yes.career.axes.clean).toBeLessThan(w.career.axes.clean)
    expect(yes.crime.heat).toBeGreaterThan(w.crime.heat)
  })
})

describe('the fence: planning', () => {
  it('no contact before you have met him, and none before his next day', () => {
    const s = atDay(startedState(31, 'fence'), 30)
    expect(planFence(s, ids(30), false).visit).toBeNull()
    expect(planFence(metState(30, { nextDay: 31 }), ids(30), false).visit).toBeNull()
    expect(planFence(metState(30), ids(30), true).visit).toBeNull() // a fence beat has him in today
  })

  it('a contact on his day, with story ids, and the next one scheduled', () => {
    const s = metState(30)
    const plan = planFence(s, ids(30), false)
    expect(plan.visit).not.toBeNull()
    expect(plan.visit!.visitId).toBe('vsu_fence')
    expect(plan.fence.nextDay).toBeGreaterThanOrEqual(30 + Math.round(F.every[0] * (1 - F.trustShorten * 0)))
    expect(planFence(s, ids(30), false)).toEqual(plan) // deterministic
  })

  it("never touches the game Rng or the id counter, and the day's walk-ins are the same", () => {
    const met = metState(30)
    const unmet = { ...met, crime: { ...met.crime, fence: { ...met.crime.fence, met: false } } }
    const a = reducer(met, { type: 'day/open' })
    const b = reducer(unmet, { type: 'day/open' })
    expect(a.meta.rng).toEqual(b.meta.rng)
    expect(a.meta.nextId).toBe(b.meta.nextId)
    const fenceVisits = a.queue.filter((v) => isFence(v.customer))
    expect(fenceVisits).toHaveLength(1)
    expect(a.queue.filter((v) => !isFence(v.customer))).toEqual(b.queue)
  })

  it('refusals thin out his contacts; trust brings him round sooner', () => {
    const gapOf = (s: GameState) => planFence(s, ids(30), false).fence.nextDay - 30
    const avg = (f: (seed: number) => GameState) => {
      let t = 0
      for (let seed = 0; seed < 30; seed++) t += gapOf(f(seed))
      return t / 30
    }
    const at = (seed: number, fence: Partial<FenceState>, trust = 0) => {
      const s = metState(30, fence, trust)
      return { ...s, meta: { ...s.meta, seed } }
    }
    const plain = avg((seed) => at(seed, {}))
    expect(avg((seed) => at(seed, { refusals: 4 }))).toBeGreaterThan(plain * 1.8)
    expect(avg((seed) => at(seed, { deals: 5 }, 0.8))).toBeLessThan(plain)
  })
})

describe('the fence: prices and voice', () => {
  it('he sells well under value, and dearer the more you refuse; trust brings it down', () => {
    const s = metState(30)
    const v = fenceGoods(s, ids(30))
    expect(v.kind).toBe('seller')
    const item = v.item!
    expect(['stolen', 'unknown']).toContain(item.provenance)
    const claim = claimedValue(getItemDef(item.defId), item)
    expect(fenceAsk(s, item)).toBeLessThanOrEqual(claim * F.ask.base + 100)
    expect(fenceAsk(metState(30, { refusals: 4 }), item)).toBeGreaterThan(fenceAsk(s, item))
    expect(fenceAsk(metState(30, { deals: 5 }, 0.8), item)).toBeLessThan(fenceAsk(s, item))
    expect(v.line).toContain(fenceAsk(s, item).toLocaleString('en-US'))
  })

  it('he buys for a fraction of worth, less the more you refuse', () => {
    const piece = stolenPiece('x1')
    expect(fenceOffer(metState(30), piece)).toBeLessThan(piece.trueValue * 0.5)
    expect(fenceOffer(metState(30, { refusals: 4 }), piece)).toBeLessThan(fenceOffer(metState(30), piece))
  })

  it('his voice: first, warm, plain, sore', () => {
    expect(fenceTier(metState(30))).toBe('first')
    expect(fenceTier(metState(30, { deals: 2 }, 0.5))).toBe('warm')
    expect(fenceTier(metState(30, { deals: 2, refusals: 1 }))).toBe('again')
    expect(fenceTier(metState(30, { deals: 1, refusals: 3 }))).toBe('sore')
  })

  it('a problem piece is a stolen one in stock (not one he sold you), else a fake on display', () => {
    let s = metState(30)
    expect(problemPiece(s)).toBeNull()
    const mine = stolenPiece('mine')
    const his = stolenPiece('his', 'gold_rope_chain_585')
    s = { ...s, inventory: [...s.inventory, mine, his], crime: { ...s.crime, events: [{ day: 20, kind: FENCE_SOLD_EVENT, data: { itemId: 'his', defId: his.defId } }] } }
    expect(soldByFence(s).has('his')).toBe(true)
    expect(problemPiece(s)?.item.id).toBe('mine')
  })
})

describe('the fence: deals and refusals at the counter', () => {
  it('buying from him: a deal, trust, heat, the clean axis, mob standing, and the bulletin hook', () => {
    const s0 = metState(30)
    let s = atCounter(s0, fenceGoods(s0, ids(30)))
    expect(isFence(s.current!.customer)).toBe(true)
    const item = s.current!.item!
    const ask = fenceAsk(s, item)
    s = offer(s, ask)
    expect(s.current!.outcome).toBe('bought')
    expect(s.current!.price).toBe(ask)
    expect(FENCE_LINES.afterBought).toContain(s.current!.line)
    expect(s.crime.fence.deals).toBe(1)
    expect(s.crime.fenceTrust).toBeCloseTo(F.trust.deal)
    expect(s.crime.heat).toBeCloseTo(F.heat.bought)
    const stolen = item.provenance === 'stolen' ? tuning.axes.stolenBought : 0
    expect(s.career.axes.clean).toBeCloseTo(s0.career.axes.clean + tuning.axes.fenceDeal + stolen)
    expect(s.reputation.byGroup.mob).toBeGreaterThan(s0.reputation.byGroup.mob)
    expect(s.crime.events).toContainEqual({ day: 30, kind: FENCE_SOLD_EVENT, data: { itemId: item.id, defId: item.defId } })
  })

  it('he barely haggles: far under his price is a no', () => {
    const s0 = metState(30)
    let s = atCounter(s0, fenceGoods(s0, ids(30)))
    const ask = fenceAsk(s, s.current!.item!)
    for (let i = 0; i < 4 && s.current?.phase !== 'resolved'; i++) s = s.current!.phase === 'present' ? offer(s, ask * 0.5) : reducer(s, { type: 'offer/make', amount: Math.round(ask * 0.5), approach: 'straight' })
    expect(s.current!.outcome).toBe('walked')
    expect(s.crime.fence.refusals).toBe(1)
  })

  it('saying no: counted, a little less trust, and he says how many times', () => {
    const s0 = metState(30, { refusals: 1 })
    const s = pass(atCounter(s0, fenceGoods(s0, ids(30))))
    expect(s.current!.outcome).toBe('passed')
    expect(s.crime.fence.refusals).toBe(2)
    expect(s.crime.fenceTrust).toBeCloseTo(F.trust.refusal)
    expect(s.current!.line).toMatch(/twice|Pencil/)
    expect(s.crime.heat).toBe(0)
    expect(s.career.axes.clean).toBe(s0.career.axes.clean)
  })

  it('selling him a stolen piece by phone: gone from stock, a deal, a little heat', () => {
    const piece = stolenPiece('hot1')
    const s0 = { ...metState(30), inventory: [...metState(30).inventory, piece] }
    const call = fenceBuyCall(s0, { item: piece, kind: 'stolen' }, ids(30))
    expect(call.via).toBe('phone')
    let s = atCounter(s0, call)
    expect(s.current!.sale?.offer).toBe(fenceOffer(s0, piece))
    s = reducer(s, { type: 'sale/accept' })
    expect(s.current!.outcome).toBe('sold')
    expect(s.inventory.some((i) => i.id === 'hot1')).toBe(false)
    expect(s.crime.fence.deals).toBe(1)
    expect(s.crime.heat).toBeCloseTo(F.heat.sold)
    expect(s.cash).toBe(s0.cash + fenceOffer(s0, piece))
  })

  it('a piece gone before he rings: he rings off, nothing counted', () => {
    const piece = stolenPiece('hot2')
    const s0 = metState(30)
    const s = atCounter(s0, fenceBuyCall(s0, { item: piece, kind: 'stolen' }, ids(30)))
    expect(s.current!.outcome).toBe('left')
    expect(s.current!.line).toBe(FENCE_LINES.gone)
    const after = run(s, { type: 'counter/dismiss' })
    expect([after.crime.fence.deals, after.crime.fence.refusals, after.crime.fenceTrust]).toEqual([0, 0, 0])
  })
})

describe('the fence: the sim', () => {
  it('the careful shop always says no; the fence-friendly one deals, runs warmer and dirtier', () => {
    let deals = 0
    for (const seed of [1000, 1001, 1002]) {
      const clean = simulate(seed, careful, 45)
      const dirty = simulate(seed, fenceFriend, 45)
      deals += dirty.crime.fence.deals
      expect(clean.crime.fence.deals, `seed ${seed}`).toBe(0)
      expect(clean.bustDay, `seed ${seed}`).toBeNull()
      if (dirty.crime.fence.met && dirty.crime.fence.deals > 0) {
        // Heat fades nightly (tuning.police.heat decayShare/decayMin): two early deals can be cold by day 45
        // (seed 1002 after M6 wave B: 2 deals, heat back to 0). The clean axis remembers.
        expect(dirty.crime.heat).toBeGreaterThanOrEqual(clean.crime.heat)
        expect(dirty.axes.clean).toBeLessThan(clean.axes.clean)
      }
    }
    expect(deals).toBeGreaterThan(0)
  })
})
