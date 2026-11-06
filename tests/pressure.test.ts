/**
 * M5 Protection arc, second half (src/data/stories/protection.ts, src/game/crime/vandalism.ts):
 * the refuser's ladder (asks properly → brick → window → ultimatum → the street, or out),
 * Stanislav's word holding it, the payer's side (less shoplifting, the crew's deliveries,
 * the box), and the ending axes both ways.
 */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { atDay, beatAtCounter, choose, eligible, readScene, run } from './storyHelpers'
import { reducer } from '../src/game/actions'
import type { GameState } from '../src/game/state'
import { tuning } from '../src/data/tuning'
import { getBeat } from '../src/data/stories'
import { PROTECTION_FLAGS as F } from '../src/data/stories/protection'
import { vandalismLines } from '../src/data/vandalismLines'
import { BRICK, GLAZIER, caseBroken, runCrimeEvents } from '../src/game/crime/vandalism'
import { chargeExpenses } from '../src/game/economy/expenses'
import { adjustRep, repOf } from '../src/game/reputation'
import { placeItem, displayed } from '../src/game/shop/display'
import { theftChance } from '../src/game/shop/theft'
import { allHold } from '../src/game/story/conditions'
import { recordBeat } from '../src/game/story/progress'
import type { DaySummary } from '../src/game/types'

const P = tuning.protection
const L = P.ladder
const flags = (s: GameState) => s.story.flags

/** Play a scene beat at the counter on `day`, answering `choiceId` (if it has a choice). */
function play(s: GameState, beatId: string, day: number, choiceId?: string): GameState {
  let t = beatAtCounter(s, beatId, day)
  t = choiceId ? choose(t, choiceId) : readScene(t)
  for (let i = 0; i < 10 && t.current?.phase === 'scene'; i++) t = reducer(t, { type: 'scene/next' })
  expect(t.current?.outcome, beatId).toBe('talked')
  return reducer(t, { type: 'counter/dismiss' })
}

/** The morning after: close up (nobody at the counter) and open on the next day. */
const nextMorning = (s: GameState, day = s.calendar.day + 1) => reducer(atDay(s, day), { type: 'day/open' })

/** Refused on day 10, held out through the glue (police, day 13) and heard the bakery story (day 18). */
function warned(seed = 4): GameState {
  let s = play(atDay(startedState(seed, 'press'), 3), 'protection.asking', 3, 'gone')
  s = play(s, 'protection.offer', 10, 'refuse')
  s = play(s, 'protection.glue', 13, 'police')
  return play(s, 'protection.bakery', 18)
}

/** The counter case full of the starting stock. */
function stocked(s: GameState): GameState {
  const slots = s.shop.slots.filter((x) => x.area === 'counter')
  s.inventory.slice(0, slots.length).forEach((item, i) => (s = placeItem(s, item.id, slots[i]!.id)))
  return s
}

const ASKED = 18 + L.properlyAfter

/** He asked properly, and you said no (the brick is scheduled for tonight). */
function refusedProperly(seed = 4): GameState {
  return play(stocked(warned(seed)), 'protection.properly', ASKED, 'refuse')
}

/** Refused the window too, and the ultimatum on day `ASKED + 3 + 14`. */
function refusedUltimatum(): GameState {
  let s = refusedProperly()
  s = play(s, 'protection.window', ASKED + L.windowAfter, 'refuse')
  return play(s, 'protection.ultimatum', ASKED + L.windowAfter + L.ultimatumAfter, 'refuse')
}
const SETTLED = ASKED + L.windowAfter + L.ultimatumAfter + L.settleAfter

/** Four mornings from `day` (nobody served in between), stopping when the career ends. */
function mornings(s: GameState, day: number): GameState[] {
  const out: GameState[] = []
  for (let d = day; d < day + 4 && !s.career.end; d++) out.push((s = nextMorning(s, d)))
  return out
}

