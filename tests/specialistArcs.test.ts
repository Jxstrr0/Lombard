/**
 * M4 specialists' small arcs (GDD § 2b): the engine pieces (conditions, effects, the
 * released-specialist rule, call bookkeeping, first refusal, boosts, paper beats, the
 * v5 → v6 migration) and the five arcs' data, with Zhenya's arc played end to end.
 */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { reducer, type Action } from '../src/game/actions'
import { tuning } from '../src/data/tuning'
import { getItemDef, ITEM_DEFS } from '../src/data/items'
import { CAST } from '../src/data/customers/cast'
import { SPECIALISTS } from '../src/data/specialists'
import { REGULARS } from '../src/data/regulars'
import { ARCS, getBeat } from '../src/data/stories'
import { chargeExpenses } from '../src/game/economy/expenses'
import { callsLeft, retainSpecialist } from '../src/game/economy/specialists'
import { generateItem } from '../src/game/items/generate'
import { generateDayQueue } from '../src/game/customers/walkins'
import { SPECIALIST_TELL, specialistCallSeconds, specialistOpinion } from '../src/game/inspect/tools'
import { Rng } from '../src/game/rng'
import { migrate } from '../src/game/save/migrations'
import { sellChance } from '../src/game/sell/buyer'
import { removeSold } from '../src/game/shop/sold'
import { holds } from '../src/game/story/conditions'
import { applyEffects } from '../src/game/story/effects'
import { eligibleBeats } from '../src/game/story/plan'
import { endArc, recordBeat } from '../src/game/story/progress'
import { boostSellers, monthsRetained, noteBought, noteCall, specialistCustomer, startBoost } from '../src/game/story/specialists'
import { addDays, weekdayOf, type GameState } from '../src/game/state'
import type { Condition } from '../src/game/schema/story'
import type { ItemInstance, QueuedVisit, SpecialistState } from '../src/game/types'

const run = (s: GameState, ...actions: Action[]) => actions.reduce(reducer, s)

/** A started career, closed, on career day `day` (date follows from the start date). */
function closedOnDay(day: number, cash = 200_000): GameState {
  const s = startedState(11, 'arcs')
  const date = addDays(tuning.career.startDate, day - 1)
  return { ...s, cash, calendar: { ...s.calendar, day, date, weekday: weekdayOf(date) } }
}

/** Put a specialist record straight into the state (retained since `sinceDay`, `months` paid). */
function withSp(s: GameState, id: string, p: Partial<SpecialistState> = {}): GameState {
  const sp: SpecialistState = { retained: true, relationship: 0.1, callsUsed: 0, sinceDay: 1, months: 0, events: {}, mods: {}, lowballed: [], ...p }
  return { ...s, specialists: { ...s.specialists, [id]: sp } }
}

function item(defId: string, authenticity: ItemInstance['authenticity'] = 'genuine', id = `i-${defId}`): ItemInstance {
  const def = getItemDef(defId)
  const profile = authenticity === 'genuine' ? undefined : def.fakeProfiles.find((p) => p.kind === authenticity)
  const forced = profile ? { ...def, fakeChance: 1, fakeProfiles: [profile] } : { ...def, fakeChance: 0 }
  return generateItem(forced, new Rng(5), id)
}

/** Who plays whom: Faina and Zhenya are women, Ilya and Stanislav men. */
const SPECIALIST_GENDER: Record<string, 'f' | 'm'> = { jeweler: 'f', watchmaker: 'm', antiquary: 'm', technician: 'f' }
/** The last free regular-only looks, kept for arc characters: Edik (Dubai Rolex Guy), Fedya (Student's Laptop), Eduard and Zhora (Protection). */
const RESERVED_LOOKS = new Set(['business_male_05', 'male_adult_06', 'male_adult_20', 'male_adult_11'])

const eligible = (s: GameState, prefix = '') => new Set(eligibleBeats(s).map((b) => b.id).filter((id) => id.startsWith(prefix)))

