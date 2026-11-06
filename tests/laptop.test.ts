/**
 * The Student's Laptop (src/data/stories/laptop.ts) and the story-pledge engine
 * it needs (src/game/story/pledges.ts): the same laptop each visit, planned
 * redemptions, renewal, forfeits, and the three endings.
 */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { atDay, beatAtCounter, choose, eligible, offer, pass, readScene, run } from './storyHelpers'
import { getItemDef } from '../src/data/items'
import { getRegular } from '../src/data/regulars'
import { ARCS, getBeat } from '../src/data/stories'
import { tuning } from '../src/data/tuning'
import { reducer } from '../src/game/actions'
import { claimedValue } from '../src/game/appraise/value'
import { amountDue, lastRedeemDay } from '../src/game/loans/loans'
import { migrate } from '../src/game/save/migrations'
import { Arc, Condition, VisitScript } from '../src/game/schema/story'
import { holds } from '../src/game/story/conditions'
import { beatVisit } from '../src/game/story/plan'
import { pledgeOf } from '../src/game/story/pledges'
import { beatRecord, memoryOf, recordBeat } from '../src/game/story/progress'
import { STATE_VERSION, type GameState } from '../src/game/state'
import type { ItemInstance, Loan } from '../src/game/types'

const base = (seed = 21): GameState => ({ ...startedState(seed, 'laptop'), cash: 500_000 })
const LAPTOP = 'laptop_tosaki_orbita_c40'

/** Lend what it would be worth genuine: always at or over his ask, so the loan is taken at once. */
const pawnIt = (s: GameState) => offer(s, claimedValue(getItemDef(LAPTOP), s.current!.item!))
const fedyaLoan = (s: GameState): Loan | undefined => s.loans.find((l) => l.customer.regularId === 'fedya')

/** Morning of `day`: Fedya's redeem visit is first in line; pay him out. */
function redeemOn(s: GameState, day: number): GameState {
  let open = reducer(atDay(s, day), { type: 'day/open' })
  const v = open.queue.find((q) => q.kind === 'redeem' && q.customer.regularId === 'fedya')
  expect(v, `redeem visit on day ${day}`).toBeDefined()
  open = { ...open, queue: [v!, ...open.queue.filter((q) => q !== v)] }
  return run(open, { type: 'counter/next' }, { type: 'loan/return' })
}

/** Pawn at `beatId` on `day` (scene read through, first choice if any), then redeem on his planned day. */
function pawnAndRedeem(s: GameState, beatId: string, day: number): GameState {
  s = beatAtCounter(s, beatId, day)
  const scene = getBeat(beatId)!.visit.scene!
  s = scene.choices.length > 0 ? choose(s, scene.choices[0]!.id) : readScene(s)
  s = pawnIt(s)
  expect(s.current?.outcome, beatId).toBe('pawned')
  const loan = fedyaLoan(s)!
  const plan = getBeat(beatId)!.visit.redeem!
  expect(loan.redeemDay).toBeGreaterThanOrEqual(day + plan.days[0])
  expect(loan.redeemDay).toBeLessThanOrEqual(day + plan.days[1])
  return redeemOn(s, loan.redeemDay!)
}

/** Rent and shoes pawned and redeemed, then the retake pawned (he can't redeem it on his own). */
function toRetake(s: GameState): GameState {
  s = pawnAndRedeem(s, 'laptop.rent', 5)
  s = pawnAndRedeem(s, 'laptop.shoes', 14)
  s = pawnIt(readScene(beatAtCounter(s, 'laptop.retake', 23)))
  expect(s.current?.outcome).toBe('pawned')
  return s
}

describe('The Student’s Laptop: content', () => {
  it('Fedya is the curly-haired student, and every visit brings the same genuine Tosaki', () => {
    expect(getRegular('fedya')?.look).toBe('male_adult_06')
    const arc = ARCS.find((a) => a.id === 'laptop')!
    for (const b of arc.beats.filter((x) => x.visit.item)) expect(b.visit.item, b.id).toMatchObject({ defId: LAPTOP, authenticity: 'genuine', same: 'laptop' })
  })

  it('the terms he recites on the first visit are the real loan terms', () => {
    const words: Record<number, string> = { 3: 'Three days', 7: 'a week', 30: 'Thirty days' }
    const reply = getBeat('laptop.rent')!.visit.scene!.choices.find((c) => c.id === 'explain')!.reply
    expect(reply).toContain(words[tuning.loans.termDays])
    expect(reply).toContain(words[tuning.loans.graceDays])
    expect(reply).toContain(words[tuning.loans.minInterestDays])
    expect(reply).toContain(`${tuning.loans.monthlyRate === 0.1 ? 'ten' : '?'} percent a month`)
  })
})