describe('Protection ladder: when it climbs', () => {
  it('the pressure condition reads the dial', () => {
    const s = warned()
    expect(s.crime.pressure).toBeCloseTo(P.pressure.asked + P.pressure.refused + P.pressure.gluePolice + P.pressure.bakery)
    expect(allHold([{ if: 'pressure', gte: 0.5 }], s)).toBe(true)
    expect(allHold([{ if: 'pressure', gte: 0.6 }], s)).toBe(false)
  })

  it('asks properly a month after the bakery, and only once the pressure is up', () => {
    const s = warned()
    expect(eligible(atDay(s, ASKED - 1), 'protection.properly')).toBe(false)
    expect(eligible(atDay(s, ASKED), 'protection.properly')).toBe(true)
    const calm = { ...s, crime: { ...s.crime, pressure: L.properlyAt - 0.01 } }
    expect(eligible(atDay(calm, ASKED), 'protection.properly')).toBe(false)
  })

  it('Stanislav’s word holds the ladder for a month, then it climbs again', () => {
    const word = 20
    let s = recordBeat(warned(), 'stanislav.word', { day: word, outcome: 'talked', choice: 'accept' })
    s = { ...s, story: { ...s.story, flags: [...s.story.flags, F.stanislavWord] } }
    expect(eligible(atDay(s, word + L.wordDays - 1), 'protection.properly')).toBe(false)
    expect(eligible(atDay(s, word + L.wordDays), 'protection.properly')).toBe(true)
    // And his word takes the heat out of it.
    const effects = getBeat('stanislav.word')!.visit.scene!.choices!.find((c) => c.id === 'accept')!.effects
    expect(effects).toContainEqual({ do: 'pressure', delta: P.pressure.stanislavWord })
  })

  it('paying at “properly” starts the charge and closes the ladder', () => {
    const s = play(warned(), 'protection.properly', ASKED, 'pay')
    expect(flags(s)).toContain(F.paying)
    expect(flags(s)).not.toContain(F.refused)
    expect(s.crime.events.some((e) => e.kind === BRICK)).toBe(false)
    expect(eligible(atDay(s, ASKED + 10), 'protection.window')).toBe(false)
  })
})

describe('Protection ladder: the brick', () => {
  it('refusing schedules it for tonight, and counts toward clean', () => {
    const before = stocked(warned())
    const s = play(before, 'protection.properly', ASKED, 'refuse')
    expect(s.crime.events).toContainEqual({ day: ASKED, kind: BRICK })
    expect(s.career.axes.clean - before.career.axes.clean).toBeCloseTo(tuning.axes.protectionRefused)
    expect(repOf(s, 'mob') - repOf(before, 'mob')).toBeCloseTo(P.rep.properlyRefused)
  })

  it('next morning: glass on the floor, at most one piece gone, others marked, the case open', () => {
    for (const seed of [4, 5, 6, 7, 8, 9]) {
      const night = refusedProperly(seed)
      const inCase = displayed(night).filter((d) => d.area === 'counter')
      expect(inCase.length).toBeGreaterThan(1)
      const s = nextMorning(night)
      expect(s.narration?.startsWith(vandalismLines.brick.morning), `seed ${seed}`).toBe(true)
      // The paper has it from this morning (on a busy morning for stories, a day or two later).
      expect(eligible(atDay(night, ASKED + 1), 'protection.brick_news')).toBe(true)
      const gone = inCase.filter((d) => !s.inventory.some((i) => i.id === d.item.id))
      expect(gone.length).toBeLessThanOrEqual(1)
      expect(s.stats.itemsStolen - night.stats.itemsStolen).toBe(gone.length)
      for (const d of inCase) {
        const now = s.inventory.find((i) => i.id === d.item.id)
        if (now && now.condition < d.item.condition) {
          expect(now.condition).toBe(Math.max(P.brick.minCondition, d.item.condition - P.brick.damage))
          expect(now.trueValue).toBeLessThanOrEqual(d.item.trueValue)
        }
      }
      expect(s.crime.events).toContainEqual({ day: ASKED + 1 + P.brick.repairDays, kind: GLAZIER })
      expect(caseBroken(s)).toBe(true)
      expect(s.crime.events.some((e) => e.kind === BRICK)).toBe(false)
    }
  })

  it('across seeds, the glass marks something and someone reaches in now and then', () => {
    let marked = 0
    let taken = 0
    for (let seed = 1; seed <= 30; seed++) {
      const night = refusedProperly(seed)
      const s = nextMorning(night)
      marked += s.day.log.filter((e) => e.kind === 'story' && e.itemId).length
      taken += s.day.log.filter((e) => e.kind === 'theft').length
    }
    expect(marked).toBeGreaterThan(0)
    expect(taken).toBeGreaterThan(0)
    expect(taken).toBeLessThan(30)
  })

  it('draws from its own stream: the day’s walk-ins and the game Rng are the same with or without it', () => {
    const night = refusedProperly()
    const without = { ...night, crime: { ...night.crime, events: night.crime.events.filter((e) => e.kind !== BRICK) } }
    const a = nextMorning(night)
    const b = nextMorning(without)
    expect(a.meta.rng).toEqual(b.meta.rng)
    expect(a.queue).toEqual(b.queue)
    expect(nextMorning(night)).toEqual(a)
  })

  it('while the glass is out the counter case is as easy to steal from as anywhere', () => {
    const s = nextMorning(refusedProperly())
    const piece = displayed(s).find((d) => d.area === 'counter')!
    const fixed = { ...s, crime: { ...s.crime, events: s.crime.events.filter((e) => e.kind !== GLAZIER) } }
    expect(theftChance(fixed, piece.item, 'counter')).toBe(0)
    expect(theftChance(s, piece.item, 'counter')).toBeGreaterThan(0)
  })

  it('cardboard until the glazier, then his bill and new glass', () => {
    const morning = nextMorning(refusedProperly())
    const between = nextMorning(morning)
    expect(between.narration?.startsWith(vandalismLines.brick.open)).toBe(true)
    expect(caseBroken(between)).toBe(true)
    const due = nextMorning(between)
    expect(due.calendar.day).toBe(ASKED + 1 + P.brick.repairDays)
    expect(caseBroken(due)).toBe(false)
    expect(due.day.log).toContainEqual({ kind: 'expense', amount: -P.brick.glazier, text: vandalismLines.brick.glazier })
    expect(due.cash).toBe(between.cash - P.brick.glazier)
    expect(runCrimeEvents(due).state).toBe(due)
  })
})