describe('specialist arcs: content', () => {
  const looks = new Map(CAST.map((c) => [c.id, c]))
  const specialists = new Map(SPECIALISTS.map((s) => [s.id, s]))

  it('every specialist has an arc of 3–4 main beats, and the arcs only name real things', () => {
    for (const sp of SPECIALISTS) {
      const arc = ARCS.find((a) => a.specialist === sp.id)
      expect(arc, sp.id).toBeDefined()
      expect(arc!.beats.length, sp.id).toBeGreaterThanOrEqual(3)
      for (const beat of arc!.beats) {
        const v = beat.visit
        expect(specialists.has(v.who) || REGULARS.some((r) => r.id === v.who), beat.id).toBe(true)
        const conds: Condition[] = beat.when.flatMap((c) => (c.if === 'any' ? c.of : [c]))
        for (const c of conds) {
          if (c.if === 'retainedMonths' || c.if === 'specialistEvent' || c.if === 'specialist') expect(specialists.has(c.id), `${beat.id} ${c.id}`).toBe(true)
          if (c.if === 'arc') expect(ARCS.some((a) => a.id === c.arc), `${beat.id} arc ${c.arc}`).toBe(true)
          if (c.if === 'beat') expect(getBeat(c.beat), `${beat.id} → ${c.beat}`).toBeDefined()
        }
        const effects = [...(v.scene?.choices.flatMap((c) => c.effects) ?? []), ...Object.values(v.after).flatMap((a) => a?.effects ?? [])]
        for (const e of effects) if (e.do === 'specialist' || e.do === 'sellTo') expect(specialists.has(e.id), `${beat.id} ${e.id}`).toBe(true)
        // {cash} is only said where a choice moves cash.
        const text = [...(v.scene?.lines ?? []), ...(v.scene?.choices.flatMap((c) => [c.label, c.reply]) ?? [])].join(' ')
        if (text.includes('{cash}')) {
          expect(effects.some((e) => e.do === 'specialist' && tuning.specialistArcs.changes[e.change]?.cash), beat.id).toBe(true)
        }
      }
    }
  })

  it('boosts and offers name real items, fake profiles and categories', () => {
    const cats = new Set<string>(ITEM_DEFS.map((d) => d.category))
    for (const [id, b] of Object.entries(tuning.specialistArcs.boosts)) {
      for (const defId of b.defs) {
        const def = getItemDef(defId)
        if (b.fakeProfileId) expect(def.fakeProfiles.find((p) => p.id === b.fakeProfileId)?.kind, `${id} ${defId}`).toBe(b.authenticity)
      }
    }
    for (const [id, o] of Object.entries(tuning.specialistArcs.offers)) for (const c of o.categories) expect(cats.has(c), `${id} ${c}`).toBe(true)
  })

  it('specialists who come to the counter wear a look of their gender that no regular, other specialist or reserved arc character wears', () => {
    const taken = new Map(REGULARS.map((r) => [r.look, r.id]))
    for (const sp of SPECIALISTS) {
      const counter = ARCS.find((a) => a.specialist === sp.id)!.beats.some((b) => b.visit.who === sp.id && b.visit.via === 'counter')
      if (!counter) continue
      expect(sp.look, sp.id).toBeDefined()
      expect(looks.get(sp.look!), `${sp.id} ${sp.look}`).toBeDefined()
      expect(looks.get(sp.look!)!.gender, `${sp.id} ${sp.look}`).toBe(SPECIALIST_GENDER[sp.id])
      expect(RESERVED_LOOKS.has(sp.look!), `${sp.id}: ${sp.look} is reserved for an arc character`).toBe(false)
      expect(taken.get(sp.look!), `${sp.id} shares ${sp.look}`).toBeUndefined()
      taken.set(sp.look!, sp.id)
    }
  })
})