describe('story pledges (engine)', () => {
  it('a redeem plan is only allowed on a pawn beat', () => {
    const scene = { who: 'fedya', kind: 'scene', scene: { lines: ['Hi.'] }, redeem: { days: [1, 2] } }
    expect(VisitScript.safeParse(scene).success).toBe(false)
    const sell = { who: 'fedya', kind: 'seller', wants: 'sell', item: { defId: LAPTOP, story: 'x' }, redeem: { days: [1, 2] } }
    expect(VisitScript.safeParse(sell).success).toBe(false)
    expect(VisitScript.safeParse({ ...sell, wants: 'pawn' }).success).toBe(true)
    expect(Condition.safeParse({ if: 'pledge', beat: 'laptop.rent', is: [] }).success).toBe(false)
    expect(Arc.safeParse({ id: 'x', title: 'X', beats: [{ id: 'x.a', visit: { ...sell, wants: 'pawn', item: { ...sell.item, same: 'Bad Key' } } }] }).success).toBe(false)
  })

  it('`same` brings back the same laptop: weight and value, a little more worn each time', () => {
    const s = atDay(base(), 10)
    let n = 0
    const draw = (id: string, st = s): ItemInstance => beatVisit(st, getBeat(id)!, (p) => `${p}${n++}`)!.item!
    const [a, b, c, d] = ['laptop.rent', 'laptop.shoes', 'laptop.retake', 'laptop.diploma'].map((id) => draw(id))
    expect(new Set([a, b, c, d].map((i) => i!.weightGrams)).size).toBe(1)
    expect(a!.condition - b!.condition).toBe(2)
    expect(b!.condition - c!.condition).toBe(3)
    expect(c!.condition - d!.condition).toBe(2)
    expect(a!.trueValue).toBeGreaterThanOrEqual(b!.trueValue)
    // The same on another day (the stream is the career's, not the morning's)…
    expect(draw('laptop.rent', atDay(base(), 30))).toEqual({ ...a, id: expect.any(String) })
    // …and a different laptop in another career.
    expect(draw('laptop.rent', atDay(base(99), 10)).weightGrams).not.toBe(a!.weightGrams)
  })

  it('the pledge condition follows the beat’s loan: none, open, redeemed, forfeited, days since it ended', () => {
    let s = atDay(base(), 20)
    const cond = (is: ('open' | 'redeemed' | 'forfeited')[], extra: object = {}) => holds({ if: 'pledge', beat: 'laptop.rent', is, ...extra } as Condition, s)
    expect(cond(['open', 'redeemed', 'forfeited'])).toBe(false)
    expect(cond(['open', 'forfeited'], { not: true })).toBe(true)
    s = recordBeat(s, 'laptop.rent', { day: 5, outcome: 'pawned', loan: { id: 'l1' } })
    expect(pledgeOf(s, 'laptop.rent')).toEqual({ status: 'open' })
    expect(cond(['open'])).toBe(true)
    expect(cond(['open'], { daysAgo: { gte: 0 } })).toBe(false)
    expect(cond(['open', 'forfeited'], { not: true })).toBe(false)
    s = recordBeat(s, 'laptop.rent', { day: 5, outcome: 'pawned', loan: { id: 'l1', end: 'forfeited', day: 17 } })
    expect(cond(['forfeited'], { daysAgo: { gte: 3 } })).toBe(true)
    expect(cond(['forfeited'], { daysAgo: { gte: 4 } })).toBe(false)
    expect(cond(['redeemed'])).toBe(false)
  })

  it('a v6 save loads as v7 and keeps playing', () => {
    const s = reducer(startedState(77, 'v6-career'), { type: 'day/open' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately untyped old-shape record
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, any>
    raw.meta.version = 6
    raw.story.arcs = { medals: { beats: { 'medals.roof': { day: 3, outcome: 'bought', ratio: 0.5 } } } }
    const m = migrate(raw)
    expect(STATE_VERSION).toBeGreaterThanOrEqual(7)
    expect(m.meta.version).toBe(STATE_VERSION)
    expect(m.story.arcs.medals?.beats['medals.roof']).toEqual({ day: 3, outcome: 'bought', ratio: 0.5 })
    expect(pledgeOf(m, 'medals.roof')).toBeUndefined()
    expect(reducer(m, { type: 'counter/next' }).current).not.toBeNull()
  })
})

describe('The Student’s Laptop: the loan tutorial', () => {
  it('the first pawn: terms explained, a planned return, his own line walking in and handing over the interest', () => {
    let s = beatAtCounter(base(), 'laptop.rent', 5)
    expect(s.current?.customer.regularId).toBe('fedya')
    s = choose(s, 'explain')
    expect(s.current?.phase).toBe('present')
    expect(s.current?.wants).toBe('pawn')
    s = pawnIt(s)
    expect(s.current?.line).toBe(getBeat('laptop.rent')!.visit.after.pawned!.line)
    const loan = fedyaLoan(s)!
    expect(beatRecord(s, 'laptop.rent')?.loan).toEqual({ id: loan.id })
    expect(pledgeOf(s, 'laptop.rent')?.status).toBe('open')

    // Not back for it yet: the next pawn waits.
    expect(eligible(atDay(s, 13), 'laptop.shoes')).toBe(false)
    const day = loan.redeemDay!
    const open = reducer(atDay(s, day), { type: 'day/open' })
    const v = open.queue.find((q) => q.kind === 'redeem' && q.loanId === loan.id)!
    expect(v.line).toBe(getBeat('laptop.rent')!.visit.redeem!.line)
    const cash = open.cash
    s = run({ ...open, queue: [v, ...open.queue.filter((q) => q !== v)] }, { type: 'counter/next' }, { type: 'loan/return' })
    expect(s.current?.outcome).toBe('redeemed')
    expect(s.current?.line).toBe(getBeat('laptop.rent')!.visit.redeem!.thanks)
    expect(s.cash - cash).toBe(amountDue(loan, day))
    expect(s.cash - cash).toBeGreaterThan(loan.principal)
    expect(pledgeOf(s, 'laptop.rent')).toEqual({ status: 'redeemed', day })
    expect(fedyaLoan(s)).toBeUndefined()
    expect(eligible(atDay(s, 13), 'laptop.shoes')).toBe(true)
  })

  it('turned away the first time, he still comes back with it later', () => {
    let s = pass(choose(beatAtCounter(base(), 'laptop.rent', 5), 'look'))
    expect(pledgeOf(s, 'laptop.rent')).toBeUndefined()
    expect(eligible(atDay(s, 12), 'laptop.shoes')).toBe(false)
    expect(eligible(atDay(s, 13), 'laptop.shoes')).toBe(true)
    s = readScene(beatAtCounter(s, 'laptop.shoes', 13))
    expect(s.current?.item?.defId).toBe(LAPTOP)
  })

  it('the third pawn never comes back on its own; renewing charges the interest and starts a new term', () => {
    let s = toRetake(base())
    const loan = fedyaLoan(s)!
    expect(loan.redeemDay).toBeNull()
    expect(eligible(atDay(s, 45), 'laptop.renew')).toBe(false)
    expect(eligible(atDay(s, 46), 'laptop.renew')).toBe(true)

    s = beatAtCounter(s, 'laptop.renew', 48)
    const cash = s.cash
    s = choose(s, 'renew')
    const interest = amountDue(loan, 48) - loan.principal
    expect(interest).toBeGreaterThan(0)
    expect(s.cash - cash).toBe(interest)
    expect(s.day.log.at(-1)).toMatchObject({ kind: 'story', amount: interest })
    const renewed = fedyaLoan(s)!
    expect(renewed).toMatchObject({ id: loan.id, principal: loan.principal, startDay: 48, dueDay: 48 + tuning.loans.termDays })
    expect(renewed.redeemDay).toBeGreaterThanOrEqual(51)
    expect(renewed.redeemDay).toBeLessThanOrEqual(54)
    expect(s.current?.outcome).toBe('talked')

    // He comes back, pays the new term's interest only, and graduates.
    const before = s.cash
    s = redeemOn(s, renewed.redeemDay!)
    expect(s.current?.line).toBe(getBeat('laptop.retake')!.visit.redeem!.thanks)
    expect(s.cash - before).toBe(amountDue(renewed, renewed.redeemDay!))
    expect(pledgeOf(s, 'laptop.retake')).toEqual({ status: 'redeemed', day: renewed.redeemDay })
    const d = renewed.redeemDay!
    expect(eligible(atDay(s, d + 1), 'laptop.diploma')).toBe(false)
    expect(eligible(atDay(s, d + 2), 'laptop.diploma')).toBe(true)
    expect(eligible(atDay(s, d + 30), 'laptop.forfeit')).toBe(false)

    s = readScene(beatAtCounter(s, 'laptop.diploma', d + 2))
    expect(s.current?.wants).toBe('sell')
    s = offer(s, claimedValue(getItemDef(LAPTOP), s.current!.item!) * 1.3)
    expect(s.current?.outcome).toBe('bought')
    expect(s.story.flags).toContain('laptop_graduated')
    expect(s.story.arcs.laptop?.ended).toBe(true)
    expect(s.inventory.some((i) => i.defId === LAPTOP)).toBe(true)
  })

  it('waiving the interest renews for free and the kids hear of it', () => {
    let s = toRetake(base())
    s = beatAtCounter(s, 'laptop.renew', 48)
    const cash = s.cash
    const youth = s.reputation.byGroup.youth
    const trust = memoryOf(s, 'fedya').trust
    s = choose(s, 'waive')
    expect(s.cash).toBe(cash)
    expect(s.day.log.at(-1)).toMatchObject({ kind: 'story', amount: 0 })
    expect(fedyaLoan(s)?.startDay).toBe(48)
    expect(fedyaLoan(s)?.redeemDay).not.toBeNull()
    expect(s.reputation.byGroup.youth).toBeGreaterThan(youth)
    expect(memoryOf(s, 'fedya').trust).toBeGreaterThan(trust)
  })

  it('refusing to renew: the laptop is forfeited to the safe, and he comes by once to say he knows', () => {
    let s = toRetake(base())
    const loan = fedyaLoan(s)!
    s = choose(beatAtCounter(s, 'laptop.renew', 48), 'refuse')
    expect(fedyaLoan(s)?.redeemDay).toBeNull()
    const last = lastRedeemDay(loan)
    s = reducer(atDay(s, last), { type: 'day/open' })
    expect(fedyaLoan(s)).toBeDefined()
    s = reducer(atDay(s, last + 1), { type: 'day/open' })
    expect(fedyaLoan(s)).toBeUndefined()
    expect(s.inventory.some((i) => i.id === loan.item.id)).toBe(true)
    expect(s.paid[loan.item.id]).toBe(loan.principal)
    expect(pledgeOf(s, 'laptop.retake')).toEqual({ status: 'forfeited', day: last + 1 })
    expect(eligible(atDay(s, last + 1), 'laptop.forfeit')).toBe(false)
    expect(eligible(atDay(s, last + 2), 'laptop.forfeit')).toBe(true)
    expect(eligible(atDay(s, last + 9), 'laptop.diploma')).toBe(false)

    s = choose(beatAtCounter(s, 'laptop.forfeit', last + 2), 'sorry')
    expect(s.current?.outcome).toBe('talked')
    expect(s.story.flags).toContain('laptop_forfeited')
    expect(s.story.arcs.laptop?.ended).toBe(true)
  })

  it('no renewal scene in time is a forfeit too', () => {
    let s = toRetake(base())
    const loan = fedyaLoan(s)!
    s = reducer(atDay(s, lastRedeemDay(loan) + 1), { type: 'day/open' })
    expect(pledgeOf(s, 'laptop.retake')?.status).toBe('forfeited')
    expect(eligible(atDay(s, lastRedeemDay(loan) + 2), 'laptop.renew')).toBe(false)
    expect(eligible(atDay(s, lastRedeemDay(loan) + 2), 'laptop.forfeit')).toBe(true)
  })

  it('turned away on the third time, his mum pays and the arc ends', () => {
    let s = pawnAndRedeem(base(), 'laptop.rent', 5)
    s = pawnAndRedeem(s, 'laptop.shoes', 14)
    s = pass(readScene(beatAtCounter(s, 'laptop.retake', 23)))
    expect(eligible(atDay(s, 27), 'laptop.mum')).toBe(false)
    expect(eligible(atDay(s, 28), 'laptop.mum')).toBe(true)
    expect(eligible(atDay(s, 60), 'laptop.renew')).toBe(false)
    s = readScene(beatAtCounter(s, 'laptop.mum', 28))
    expect(s.current?.outcome).toBe('talked')
    expect(s.story.arcs.laptop?.ended).toBe(true)
  })
})