describe('Protection ladder: the window, the ultimatum, the end', () => {
  it('the window comes a few days after the brick; the ultimatum two weeks later, if the pressure is up', () => {
    let s = refusedProperly()
    expect(eligible(atDay(s, ASKED + L.windowAfter - 1), 'protection.window')).toBe(false)
    expect(eligible(atDay(s, ASKED + L.windowAfter), 'protection.window')).toBe(true)
    s = play(s, 'protection.window', ASKED + L.windowAfter, 'refuse')
    const day = ASKED + L.windowAfter + L.ultimatumAfter
    expect(s.crime.pressure).toBeGreaterThanOrEqual(L.ultimatumAt)
    expect(eligible(atDay(s, day - 1), 'protection.ultimatum')).toBe(false)
    expect(eligible(atDay(s, day), 'protection.ultimatum')).toBe(true)
    const calm = { ...s, crime: { ...s.crime, pressure: L.ultimatumAt - 0.01 } }
    expect(eligible(atDay(calm, day), 'protection.ultimatum')).toBe(false)
  })

  it('paying the ultimatum costs the back pay and starts the charge', () => {
    let s = refusedProperly()
    s = play(s, 'protection.window', ASKED + L.windowAfter, 'refuse')
    const day = ASKED + L.windowAfter + L.ultimatumAfter
    const open = reducer(atDay(s, day), { type: 'day/open' })
    const paid = play(s, 'protection.ultimatum', day, 'pay')
    expect(paid.cash).toBe(open.cash - P.backPay)
    expect(flags(paid)).toContain(F.paying)
    expect(eligible(atDay(paid, day + L.settleAfter), 'protection.out')).toBe(false)
  })

  it('refusing it: a week later, the paper says the shop is to close, and the career ends', () => {
    const s = refusedUltimatum()
    expect(flags(s)).toContain(F.lastRefused)
    expect(repOf(s, 'neighbourhood')).toBeLessThan(L.streetStands)
    expect(nextMorning(s, SETTLED - 1).career.end).toBeNull()
    expect(eligible(atDay(s, SETTLED), 'protection.out')).toBe(true)
    // Up to two beats a morning: on a busy one the paper waits a day or two.
    const out = mornings(s, SETTLED).find((m) => m.career.end)!
    expect(out.career.end).toEqual({ kind: 'pushedOut', day: out.calendar.day })
    expect(out.calendar.day - SETTLED).toBeLessThanOrEqual(3)
    expect(flags(out)).toContain(F.pushedOut)
    expect(out.story.arcs.protection?.ended).toBe(true)
  })

  it('unless the street stands with you: then Eduard Lvovich gives up, and the arc ends clean', () => {
    const s = adjustRep(refusedUltimatum(), 'neighbourhood', L.streetStands + 0.05, 'test')
    const days = mornings(s, SETTLED)
    for (const m of days) expect(m.career.end, `day ${m.calendar.day}`).toBeNull()
    expect(days.some((m) => m.queue.some((q) => q.beatId === 'protection.street'))).toBe(true)
    const t = play(s, 'protection.street', SETTLED)
    expect(t.career.end).toBeNull()
    expect(flags(t)).toContain(F.heldOut)
    expect(t.story.arcs.protection?.ended).toBe(true)
    expect(t.career.axes.clean - s.career.axes.clean).toBeCloseTo(tuning.axes.protectionHeldOut)
    expect(t.crime.pressure).toBeLessThan(s.crime.pressure)
    expect(eligible(atDay(t, SETTLED + 1), 'protection.out')).toBe(false)
  })
})