describe('specialist arcs: conditions', () => {
  it('retained N months needs both the months paid and the days on the books', () => {
    const c: Condition = { if: 'retainedMonths', id: 'jeweler', gte: 1 }
    expect(holds(c, withSp(closedOnDay(30), 'jeweler', { months: 1 }))).toBe(false) // 29 days in
    expect(holds(c, withSp(closedOnDay(31), 'jeweler', { months: 1 }))).toBe(true)
    expect(holds(c, withSp(closedOnDay(90), 'jeweler', { months: 0 }))).toBe(false) // never paid in full
    expect(holds(c, withSp(closedOnDay(90), 'jeweler', { months: 3, retained: false }))).toBe(false)
    expect(monthsRetained(withSp(closedOnDay(70), 'jeweler', { months: 3 }), 'jeweler')).toBe(2)
  })

  it('a retainer paid in full at the month end counts a month; an unpaid one does not', () => {
    const s = withSp(closedOnDay(29), 'jeweler') // 31 March
    expect(chargeExpenses(s).specialists.jeweler!.months).toBe(1)
    expect(chargeExpenses({ ...s, cash: 1_000 }).specialists.jeweler!.months).toBe(0)
  })

  it('relationship, events, arcs, stock, dates and any', () => {
    let s = withSp(closedOnDay(10), 'collector', { relationship: 0.45, events: { soundBig: 1 } })
    expect(holds({ if: 'specialist', id: 'collector', retained: true, relationship: { gte: 0.4 } }, s)).toBe(true)
    expect(holds({ if: 'specialistEvent', id: 'collector', event: 'soundBig', gte: 1 }, s)).toBe(true)
    expect(holds({ if: 'specialistEvent', id: 'collector', event: 'wrong', gte: 1 }, s)).toBe(false)
    const running: Condition = { if: 'arc', arc: 'medals', is: 'running' }
    expect(holds(running, s)).toBe(false)
    s = recordBeat(s, 'medals.roof', { day: 5, outcome: 'bought' })
    expect(holds(running, s)).toBe(true)
    expect(holds(running, endArc(s, 'medals'))).toBe(false)
    expect(holds({ if: 'arc', arc: 'medals', is: 'ended' }, endArc(s, 'medals'))).toBe(true)
    const stock: Condition = { if: 'stock', category: 'militaria', genuine: true }
    expect(holds(stock, { ...s, inventory: [item('medal_for_courage', 'fake')] })).toBe(false)
    expect(holds(stock, { ...s, inventory: [item('medal_for_courage')] })).toBe(true)
    const dec = { ...s, calendar: { ...s.calendar, date: '2014-12-24' } }
    expect(holds({ if: 'date', from: '12-20', to: '12-31' }, dec)).toBe(true)
    expect(holds({ if: 'date', from: '12-20', to: '01-05' }, { ...s, calendar: { ...s.calendar, date: '2015-01-02' } })).toBe(true)
    expect(holds({ if: 'date', from: '12-20', to: '12-31' }, s)).toBe(false)
    expect(holds({ if: 'any', of: [{ if: 'cash', gte: 1e9 }, { if: 'specialistEvent', id: 'collector', event: 'soundBig', gte: 1 }] }, s)).toBe(true)
  })
})

