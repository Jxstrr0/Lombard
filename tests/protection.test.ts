/**
 * M4 Protection arc, first half (src/data/stories/protection.ts): the beats'
 * order and both branches, and the monthly "insurance" charge
 * (src/game/economy/expenses.ts) once you accept.
 */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { reducer, type Action } from '../src/game/actions'
import type { GameState } from '../src/game/state'
import { tuning } from '../src/data/tuning'
import { CAST } from '../src/data/customers/cast'
import { getRegular } from '../src/data/regulars'
import { getBeat } from '../src/data/stories'
import { PROTECTION_FLAGS as F } from '../src/data/stories/protection'
import { chargeExpenses, monthTakings, protectionFee, upcomingBills } from '../src/game/economy/expenses'
import { repOf } from '../src/game/reputation'
import { allHold } from '../src/game/story/conditions'
import { pickBeats, regularCustomer } from '../src/game/story/plan'
import { beatRecord } from '../src/game/story/progress'
import type { DaySummary, QueuedVisit } from '../src/game/types'

const P = tuning.protection
const run = (s: GameState, ...actions: Action[]) => actions.reduce(reducer, s)
const onDay = (s: GameState, day: number): GameState => ({ ...s, calendar: { ...s.calendar, day } })
/** The beat's conditions hold and it hasn't played. */
const can = (s: GameState, beatId: string) => allHold(getBeat(beatId)!.when, s) && !beatRecord(s, beatId)
const flags = (s: GameState) => s.story.flags

/** Play a beat's scene at the counter on the state's day, picking `choiceId` on its last line. */
function playBeat(s: GameState, beatId: string, choiceId?: string): GameState {
  const beat = getBeat(beatId)!
  const open = s.day.phase === 'open' ? s : reducer(s, { type: 'day/open' })
  const visit = {
    visitId: `v-${beatId}`,
    kind: 'scene',
    customer: regularCustomer(getRegular(beat.visit.who)!),
    patience: tuning.story.patience,
    beatId,
    line: beat.visit.scene?.lines[0],
  } as QueuedVisit
  let t = run({ ...open, queue: [visit, ...open.queue] }, { type: 'counter/next' })
  expect(t.current?.beatId).toBe(beatId)
  for (let i = 0; i < 10 && t.current?.phase === 'scene'; i++) {
    const sc = t.current.scene!
    const last = sc.step >= sc.lines.length - 1
    t = last && !sc.chosen && sc.choices.length > 0 ? run(t, { type: 'scene/choose', choiceId: choiceId! }) : run(t, { type: 'scene/next' })
  }
  expect(t.current?.outcome).toBe('talked')
  return run(t, { type: 'counter/dismiss' })
}

/** Days 3 and 10: Zhora asks for Gusev, then Eduard Lvovich makes the offer and gets this answer. */
function offered(choice: 'accept' | 'haggle' | 'refuse', seed = 4): GameState {
  let s = playBeat(onDay(startedState(seed, 'prot'), 3), 'protection.asking', 'gone')
  s = playBeat(onDay(s, 10), 'protection.offer', choice)
  return s
}

/** A closed day of trading for the history. */
function dayOf(day: number, earned: number, spent = 0, redeemed = 0, loaned = 0): DaySummary {
  return { day, openingCash: 0, closingCash: 0, bought: 0, spent, sold: 0, earned, walkouts: 0, expenses: 0, loaned, redeemed }
}

/** The state as it closes on 31 March (career day 29), with this month's history. */
function monthEnd(s: GameState, history: DaySummary[]): GameState {
  return { ...s, calendar: { ...s.calendar, day: 29, date: '2014-03-31' }, history, day: { ...s.day, phase: 'open', log: [] } }
}

describe('Protection: content', () => {
  it('the two men are regulars with the tough-looking regular-only looks, and arc-only', () => {
    const eduard = getRegular('eduard')!
    const zhora = getRegular('zhora')!
    expect(eduard.look).toBe('male_adult_20')
    expect(zhora.look).toBe('male_adult_11')
    for (const r of [eduard, zhora]) {
      expect(CAST.find((c) => c.id === r.look)?.regular).toBe(true)
      expect(r.schedule).toBeUndefined()
    }
  })

  it('every flag the arc sets is one of its named flags', () => {
    const named = new Set<string>(Object.values(F))
    const raw = JSON.stringify(['asking', 'offer', 'glue', 'bakery', 'box', 'box_late'].map((b) => getBeat(`protection.${b}`)))
    for (const m of raw.matchAll(/"flag":"([^"]+)"/g)) expect(named.has(m[1]!), m[1]).toBe(true)
  })
})