/** Accepted on day 10 (seed 4): paying from then on. */
function paying(seed = 4): GameState {
  const s = play(atDay(startedState(seed, 'press'), 3), 'protection.asking', 3, 'gone')
  return play(s, 'protection.offer', 10, 'accept')
}

const dayOf = (day: number, earned: number): DaySummary => ({
  day, openingCash: 0, closingCash: 0, bought: 0, spent: 0, sold: 0, earned, walkouts: 0, expenses: 0, loaned: 0, redeemed: 0,
})

describe('Protection: paying', () => {
  it('each month’s envelope counts dirty and keeps the crew sweet', () => {
    const s = paying()
    const end = { ...s, calendar: { ...s.calendar, day: 29, date: '2014-03-31' }, history: [dayOf(15, 100_000)], day: { ...s.day, phase: 'open' as const, log: [] } }
    const charged = chargeExpenses(end)
    expect(charged.career.axes.clean - end.career.axes.clean).toBeCloseTo(tuning.axes.protectionPaid)
    expect(repOf(charged, 'mob') - repOf(end, 'mob')).toBeCloseTo(P.rep.monthPaid)
  })

  it('the street’s kids leave a paying shop alone (mostly)', () => {
    const s = paying()
    const piece = s.inventory[0]!
    const notPaying = { ...s, story: { ...s.story, flags: s.story.flags.filter((f) => f !== F.paying) } }
    expect(theftChance(s, piece, 'wall')).toBeCloseTo(theftChance(notPaying, piece, 'wall') * P.paidTheftScale)
  })

  it('the crew’s deliveries start after the first ten days of paying, a fortnight apart', () => {
    const s = paying()
    expect(eligible(atDay(s, 10 + P.delivery.firstAfter - 1), 'protection.delivery_phones')).toBe(false)
    expect(eligible(atDay(s, 10 + P.delivery.firstAfter), 'protection.delivery_phones')).toBe(true)
    expect(eligible(atDay(s, 40), 'protection.delivery_camera')).toBe(false)
    const refused = play(play(atDay(startedState(4, 'press'), 3), 'protection.asking', 3, 'gone'), 'protection.offer', 10, 'refuse')
    expect(eligible(atDay(refused, 40), 'protection.delivery_phones')).toBe(false)
  })

  it('a delivery opens at half the usual ask; buying it is stolen, dirty, and noticed', () => {
    const day = 10 + P.delivery.firstAfter
    const at = readScene(beatAtCounter(paying(), 'protection.delivery_phones', day))
    expect(at.current?.phase).toBe('present')
    expect(at.current?.item?.provenance).toBe('stolen')
    const plain = { ...at, current: { ...at.current!, beatId: undefined } }
    // The same visit and the same draws, with and without the beat's anchor: compare the opening asks.
    const ask = (s: GameState) =>
      run(s, { type: 'counter/inspect' }, { type: 'inspect/done' }, { type: 'offer/make', amount: 1, approach: 'straight' }).haggle!.ask
    const cheapAsk = ask(at)
    expect(cheapAsk / ask(plain)).toBeGreaterThan(P.delivery.anchor - 0.05)
    expect(cheapAsk / ask(plain)).toBeLessThan(P.delivery.anchor + 0.05)
    const cheap = run(at, { type: 'counter/inspect' }, { type: 'inspect/done' }, { type: 'offer/make', amount: cheapAsk, approach: 'straight' })
    expect(at.cash - cheap.cash).toBe(cheapAsk)
    const done = reducer(cheap, { type: 'counter/dismiss' })
    expect(done.crime.heat - at.crime.heat).toBeCloseTo(P.delivery.heat)
    expect(done.career.axes.clean).toBeLessThan(at.career.axes.clean)
    expect(done.story.arcs.protection?.beats['protection.delivery_phones']?.outcome).toBe('bought')
  })

  it('keeping the box pays, and dirties the shop', () => {
    let s = play(paying(), 'protection.box', 31)
    expect(flags(s)).toContain(F.boxAsked)
    const before = s
    s = play(s, 'protection.box_answer', 36, 'keep')
    expect(flags(s)).toEqual(expect.arrayContaining([F.boxKept, 'dirty.protection_box']))
    expect(s.crime.heat - before.crime.heat).toBeCloseTo(P.box.heat)
    expect(s.career.axes.clean).toBeLessThan(before.career.axes.clean)
  })
})