describe('specialist arcs: calls', () => {
  it('counts sound calls on big pieces, misses, and missed calls on pieces you buy', () => {
    const red = item('order_red_star')
    let s = withSp(closedOnDay(5), 'collector')
    s = noteCall(s, 'collector', red, 'sound')
    s = noteCall(s, 'collector', item('order_red_star', 'fake'), 'sound')
    expect(s.specialists.collector!.events).toEqual({ soundBig: 1, wrong: 1, wrongSound: 1 })
    // Bought after a missed call: wrongBought.
    const fake = item('medal_for_courage', 'fake', 'i-f')
    const s2 = { ...s, inspect: { findings: [{ id: 'f1', tool: 'specialist' as const, tellId: SPECIALIST_TELL, text: '', polarity: 'positive' as const, verdict: 'sound' as const }], toolUses: {}, estimate: null } }
    expect(noteBought(s2, fake).specialists.collector!.events.wrongBought).toBe(1)
  })

  it('a lowballed piece you bought and sold on counts as lowballSold', () => {
    const ring = item('gold_bracelet_585', 'genuine', 'i-ring')
    let s = withSp(closedOnDay(5), 'jeweler')
    s = { ...s, inventory: [ring], inspect: { findings: [{ id: 'f1', tool: 'specialist', tellId: SPECIALIST_TELL, text: '', polarity: 'negative', verdict: 'lowball' }], toolUses: {}, estimate: null } }
    s = noteBought(s, ring)
    expect(s.specialists.jeweler!.lowballed).toEqual(['i-ring'])
    s = removeSold(s, 'i-ring', 9_000)
    expect(s.specialists.jeweler!.events.lowballSold).toBe(1)
    expect(s.specialists.jeweler!.lowballed).toEqual([])
  })

  it('a real call through the toolbar records what it turned out to be', () => {
    let s = retainSpecialist(closedOnDay(3), 'collector')
    s = reducer(s, { type: 'day/open' })
    const red = item('order_red_star', 'fake')
    s = { ...s, queue: [], current: { visitId: 'v1', kind: 'seller', wants: 'sell', sale: null, customer: s.queue[0]!.customer, item: red, phase: 'inspect', line: '', elapsed: 0 }, inspect: { findings: [], toolUses: {}, estimate: null }, haggle: null }
    s = reducer(s, { type: 'inspect/useTool', tool: 'specialist' })
    const f = s.inspect!.findings.find((x) => x.tellId === SPECIALIST_TELL)!
    expect(f.verdict).toBeDefined()
    const ev = s.specialists.collector!.events
    expect(ev.wrong ?? 0).toBe(f.verdict === 'doubt' ? 0 : 1)
  })
})

