import { describe, expect, it } from 'vitest'
import { getItemDef } from '../src/data/items'
import { tuning } from '../src/data/tuning'
import { reducer, type Action } from '../src/game/actions'
import { claimedValue } from '../src/game/appraise/value'
import { generateDayQueue, generateWalkIn } from '../src/game/customers/walkins'
import { amountDue, createLoan, forfeitOverdue, loanTerms, pawnChance, planRedemptions, redeemChance } from '../src/game/loans/loans'
import { Rng } from '../src/game/rng'
import type { GameState } from '../src/game/state'
import type { ItemInstance, Loan, WalkIn } from '../src/game/types'
import { playScene, startedState } from './helpers'

const T = tuning.loans
const run = (s: GameState, ...actions: Action[]) => actions.reduce(reducer, s)

/** Open the shop with the first customer forced to be a pawner, and take them to the offer pad. */
function pawnerAtOffer(seed: number): GameState {
  let s = reducer(startedState(seed, 'loans'), { type: 'day/open' })
  // Day 1 has no buyers or redeemers; the first visit is a seller.
  const [first, ...rest] = s.queue
  s = { ...s, queue: [{ ...first!, wants: 'pawn', line: 'Just until payday.' }, ...rest] }
  return run(s, { type: 'counter/next' }, { type: 'counter/inspect' }, { type: 'inspect/done' }, { type: 'offer/estimate', value: 10_000 })
}

/** Lend generously so any sane haggle accepts. */
function pawnFirst(seed: number): GameState {
  const s = pawnerAtOffer(seed)
  const item = s.current!.item!
  const amount = Math.min(s.cash, Math.max(100, claimedValue(getItemDef(item.defId), item)))
  return reducer(s, { type: 'offer/make', amount, approach: 'straight' })
}

/** Serve the rest of today (pass sellers/buyers, pay off redeemers), close, return the closed state. */
function finishDay(s0: GameState, onRedeem?: (s: GameState) => void): GameState {
  let s = s0
  if (s.current?.phase === 'resolved') s = reducer(s, { type: 'counter/dismiss' })
  for (let guard = 0; guard < 100 && s.queue.length > 0; guard++) {
    s = reducer(s, { type: 'counter/next' })
    s = playScene(s)
    if (s.current?.kind === 'redeem') {
      onRedeem?.(s)
      s = reducer(s, { type: 'loan/return' })
    } else if (s.current?.phase !== 'resolved') s = reducer(s, { type: 'counter/pass' })
    s = reducer(s, { type: 'counter/dismiss' })
  }
  return reducer(s, { type: 'day/close' })
}

const customer = (over: Partial<WalkIn> = {}): WalkIn => ({
  id: 'c1',
  name: 'Galina',
  archetype: 'pensioner',
  temperament: 'flexible',
  knowledge: 0.5,
  desperation: 0.5,
  portraitKey: 'pensioner',
  ...over,
})

const item = (over: Partial<ItemInstance> = {}): ItemInstance => ({
  id: 'i1',
  defId: getItemDef('gold_band_583').id,
  condition: 70,
  authenticity: 'genuine',
  provenance: 'unknown',
  trueValue: 20_000,
  revealed: [],
  story: 'It was my mother’s.',
  ...over,
})

const loan = (over: Partial<Loan> = {}): Loan => ({
  id: 'l1',
  item: item(),
  customer: customer(),
  principal: 9_600,
  startDay: 1,
  dueDay: 1 + T.termDays,
  monthlyRate: T.monthlyRate,
  redeemDay: null,
  ...over,
})

describe('pawning through the reducer', () => {
  it('lends cash, holds the item in a loan, keeps it out of inventory', () => {
    const before = pawnerAtOffer(7)
    const s = pawnFirst(7)
    expect(s.current?.outcome).toBe('pawned')
    const principal = s.current!.price!
    expect(s.cash).toBe(before.cash - principal)
    expect(s.loans).toHaveLength(1)
    const l = s.loans[0]!
    expect(l.item.id).toBe(before.current!.item!.id)
    expect(l.principal).toBe(principal)
    expect(l.startDay).toBe(1)
    expect(l.dueDay).toBe(1 + T.termDays)
    expect(l.monthlyRate).toBe(T.monthlyRate)
    expect(s.inventory.map((i) => i.id)).not.toContain(l.item.id)
    expect(s.paid[l.item.id]).toBeUndefined()
    const entry = s.day.log[s.day.log.length - 1]!
    expect(entry.kind).toBe('loan')
    expect(entry.amount).toBe(-principal)
  })

  it('is deterministic', () => {
    expect(pawnFirst(42)).toEqual(pawnFirst(42))
  })

  it('the haggle anchors on the smaller pawn claim', () => {
    const s = pawnerAtOffer(7)
    const c = s.current!
    const claim = claimedValue(getItemDef(c.item!.defId), c.item!)
    const after = reducer(s, { type: 'offer/make', amount: 100, approach: 'straight' })
    if (after.haggle && after.haggle.status === 'open') expect(after.haggle.ask).toBeLessThan(claim)
  })
})