describe('Protection: week 1, someone asks after Gusev', () => {
  it('Zhora can come in from day 3, not before', () => {
    const s = startedState(1, 'prot')
    expect(can(onDay(s, 2), 'protection.asking')).toBe(false)
    expect(can(onDay(s, 3), 'protection.asking')).toBe(true)
    let seen = 0
    for (let seed = 1; seed <= 40; seed++) if (pickBeats(onDay(startedState(seed, 'prot'), 3)).some((b) => b.id === 'protection.asking')) seen++
    expect(seen).toBeGreaterThan(8)
    expect(seen).toBeLessThan(32)
  })

  it('his visit records the debt and puts the shop on their map', () => {
    const s = playBeat(onDay(startedState(2, 'prot'), 4), 'protection.asking', 'not_mine')
    expect(beatRecord(s, 'protection.asking')).toMatchObject({ day: 4, outcome: 'talked', choice: 'not_mine' })
    expect(flags(s)).toContain(F.debt)
    expect(flags(s)).not.toContain(F.running)
    expect(s.crime.pressure).toBeCloseTo(P.pressure.asked)
  })
})

describe('Protection: week 2–3, the offer', () => {
  it('comes at least five days after Zhora, and not before day 9', () => {
    const s = playBeat(onDay(startedState(3, 'prot'), 3), 'protection.asking', 'gone')
    expect(can(onDay(s, 7), 'protection.offer')).toBe(false)
    expect(can(onDay(s, 8), 'protection.offer')).toBe(false)
    expect(can(onDay(s, 9), 'protection.offer')).toBe(true)
    const late = playBeat(onDay(startedState(3, 'prot'), 6), 'protection.asking', 'gone')
    expect(can(onDay(late, 10), 'protection.offer')).toBe(false)
    expect(can(onDay(late, 11), 'protection.offer')).toBe(true)
  })

  it('whatever you answer, the arc is running', () => {
    for (const choice of ['accept', 'haggle', 'refuse'] as const) {
      expect(flags(offered(choice)), choice).toContain(F.running)
      expect(flags(offered(choice)), choice).not.toContain(F.boxAsked)
    }
  })
})

describe('Protection: accepting', () => {
  it('sets paying, warms the mob, and leaves the refusal beats closed', () => {
    const s = offered('accept')
    expect(flags(s)).toContain(F.paying)
    expect(flags(s)).not.toContain(F.haggled)
    expect(flags(s)).not.toContain(F.refused)
    expect(repOf(s, 'mob')).toBeCloseTo(P.rep.accepted)
    expect(s.crime.pressure).toBeCloseTo(P.pressure.asked + P.pressure.accepted)
    expect(can(onDay(s, 40), 'protection.glue')).toBe(false)
  })

  it('charges the share of the month’s net takings with the rent, at month end', () => {
    const s = offered('accept')
    // 140k sold + 10k redeemed − 60k bought − 20k lent = 70k net → 10% = 7,000. February (day 0 and before) doesn't count.
    const fair = monthEnd(s, [dayOf(-2, 500_000), dayOf(10, 60_000, 30_000), dayOf(20, 80_000, 30_000, 10_000, 20_000)])
    expect(monthTakings(fair)).toBe(70_000)
    expect(protectionFee(fair)).toEqual({ amount: Math.round(70_000 * P.share), share: P.share, minimum: false })
    const charged = chargeExpenses(fair)
    const entry = charged.day.log.find((e) => e.text.startsWith('Insurance'))!
    expect(entry).toMatchObject({ kind: 'expense', amount: -Math.round(70_000 * P.share) })
    expect(entry.text).toContain('March')
    const bills = tuning.expenses.rent + tuning.expenses.utilities
    expect(charged.cash).toBe(fair.cash - bills - Math.round(70_000 * P.share))
  })

  it('never less than the minimum, and nothing before month end', () => {
    const s = offered('accept')
    const slow = monthEnd(s, [dayOf(12, 5_000, 20_000)])
    const charged = chargeExpenses(slow)
    expect(charged.day.log.find((e) => e.text.startsWith('Insurance'))?.amount).toBe(-P.minimum)
    expect(chargeExpenses(s)).toBe(s) // day 10 is not a billing day
  })

  it('is charged when the day closes on the last of the month, and shows in upcoming bills', () => {
    let s = offered('accept')
    expect(upcomingBills(s).find((b) => b.label === 'Insurance')?.amount).toBeGreaterThanOrEqual(P.minimum)
    s = monthEnd(s, [dayOf(15, 100_000, 20_000)])
    s = { ...s, queue: [], current: null }
    const closed = run(s, { type: 'day/close' })
    expect(closed.calendar.date).toBe('2014-04-01')
    const summary = closed.history.at(-1)!
    expect(summary.day).toBe(29)
    expect(summary.expenses).toBe(tuning.expenses.rent + tuning.expenses.utilities + Math.round(80_000 * P.share))
  })

  it('the haggled rate is lower and the mob a little cooler', () => {
    const s = offered('haggle')
    expect(flags(s)).toEqual(expect.arrayContaining([F.paying, F.haggled]))
    expect(repOf(s, 'mob')).toBeCloseTo(P.rep.haggled)
    const fee = protectionFee(monthEnd(s, [dayOf(15, 100_000)]))
    expect(fee).toEqual({ amount: Math.round(100_000 * P.haggledShare), share: P.haggledShare, minimum: false })
  })

  it('ends this half three weeks on with the favour: a box off the books, no answer yet', () => {
    const s = offered('accept')
    expect(can(onDay(s, 30), 'protection.box')).toBe(false)
    expect(can(onDay(s, 31), 'protection.box')).toBe(true)
    const t = playBeat(onDay(s, 31), 'protection.box')
    expect(flags(t)).toContain(F.boxAsked)
    expect(t.story.arcs.protection?.ended).toBeFalsy()
    expect(flags(t)).toContain(F.paying)
  })
})