describe('specialist arcs: effects', () => {
  const fx = (s: GameState, change: string, id: string, text?: string) => applyEffects(s, [{ do: 'specialist', id, change, ...(text ? { text } : {}) }], 'test')

  it('lowball, accuracy and call time changes reach the call', () => {
    const red = item('order_red_star')
    let s = withSp(closedOnDay(5), 'jeweler', { relationship: 0.6 })
    s = fx(s, 'faina.noticed', 'jeweler')
    expect(s.specialists.jeweler!.relationship).toBe(0.4)
    expect(s.specialists.jeweler!.mods.lowball).toBe(0.5)
    let z = withSp(closedOnDay(5), 'technician')
    const before = specialistOpinion(getItemDef(red.defId), red, { id: 'technician', relationship: 0.1, mods: z.specialists.technician!.mods }, new Rng(1)).accuracy
    z = fx(z, 'zhenya.slow_down', 'technician')
    const mods = z.specialists.technician!.mods
    expect(specialistCallSeconds('technician', mods)).toBe(tuning.inspect.toolSeconds.specialist)
    const after = specialistOpinion(getItemDef(red.defId), red, { id: 'technician', relationship: 0.1, mods }, new Rng(1)).accuracy
    expect(after - before).toBeCloseTo(0.08, 5)
    const slower = fx(withSp(closedOnDay(5), 'technician'), 'zhenya.across_river', 'technician')
    expect(specialistCallSeconds('technician', slower.specialists.technician!.mods)).toBe(45)
  })

  it('free months, free calls, drift and rent at the month end', () => {
    let s = withSp(closedOnDay(29), 'technician') // 31 March
    s = fx(s, 'zhenya.free_month', 'technician')
    s = fx(s, 'zhenya.desk', 'technician')
    const cash = s.cash
    const after = chargeExpenses(s)
    const sp = after.specialists.technician!
    expect(sp.months).toBe(1)
    expect(sp.mods.freeMonths).toBe(0)
    expect(after.cash - cash).toBe(-tuning.expenses.rent - tuning.expenses.utilities + 4_000)
    // Ilya: slipping each month, never under the floor; the operation puts it right and adds a call.
    let w = fx(withSp(closedOnDay(29), 'watchmaker'), 'ilya.keep', 'watchmaker')
    w = chargeExpenses(w)
    expect(w.specialists.watchmaker!.mods.accuracy).toBeCloseTo(-0.02, 5)
    w = fx(fx(w, 'ilya.advance', 'watchmaker', 'Advance'), 'ilya.restored', 'watchmaker')
    expect(w.specialists.watchmaker!.mods.accuracy).toBeUndefined()
    expect(callsLeft(w, 'watchmaker')).toBe(tuning.specialists.roster.watchmaker!.calls + 1)
    expect(w.day.log.at(-1)).toMatchObject({ kind: 'story', amount: -25_000, text: 'Advance' })
  })

  it('a sell boost makes buyers likelier while retained', () => {
    const chain = item('gold_rope_chain_585')
    const s = withSp(closedOnDay(5), 'jeweler')
    const base = sellChance(s, chain, 'wall', chain.trueValue)
    const boosted = fx(s, 'faina.book', 'jeweler', 'Book')
    expect(sellChance(boosted, chain, 'wall', chain.trueValue)).toBeCloseTo(Math.min(tuning.sell.maxChance, base * 1.3), 6)
  })

  it('release gently, retire, and a retired specialist cannot be retained', () => {
    let s = withSp(closedOnDay(40), 'watchmaker', { relationship: 0.5 })
    s = fx(s, 'ilya.let_go', 'watchmaker')
    expect(s.specialists.watchmaker).toMatchObject({ retained: false, relationship: 0.5, releasedDay: 40 })
    let f = fx(withSp(closedOnDay(40), 'jeweler'), 'faina.retire', 'jeweler')
    expect(f.specialists.jeweler).toMatchObject({ retained: false, retired: true })
    f = retainSpecialist(f, 'jeweler')
    expect(f.specialists.jeweler!.retained).toBe(false)
  })

  it('sells dead phones to Zhenya and the best medal to Gennady', () => {
    const clone = item('phone_mangosteen_m5', 'fake', 'i-clone')
    const good = item('phone_galaxia_nota3', 'genuine', 'i-good')
    let s = withSp(closedOnDay(5), 'technician')
    s = { ...s, inventory: [clone, good] }
    const cash = s.cash
    s = applyEffects(s, [{ do: 'sellTo', id: 'technician', offer: 'zhenya.parts' }], 't')
    expect(s.inventory.map((i) => i.id)).toEqual(good.condition <= 40 ? [] : ['i-good'])
    expect(s.cash - cash).toBeGreaterThanOrEqual(tuning.specialistArcs.offers['zhenya.parts']!.min)
    const medals = [item('medal_for_courage', 'genuine', 'm1'), item('order_red_star', 'genuine', 'm2'), item('order_red_star', 'fake', 'm3')]
    let g = withSp(closedOnDay(5), 'collector')
    g = applyEffects({ ...g, inventory: medals }, [{ do: 'sellTo', id: 'collector', offer: 'gennady.family' }], 't')
    expect(g.inventory.map((i) => i.id)).toEqual(['m1', 'm3'])
    expect(g.day.log.at(-1)).toMatchObject({ kind: 'sell', itemId: 'm2' })
  })

  it('a walkout takes the last ordinary person in line', () => {
    let s = reducer(closedOnDay(3), { type: 'day/open' })
    const last = s.queue.filter((v) => !v.beatId && v.kind !== 'scene').at(-1)!
    s = applyEffects(s, [{ do: 'walkout' }], 't')
    expect(s.queue.some((v) => v.visitId === last.visitId)).toBe(false)
    expect(s.day.log.at(-1)).toMatchObject({ kind: 'walkout' })
  })

  it('a boost brings its piece to some plain sellers for its days, and nothing changes without one', () => {
    let s = reducer(closedOnDay(3), { type: 'day/open' })
    let n = 0
    const all = generateDayQueue(new Rng(9), 300, (p) => `${p}b${n++}`)
    const pawners = all.filter((v) => v.wants === 'pawn')
    const sellers: QueuedVisit[] = all.filter((v) => v.wants === 'sell')
    expect(boostSellers(startBoost(s, 'plated_chains'), pawners)).toEqual(pawners)
    expect(boostSellers(s, sellers)).toEqual(sellers)
    s = startBoost(s, 'plated_chains')
    expect(s.story.boosts).toEqual([{ id: 'plated_chains', until: 3 + 13 }])
    const out = boostSellers(s, sellers)
    const swapped = out.filter((v, i) => v.item !== sellers[i]!.item)
    expect(swapped.length).toBeGreaterThan(5)
    expect(swapped.length).toBeLessThan(sellers.length * 0.25)
    for (const v of swapped) expect(v.item).toMatchObject({ defId: 'gold_rope_chain_585', fakeProfileId: 'clasp_swap', id: sellers.find((x) => x.visitId === v.visitId)!.item!.id })
    // Over after its days.
    expect(boostSellers({ ...s, calendar: { ...s.calendar, day: 17 } }, sellers)).toEqual(sellers)
  })
})