describe('redemption', () => {
  it('the pawner comes back on redeemDay, pays principal + interest, and the loan closes', () => {
    let s = pawnFirst(7)
    const l0 = s.loans[0]!
    const redeemDay = l0.startDay + 5
    s = { ...s, loans: [{ ...l0, redeemDay }] }
    s = finishDay(s, () => {
      throw new Error('nobody should redeem on day 1')
    })
    while (s.calendar.day < redeemDay) {
      s = reducer(s, { type: 'day/open' })
      expect(s.queue.some((v) => v.kind === 'redeem')).toBe(false)
      s = finishDay(s)
    }
    s = reducer(s, { type: 'day/open' })
    expect(s.calendar.day).toBe(redeemDay)
    const visit = s.queue.find((v) => v.kind === 'redeem')!
    expect(visit.loanId).toBe(l0.id)
    expect(visit.item!.id).toBe(l0.item.id)
    expect(visit.line).toBeTruthy()
    // Serve the redeemer first.
    s = { ...s, queue: [visit, ...s.queue.filter((v) => v !== visit)] }
    s = reducer(s, { type: 'counter/next' })
    const cash = s.cash
    const due = amountDue(l0, redeemDay)
    expect(due).toBeGreaterThan(l0.principal)
    s = reducer(s, { type: 'loan/return' })
    expect(s.current?.outcome).toBe('redeemed')
    expect(s.cash).toBe(cash + due)
    expect(s.loans).toHaveLength(0)
    expect(s.inventory.map((i) => i.id)).not.toContain(l0.item.id)
    expect(s.day.log.at(-1)).toMatchObject({ kind: 'redeem', amount: due })
  })

  it('someone who walked out on their day tries again the next day, until the grace period ends', () => {
    const base = startedState(3, 'loans')
    const l = loan({ redeemDay: 10 })
    const at = (day: number) => planRedemptions({ ...base, loans: [l], calendar: { ...base.calendar, day } }, (p) => `${p}x`)
    expect(at(9)).toHaveLength(0)
    expect(at(10)).toHaveLength(1)
    expect(at(11)).toHaveLength(1)
    expect(at(l.dueDay + T.graceDays)).toHaveLength(1)
    expect(at(l.dueDay + T.graceDays + 1)).toHaveLength(0)
    expect(at(10)).toEqual(at(10))
  })

  it('redeemDay falls between the minimum and the due day', () => {
    for (let seed = 1; seed < 400; seed++) {
      const l = createLoan({ id: 'l', item: item({ provenance: 'heirloom' }), customer: customer({ desperation: 0 }), principal: 5_000, day: 4, rng: new Rng(seed) })
      if (l.redeemDay === null) continue
      expect(l.redeemDay).toBeGreaterThanOrEqual(4 + T.minRedeemDays)
      expect(l.redeemDay).toBeLessThanOrEqual(l.dueDay)
    }
  })
})

describe('forfeits', () => {
  it('a loan nobody redeems is forfeited the day after the grace period, into the safe', () => {
    let s = pawnFirst(11)
    const l0 = s.loans[0]!
    s = { ...s, loans: [{ ...l0, redeemDay: null }] }
    s = finishDay(s)
    const lastDay = l0.dueDay + T.graceDays
    while (s.calendar.day <= lastDay) {
      s = reducer(s, { type: 'day/open' })
      expect(s.loans).toHaveLength(1)
      s = finishDay(s)
    }
    s = reducer(s, { type: 'day/open' })
    expect(s.calendar.day).toBe(lastDay + 1)
    expect(s.loans).toHaveLength(0)
    expect(s.inventory.map((i) => i.id)).toContain(l0.item.id)
    expect(s.paid[l0.item.id]).toBe(l0.principal)
    expect(s.shop.slots.some((sl) => sl.itemId === l0.item.id)).toBe(false)
    const entry = s.day.log.find((e) => e.kind === 'forfeit')!
    expect(entry).toMatchObject({ amount: 0, itemId: l0.item.id })
    expect(entry.text).toMatch(/^Nobody came for the /)
  })

  it('forfeitOverdue leaves loans inside the grace period alone', () => {
    const base = startedState(3, 'loans')
    const l = loan()
    const s = forfeitOverdue({ ...base, loans: [l], calendar: { ...base.calendar, day: l.dueDay + T.graceDays } })
    expect(s.loans).toHaveLength(1)
  })
})