describe('Protection: refusing', () => {
  it('cools the mob, raises pressure and costs nothing at month end', () => {
    const s = offered('refuse')
    expect(flags(s)).toContain(F.refused)
    expect(flags(s)).not.toContain(F.paying)
    expect(repOf(s, 'mob')).toBeCloseTo(P.rep.refused)
    expect(s.crime.pressure).toBeCloseTo(P.pressure.asked + P.pressure.refused)
    expect(protectionFee(s)).toBeNull()
    const charged = chargeExpenses(monthEnd(s, [dayOf(15, 100_000)]))
    expect(charged.day.log.some((e) => e.text.startsWith('Insurance'))).toBe(false)
    expect(can(onDay(s, 40), 'protection.box')).toBe(false)
  })

  it('three days on, glue in the lock: the locksmith is paid whatever you say', () => {
    const s = offered('refuse')
    expect(can(onDay(s, 12), 'protection.glue')).toBe(false)
    expect(can(onDay(s, 13), 'protection.glue')).toBe(true)
    expect(getBeat('protection.glue')!.visit.first).toBe(true)
    const t = playBeat(onDay(s, 13), 'protection.glue', 'refuse')
    expect(t.day.log.find((e) => e.kind === 'story')).toMatchObject({ amount: -P.locksmith })
    expect(t.cash).toBe(reducer(onDay(s, 13), { type: 'day/open' }).cash - P.locksmith)
    expect(s.crime.pressure + P.pressure.glueRefused).toBeCloseTo(t.crime.pressure)
  })

  it('holding out brings the bakery story and the threat to “ask properly”', () => {
    let s = playBeat(onDay(offered('refuse'), 13), 'protection.glue', 'police')
    expect(flags(s)).toContain(F.toldPolice)
    expect(repOf(s, 'mob')).toBeCloseTo(P.rep.refused + P.rep.gluePolice)
    expect(can(onDay(s, 17), 'protection.bakery')).toBe(false)
    expect(can(onDay(s, 18), 'protection.bakery')).toBe(true)
    s = playBeat(onDay(s, 18), 'protection.bakery')
    expect(flags(s)).toContain(F.warned)
    expect(s.story.arcs.protection?.ended).toBeFalsy()
    expect(protectionFee(s)).toBeNull()
  })

  it('paying after the glue starts the charge at the full rate and leads to the favour', () => {
    let s = playBeat(onDay(offered('refuse'), 13), 'protection.glue', 'pay')
    expect(flags(s)).toContain(F.paying)
    expect(flags(s)).not.toContain(F.refused)
    expect(can(onDay(s, 25), 'protection.bakery')).toBe(false)
    expect(protectionFee(monthEnd(s, [dayOf(15, 100_000)]))?.share).toBe(P.share)
    expect(can(onDay(s, 30), 'protection.box_late')).toBe(false)
    expect(can(onDay(s, 31), 'protection.box_late')).toBe(true)
    s = playBeat(onDay(s, 31), 'protection.box_late')
    expect(flags(s)).toContain(F.boxAsked)
  })
})