describe('specialist arcs: released specialists', () => {
  it('beats wait while they are off retainer; the last beat is skipped once they were let go mid-arc', () => {
    let s = withSp(closedOnDay(130), 'jeweler', { months: 4, sinceDay: 1, relationship: 0.6 })
    expect(eligible(s).has('faina.drop_in')).toBe(true)
    s = recordBeat(s, 'faina.drop_in', { day: 40, outcome: 'talked' })
    expect(eligible(s, 'faina.')).toEqual(new Set(['faina.chains', 'faina.book']))
    s = run(s, { type: 'specialist/release', id: 'jeweler' })
    expect([...eligible(s)].some((b) => b.startsWith('faina.'))).toBe(false)
    // Retained again, long enough: the warning plays, the customer book never does.
    s = withSp(s, 'jeweler', { ...s.specialists.jeweler!, retained: true, months: 5, sinceDay: 1, relationship: 0.6 })
    expect(eligible(s).has('faina.chains')).toBe(true)
    expect(eligible(s).has('faina.book')).toBe(false)
  })

  it('a release before the arc began does not cost the last beat', () => {
    let s = withSp(closedOnDay(130), 'jeweler', { months: 4, releasedDay: 10 })
    s = recordBeat(s, 'faina.drop_in', { day: 40, outcome: 'talked' })
    expect(eligible(s).has('faina.book')).toBe(true)
  })

  it('a retired specialist plays nothing more', () => {
    const s = withSp(closedOnDay(130), 'technician', { months: 4, retired: true })
    expect([...eligible(s)].some((b) => b.startsWith('zhenya.'))).toBe(false)
  })
})

describe('specialist arcs: first refusal', () => {
  it('Gennady rings that evening with a take-it-or-leave-it offer, and the sale goes through', () => {
    let s = withSp(closedOnDay(20), 'collector', { mods: { firstRefusal: true } })
    s = reducer(s, { type: 'day/open' })
    const red = item('order_red_star', 'genuine', 'i-red')
    const customer = s.queue[0]!.customer
    s = {
      ...s,
      queue: [],
      current: { visitId: 'v1', kind: 'seller', wants: 'sell', sale: null, customer, item: red, phase: 'offer', line: '', elapsed: 0 },
      inspect: { findings: [{ id: 'f1', tool: 'specialist', tellId: SPECIALIST_TELL, text: '', polarity: 'positive', verdict: 'sound' }], toolUses: { specialist: 1 }, estimate: null },
      haggle: { ask: 10_000, floor: 9_000, round: 1, maxRounds: 4, irritation: 0, status: 'open', history: [] },
    }
    s = run(s, { type: 'offer/acceptAsk' })
    const call = s.queue.at(-1)!
    expect(call).toMatchObject({ kind: 'buyer', via: 'phone', customer: { specialistId: 'collector' } })
    expect(call.offer).toBe(Math.round((red.trueValue * tuning.specialistArcs.firstRefusalShare) / 100) * 100 || call.offer)
    s = run(s, { type: 'counter/dismiss' }, { type: 'counter/next' })
    expect(s.current).toMatchObject({ kind: 'buyer', via: 'phone', phase: 'present', sale: { offer: call.offer, ceiling: call.offer, maxRounds: 1 } })
    const cash = s.cash
    s = run(s, { type: 'sale/accept' })
    expect(s.current!.outcome).toBe('sold')
    expect(s.cash - cash).toBe(call.offer)
    expect(s.inventory.some((i) => i.id === 'i-red')).toBe(false)
  })

  it('no first refusal, no call', () => {
    let s = withSp(closedOnDay(20), 'collector')
    s = reducer(s, { type: 'day/open' })
    s = {
      ...s,
      queue: [],
      current: { visitId: 'v1', kind: 'seller', wants: 'sell', sale: null, customer: s.queue[0]!.customer, item: item('order_red_star'), phase: 'offer', line: '', elapsed: 0 },
      inspect: { findings: [{ id: 'f1', tool: 'specialist', tellId: SPECIALIST_TELL, text: '', polarity: 'positive', verdict: 'sound' }], toolUses: {}, estimate: null },
      haggle: { ask: 10_000, floor: 9_000, round: 1, maxRounds: 4, irritation: 0, status: 'open', history: [] },
    }
    expect(run(s, { type: 'offer/acceptAsk' }).queue).toEqual([])
  })
})