describe('interest', () => {
  it('is prorated by days held at the monthly rate', () => {
    const l = loan({ principal: 9_600 })
    expect(amountDue(l, l.startDay + 30)).toBe(10_560)
    expect(amountDue(l, l.startDay + 15)).toBe(10_080)
    expect(amountDue(l, l.startDay + 33)).toBe(10_660) // grace days still accrue (10,656 rounded up)
  })

  it('charges a minimum of minInterestDays', () => {
    const l = loan({ principal: 9_600 })
    const min = amountDue(l, l.startDay + T.minInterestDays)
    expect(amountDue(l, l.startDay)).toBe(min)
    expect(amountDue(l, l.startDay + 1)).toBe(min)
    expect(min).toBe(9_830) // 9,600 + 224, rounded up to 10 ₽
    expect(amountDue(l, l.startDay + T.minInterestDays + 1)).toBeGreaterThan(min)
  })

  it('loanTerms quotes the due day and what is owed then', () => {
    expect(loanTerms(9_600, 5)).toEqual({ dueDay: 5 + T.termDays, termDays: T.termDays, monthlyRate: T.monthlyRate, owedAtDue: 10_560 })
  })
})

describe('who comes back', () => {
  const rate = (it: ItemInstance, c: WalkIn, principal = 5_000) => {
    let back = 0
    const n = 3_000
    for (let seed = 1; seed <= n; seed++) if (createLoan({ id: 'l', item: it, customer: c, principal, day: 1, rng: new Rng(seed) }).redeemDay !== null) back++
    return back / n
  }

  it('fakes are redeemed much less often than genuine items', () => {
    const c = customer()
    const genuine = rate(item(), c)
    const fake = rate(item({ authenticity: 'fake', trueValue: 2_000 }), c)
    expect(genuine).toBeGreaterThan(0.3)
    expect(fake).toBeLessThan(genuine * 0.35)
  })

  it('heirlooms come back more, desperate people less', () => {
    expect(rate(item({ provenance: 'heirloom' }), customer())).toBeGreaterThan(rate(item(), customer()))
    expect(rate(item(), customer({ desperation: 0.95 }))).toBeLessThan(rate(item(), customer({ desperation: 0.05 })))
  })

  it('redeemChance stays in its bounds', () => {
    const worst = redeemChance(item({ authenticity: 'fake', trueValue: 100 }), customer({ desperation: 1 }), 10_000)
    expect(worst).toBeGreaterThanOrEqual(T.redeemMin)
    expect(worst).toBeLessThan(0.1)
    expect(redeemChance(item({ provenance: 'heirloom' }), customer({ desperation: 0, temperament: 'proud' }), 1_000)).toBeLessThanOrEqual(T.redeemMax)
  })
})

describe('who pawns', () => {
  it('a tuned share of walk-ins want a loan, each with an opening line', () => {
    let pawners = 0
    let total = 0
    for (let seed = 1; seed <= 300; seed++) {
      let n = 0
      for (const v of generateDayQueue(new Rng(seed), 8, (p) => `${p}${n++}`)) {
        total++
        expect(v.kind).toBe('seller')
        if (v.wants === 'pawn') {
          pawners++
          expect(v.line).toBeTruthy()
        } else expect(v.wants).toBe('sell')
      }
    }
    expect(pawners / total).toBeGreaterThan(0.15)
    expect(pawners / total).toBeLessThan(0.5)
  })

  it('desperation and heirlooms raise the chance', () => {
    const c = generateWalkIn(new Rng(1), 'c')
    expect(pawnChance({ ...c, desperation: 0.9 }, item())).toBeGreaterThan(pawnChance({ ...c, desperation: 0.1 }, item()))
    expect(pawnChance(c, item({ provenance: 'heirloom' }))).toBeGreaterThan(pawnChance(c, item()))
  })

  it('the day queue is deterministic', () => {
    let n = 0
    const q = generateDayQueue(new Rng(99), 8, (p) => `${p}${n++}`)
    let m = 0
    const again = generateDayQueue(new Rng(99), 8, (p) => `${p}${m++}`)
    expect(again).toEqual(q)
  })
})