/** Open days until `beatId` is in the line (moving it to the front), play it with `choice`, close up. */
function playBeat(s0: GameState, beatId: string, choice?: string): GameState {
  let s = s0
  for (let tries = 0; tries < 30; tries++) {
    s = reducer(s, { type: 'day/open' })
    const visit = s.queue.find((v) => v.beatId === beatId)
    const paper = s.market.news.some((n) => n.id === `story-${beatId}`)
    if (visit) {
      s = run({ ...s, queue: [visit], day: { ...s.day, newsRead: true } }, { type: 'counter/next' })
      for (let g = 0; g < 10 && s.current?.phase === 'scene'; g++) {
        const sc = s.current.scene!
        const last = sc.step >= sc.lines.length - 1
        s = last && sc.choices.length > 0 && !sc.chosen ? reducer(s, { type: 'scene/choose', choiceId: choice ?? sc.choices[0]!.id }) : reducer(s, { type: 'scene/next' })
      }
      return run({ ...s, queue: [] }, { type: 'counter/dismiss' }, { type: 'day/close' })
    }
    s = run({ ...s, queue: [], day: { ...s.day, newsRead: true } }, { type: 'day/close' })
    if (paper) return s
  }
  throw new Error(`${beatId} never came up`)
}

describe('specialist arcs: Zhenya, end to end', () => {
  it('biscuits and parts, the apology, the lorry warning, the repair desk', () => {
    // Retained from day 1 with the months behind her (as if each retainer was paid).
    let s = withSp(closedOnDay(32), 'technician', { months: 1 })
    const clone = item('phone_mangosteen_m5', 'fake', 'i-clone')
    s = { ...s, inventory: [...s.inventory, clone], paid: { ...s.paid, 'i-clone': 2_000 } }

    s = playBeat(s, 'zhenya.biscuits')
    expect(s.inventory.some((i) => i.id === 'i-clone')).toBe(false)
    expect(s.story.arcs.zhenya!.beats['zhenya.biscuits']!.outcome).toBe('talked')

    s = noteCall(s, 'technician', item('phone_galaxia_nota3', 'fake'), 'sound')
    s = playBeat(s, 'zhenya.oops', 'slow')
    expect(s.specialists.technician!.mods).toMatchObject({ callSeconds: tuning.inspect.toolSeconds.specialist, accuracy: 0.08 })

    s = withSp(s, 'technician', { ...s.specialists.technician!, relationship: 0.45 })
    s = playBeat(s, 'zhenya.lorry')
    expect(s.story.boosts.map((b) => b.id)).toEqual(['lorry_phones'])
    expect(s.story.flags).toContain('zhenya_warned_phones')

    s = withSp(s, 'technician', { ...s.specialists.technician!, months: 3 })
    s = { ...s, calendar: { ...s.calendar, day: Math.max(s.calendar.day, 95) } }
    s = playBeat(s, 'zhenya.desk', 'yes')
    expect(s.story.arcs.zhenya!.ended).toBe(true)
    expect(s.specialists.technician!.mods).toMatchObject({ rentIn: 4_000, callSeconds: 15, sellBoost: { categories: ['phones', 'electronics'] } })
    expect(s.story.flags).toContain('zhenya_desk')
  })
})

describe('specialist arcs: paper and cross-arc beats', () => {
  it('Ilya’s retirement lands in the paper at year end and retires him', () => {
    let s = withSp(closedOnDay(20), 'watchmaker', { months: 9 })
    s = recordBeat(s, 'ilya.granddaughter', { day: 40, outcome: 'talked' })
    s = recordBeat(s, 'ilya.eyes', { day: 70, outcome: 'talked', choice: 'keep' })
    s = recordBeat(s, 'ilya.operation', { day: 150, outcome: 'talked', choice: 'refuse' })
    s = { ...s, calendar: { ...s.calendar, day: 293, date: '2014-12-20', weekday: weekdayOf('2014-12-20') } }
    s = reducer(s, { type: 'day/open' })
    expect(s.market.news.find((n) => n.id === 'story-ilya.retires')).toMatchObject({ id: 'story-ilya.retires', headline: 'Watchmaker closes his Kanal Street bench' })
    expect(s.day.newsRead).toBe(false)
    expect(s.specialists.watchmaker).toMatchObject({ retained: false, retired: true })
    expect(s.story.arcs.ilya!.ended).toBe(true)
  })

  it('Gennady tells Kolya’s story only while the grandmother’s arc is running', () => {
    let s = withSp(closedOnDay(20), 'collector')
    expect(eligible(s).has('gennady.kolya')).toBe(false)
    s = recordBeat(s, 'medals.roof', { day: 10, outcome: 'bought' })
    expect(eligible(s).has('gennady.kolya')).toBe(true)
    expect(eligible(endArc(s, 'medals')).has('gennady.kolya')).toBe(false)
  })

  it('Stanislav offers a word only while Protection runs (protection.running)', () => {
    let s = withSp(closedOnDay(80), 'antiquary', { months: 2, relationship: 0.5 })
    s = recordBeat(s, 'stanislav.card', { day: 40, outcome: 'talked' })
    expect(eligible(s).has('stanislav.word')).toBe(false)
    s = applyEffects(s, [{ do: 'flag', flag: 'protection.running' }], 'protection')
    expect(eligible(s).has('stanislav.word')).toBe(true)
  })

  it('a specialist at the counter or on the phone is themselves', () => {
    expect(specialistCustomer('watchmaker')).toMatchObject({ name: 'Ilya Semyonovich Brodsky', specialistId: 'watchmaker', portraitKey: 'male_adult_03' })
    expect(specialistCustomer('nobody')).toBeNull()
  })
})

describe('save v6', () => {
  it('migrates v5 specialist records (months from billing days since sinceDay) and adds story boosts', () => {
    const v6 = startedState(3, 'mig')
    const { boosts: _b, ...story5 } = v6.story
    const v5 = {
      ...v6,
      meta: { ...v6.meta, version: 5 },
      calendar: { ...v6.calendar, day: 40, date: '2014-04-11' },
      specialists: { jeweler: { retained: true, relationship: 0.25, callsUsed: 2, sinceDay: 1 }, watchmaker: { retained: false, relationship: 0, callsUsed: 0, sinceDay: 0 } },
      story: story5,
    }
    const out = migrate(JSON.parse(JSON.stringify(v5)))
    expect(out.meta.version).toBe(6)
    expect(out.specialists.jeweler).toEqual({ retained: true, relationship: 0.25, callsUsed: 2, sinceDay: 1, months: 1, events: {}, mods: {}, lowballed: [] })
    expect(out.specialists.watchmaker!.months).toBe(0)
    expect(out.story.boosts).toEqual([])
  })
})
