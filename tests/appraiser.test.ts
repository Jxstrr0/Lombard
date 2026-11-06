/** M6 the appraiser: the second counter, hiring, his work, his wages, his arc, the v8 → v9 save step. */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { atDay, beatAtCounter, choose, eligible, readScene, run } from './storyHelpers'
import { APPRAISER, APPRAISER_FLAGS } from '../src/data/appraiser'
import { CAST } from '../src/data/customers/cast'
import { getItemDef } from '../src/data/items'
import { getRegular } from '../src/data/regulars'
import { ARCS } from '../src/data/stories'
import { tuning } from '../src/data/tuning'
import { upcomingBills } from '../src/game/economy/expenses'
import { upgradeStatus } from '../src/game/economy/upgrades'
import { epilogueCards } from '../src/game/endings/epilogue'
import { walkInCast } from '../src/game/customers/look'
import { migrate } from '../src/game/save/migrations'
import { Rng } from '../src/game/rng'
import { absentToday, accuracyOf, chargeWages, hireStatus, nextForStaff, serve, servable, SECOND_COUNTER, wagesDue } from '../src/game/staff/appraiser'
import { regularCustomer } from '../src/game/story/plan'
import { recordBeat } from '../src/game/story/progress'
import { scriptedItem } from '../src/game/story/scripted'
import { createStaffState, STATE_VERSION, type GameState } from '../src/game/state'
import type { QueuedVisit } from '../src/game/types'
import { appraiser as appraiserPolicy } from '../src/sim/policies'
import { simulate } from '../src/sim/simulate'

const A = tuning.appraiser
const trust = (s: GameState) => s.customers[APPRAISER.id]?.trust ?? 0
const flags = (s: GameState) => s.story.flags

/** Closed on the morning of `day` with plenty of cash and the second counter bought. */
function withCounter(day = 30, seed = 61): GameState {
  const s = { ...atDay(startedState(seed, `appr-${seed}`), day), cash: 300_000 }
  return { ...s, shop: { ...s.shop, upgrades: [...s.shop.upgrades, SECOND_COUNTER] } }
}

/** Lev hired; his first morning already played (so it doesn't take the head of the line). */
function hired(day = 30, seed = 61): GameState {
  const s = run(withCounter(day, seed), { type: 'staff/hire' })
  return recordBeat(s, 'appraiser.start', { day: day - 1, outcome: 'talked', choice: 'welcome' })
}

/** A plain walk-in seller, as many as asked, built from a fresh day's line. */
function walkIns(s: GameState, n: number): QueuedVisit[] {
  const open = run(atDay(startedState(77, 'w'), 5), { type: 'day/open' })
  const base = open.queue.find(servable)
  expect(base, 'a walk-in seller').toBeDefined()
  return Array.from({ length: n }, (_, i) => ({ ...base!, visitId: `vw${s.calendar.day}-${i}`, patience: 300 + i * 50, item: { ...base!.item!, id: `iw${s.calendar.day}-${i}` } }))
}

/** Open with Lev on staff, the paper read, nobody at the counter, and `n` walk-ins waiting. */
function openWithLine(n = 4, seed = 61): GameState {
  const s = run(hired(30, seed), { type: 'day/open' })
  return { ...s, current: null, queue: walkIns(s, n), day: { ...s.day, newsRead: true, nextArrival: 1e9 } }
}

describe('the second counter and hiring', () => {
  it('the counter is offered from tuning.appraiser.counterDay; hiring needs it', () => {
    const early = { ...atDay(startedState(1, 'c'), A.counterDay - 1), cash: 300_000 }
    expect(upgradeStatus(early, SECOND_COUNTER)).toBe('locked')
    const later = { ...early, calendar: { ...early.calendar, day: A.counterDay } }
    expect(upgradeStatus(later, SECOND_COUNTER)).toBe('available')
    expect(hireStatus(later)).toBe('noCounter')
    expect(run(later, { type: 'staff/hire' }).staff.hired).toBe(false)
    const bought = run(later, { type: 'upgrade/buy', id: SECOND_COUNTER })
    expect(bought.cash).toBe(later.cash - tuning.upgrades.cost.second_counter)
    expect(hireStatus(bought)).toBe('available')
  })

  it('hiring is closed-only, sets his flags and a little trust, and starts the next open day', () => {
    const s = run(withCounter(), { type: 'staff/hire' })
    expect(s.staff.hired).toBe(true)
    expect(s.staff.sinceDay).toBe(30)
    expect(flags(s)).toContain(APPRAISER_FLAGS.onStaff)
    expect(flags(s)).toContain(APPRAISER_FLAGS.hired)
    expect(trust(s)).toBeCloseTo(A.trust.hired)
    const open = run(withCounter(), { type: 'day/open' })
    expect(run(open, { type: 'staff/hire' }).staff.hired).toBe(false)
  })

  it('letting him go pays what he is owed to the day, is final, and clears on_staff', () => {
    const s = hired()
    const owed = wagesDue(s)
    expect(owed).toBeGreaterThan(0)
    const f = run(s, { type: 'staff/fire' })
    expect(f.staff.hired).toBe(false)
    expect(f.staff.gone).toBe('fired')
    expect(f.cash).toBe(s.cash - owed)
    expect(flags(f)).not.toContain(APPRAISER_FLAGS.onStaff)
    expect(flags(f)).toContain(APPRAISER_FLAGS.letGo)
    expect(hireStatus(f)).toBe('gone')
    expect(run(f, { type: 'staff/hire' }).staff.hired).toBe(false)
  })

  it('his wage shows in the bills, prorated from the day he started', () => {
    const s = hired()
    const bill = upcomingBills(s).find((b) => b.label.startsWith('Wages'))
    expect(bill).toBeDefined()
    expect(bill!.amount).toBeGreaterThan(0)
    expect(bill!.amount).toBeLessThanOrEqual(A.salary)
    expect(upcomingBills(withCounter()).some((b) => b.label.startsWith('Wages'))).toBe(false)
  })

  it('month end pays his wage; paid in full his trust grows, short it drops', () => {
    // 2014-03-31 is a month end; he started on the 1st.
    const base = hired()
    const s = { ...base, staff: { ...base.staff, sinceDay: base.calendar.day - 30 }, calendar: { ...base.calendar, date: '2014-03-31' } }
    const paid = chargeWages(s)
    expect(paid.cash).toBe(s.cash - A.salary)
    expect(paid.day.log.at(-1)?.text).toContain(APPRAISER.short)
    expect(trust(paid) - trust(s)).toBeCloseTo(A.trust.paid)
    const short = chargeWages({ ...s, cash: 100 })
    expect(trust(short) - trust(s)).toBeCloseTo(A.trust.short)
    expect(chargeWages({ ...s, calendar: { ...s.calendar, date: '2014-03-30' } })).toEqual({ ...s, calendar: { ...s.calendar, date: '2014-03-30' } })
  })

  it('the rule is kept (categories sorted and deduplicated)', () => {
    const s = run(hired(), { type: 'staff/rule', mode: 'categories', categories: ['watches', 'gold', 'watches'] })
    expect(s.staff.mode).toBe('categories')
    expect(s.staff.categories).toEqual(['gold', 'watches'])
    expect(run(s, { type: 'staff/rule', mode: 'next' }).staff.categories).toEqual(['gold', 'watches'])
  })
})

describe('his work', () => {
  it('takes the walk-in closest to giving up (never the first in line), then resolves the deal into your books', () => {
    const s = openWithLine(4)
    // Shortest patience after the head of the line.
    const short = { ...s, queue: s.queue.map((v, i) => (i === 2 ? { ...v, patience: 120 } : v)) }
    expect(nextForStaff(short)).toBe(2)
    const t = run(short, { type: 'time/tick', seconds: 5 })
    expect(t.staff.busy?.visit.visitId).toBe(short.queue[2]!.visitId)
    expect(t.queue).toHaveLength(3)
    const done = run(t, { type: 'time/tick', seconds: A.serveSeconds[1] + 5 })
    expect(done.staff.record.served).toBeGreaterThanOrEqual(1)
    expect(done.day.served).toBeGreaterThan(t.day.served)
    expect(done.day.log.some((e) => e.text.startsWith(APPRAISER.short))).toBe(true)
  })

  it('the overflow rule waits for a line of tuning.appraiser.overflowAt', () => {
    const s = openWithLine(A.overflowAt - 1)
    expect(nextForStaff(s)).toBe(-1)
    expect(nextForStaff(openWithLine(A.overflowAt))).toBeGreaterThanOrEqual(A.leaveForYou)
  })

  it('never takes a regular, a story beat, a phone call or a buyer', () => {
    const s = openWithLine(4)
    const zina = getRegular('zinaida')!
    const q = s.queue.map((v, i): QueuedVisit => {
      if (i === 1) return { ...v, customer: regularCustomer(zina) }
      if (i === 2) return { ...v, beatId: 'medals.truth' }
      return i === 3 ? { ...v, via: 'phone' } : v
    })
    expect(nextForStaff({ ...s, queue: q })).toBe(-1)
  })

  it('the categories rule takes only those, however short the line', () => {
    const s = openWithLine(2)
    const cat = getItemDef(s.queue[1]!.item!.defId).category
    expect(nextForStaff(run(s, { type: 'staff/rule', mode: 'categories', categories: [cat] }))).toBe(1)
    expect(nextForStaff(run(s, { type: 'staff/rule', mode: 'categories', categories: ['__none'] }))).toBe(-1)
  })

  it('works from a stream keyed by the visit: the game Rng never moves', () => {
    const s = openWithLine(4)
    const done = serve(s, s.queue[1]!)
    expect(done.meta.rng).toEqual(s.meta.rng)
    expect(serve(s, s.queue[1]!)).toEqual(done)
  })

  it('a fake he misses is bought as genuine and named in the ledger at closing', () => {
    let s = openWithLine(4)
    s = { ...s, staff: { ...s.staff, accuracyMod: -1 } }
    expect(accuracyOf(s)).toBeCloseTo(0.3)
    const def = getItemDef('watch_vostok_komandirskie')
    let missed: GameState | null = null
    for (let i = 0; i < 60 && !missed; i++) {
      const item = scriptedItem(def, { authenticity: 'fake', provenance: 'clean', story: 'Grandad’s.' }, new Rng(i), `if${i}`)
      const visit: QueuedVisit = { ...(s.queue[1] as QueuedVisit & { kind: 'seller' }), visitId: `vf${i}`, item, wants: 'sell' }
      const after = serve(s, visit)
      if (after.staff.pending.length) missed = after
    }
    expect(missed, 'a missed fake within 60 tries at 30% accuracy').not.toBeNull()
    expect(missed!.staff.record.fakes).toBe(1)
    const closed = run({ ...missed!, queue: [], current: null }, { type: 'day/close' })
    expect(closed.history.at(-1)).toBeDefined()
    expect(closed.staff.pending).toEqual([])
  })

  it('the morning of his voicemail he never came in: he takes nobody', () => {
    const s = openWithLine(4)
    const call: QueuedVisit = { visitId: 'v-call', kind: 'scene', customer: s.queue[0]!.customer, patience: 1e5, beatId: 'appraiser.vanish', via: 'phone' }
    const away = { ...s, queue: [call, ...s.queue] }
    expect(absentToday(away)).toBe(true)
    expect(run(away, { type: 'time/tick', seconds: 30 }).staff.busy).toBeNull()
  })

  it('closing finishes the seller in front of him', () => {
    const s = run(openWithLine(4), { type: 'time/tick', seconds: 5 })
    expect(s.staff.busy).not.toBeNull()
    const closed = run({ ...s, queue: [], current: null }, { type: 'day/close' })
    expect(closed.day.phase).toBe('closed')
    expect(closed.staff.busy).toBeNull()
    expect(closed.staff.record.served).toBe(1)
  })
})

describe('the Appraiser arc', () => {
  it('his first morning plays the day after the hire, first in line', () => {
    const s = run(withCounter(), { type: 'staff/hire' })
    expect(eligible(s, 'appraiser.start')).toBe(true)
    // Other arcs out of the way (tuning.story.maxBeatsPerDay: on a busy morning his first day waits).
    const quiet = { ...s, story: { ...s.story, arcs: Object.fromEntries(ARCS.filter((a) => a.id !== 'appraiser').map((a) => [a.id, { beats: {}, ended: true }])) } }
    const open = run(quiet, { type: 'day/open' })
    // First in line, with any other arc's first-thing beat.
    const at = open.queue.findIndex((v) => v.beatId === 'appraiser.start')
    expect(at).toBeGreaterThanOrEqual(0)
    expect(open.queue.slice(0, at).every((v) => v.beatId)).toBe(true)
    expect(eligible(withCounter(), 'appraiser.start')).toBe(false)
  })

  it('Zhora comes once Lev has been on staff a while and Zhora has already asked about Gusev', () => {
    let s = recordBeat(hired(), 'appraiser.start', { day: 30, outcome: 'talked', choice: 'welcome' })
    s = atDay(s, 30 + A.arc.zhoraAfter)
    expect(eligible(s, 'appraiser.zhora')).toBe(false)
    s = recordBeat(s, 'protection.asking', { day: 5, outcome: 'talked' })
    expect(eligible(s, 'appraiser.zhora')).toBe(true)
  })

  /** Through Zhora's visit with `choice`, `days` later, on a shop where Lev's trust is `t`. */
  function afterZhora(choice: 'ask_lev' | 'ask_zhora', t: number): GameState {
    let s = hired()
    s = { ...s, customers: { ...s.customers, [APPRAISER.id]: { ...s.customers[APPRAISER.id]!, trust: t } } }
    s = recordBeat(s, 'protection.asking', { day: 5, outcome: 'talked' })
    s = choose(beatAtCounter(s, 'appraiser.zhora', 40), choice)
    return run(s, { type: 'counter/dismiss' })
  }

  it('warm, he tells you himself; keep him on and the tin comes up the next morning', () => {
    let s = afterZhora('ask_lev', 0.1)
    expect(trust(s)).toBeGreaterThanOrEqual(A.arc.confideTrust)
    expect(eligible(atDay(s, 40 + A.arc.confideAfter), 'appraiser.confide')).toBe(true)
    expect(eligible(atDay(s, 40 + A.arc.vanishAfter), 'appraiser.vanish')).toBe(false)
    s = choose(beatAtCounter(s, 'appraiser.confide', 44), 'keep_on')
    s = run(s, { type: 'counter/dismiss' })
    expect(flags(s)).toContain('heart.appraiser_kept')
    expect(eligible(atDay(s, 45), 'appraiser.tin')).toBe(true)
  })

  it('the tin: to Zhora pays the debt (and Yura comes home), to Volkova counts clean, half each counts dirty', () => {
    let s = afterZhora('ask_lev', 0.1)
    s = run(choose(beatAtCounter(s, 'appraiser.confide', 44), 'keep_on'), { type: 'counter/dismiss' })
    const atTin = beatAtCounter(s, 'appraiser.tin', 45)

    const crew = run(choose(atTin, 'tin_crew'), { type: 'counter/dismiss' })
    expect(flags(crew)).toContain('appraiser.debt_paid')
    expect(crew.crime.pressure).toBeLessThanOrEqual(atTin.crime.pressure)
    expect(eligible(atDay(crew, 45 + A.arc.afterTin), 'appraiser.yuri')).toBe(true)
    const yuri = run(readScene(beatAtCounter(crew, 'appraiser.yuri', 45 + A.arc.afterTin)), { type: 'scene/next' })
    expect(yuri.staff.accuracyMod).toBeCloseTo(A.arc.sharper)
    expect(flags(yuri)).toContain('appraiser.yuri_home')

    const police = run(choose(atTin, 'tin_police'), { type: 'counter/dismiss' })
    expect(flags(police)).toContain('appraiser.tin_police')
    expect(police.career.axes.clean).toBeGreaterThan(atTin.career.axes.clean)
    expect(police.crime.pressure).toBeGreaterThan(atTin.crime.pressure)

    const split = run(choose(atTin, 'tin_split'), { type: 'counter/dismiss' })
    expect(split.cash).toBe(atTin.cash + Math.round(A.arc.tin / 2))
    expect(flags(split)).toContain('dirty.appraiser_tin')
    expect(split.career.axes.clean).toBeLessThan(atTin.career.axes.clean)
    expect(eligible(atDay(split, 45 + A.arc.afterTin), 'appraiser.zhora_back')).toBe(true)
  })

  it('let him go when he tells you: he leaves, paid to the day, and the arc ends', () => {
    let s = afterZhora('ask_lev', 0.1)
    s = run(choose(beatAtCounter(s, 'appraiser.confide', 44), 'let_go'), { type: 'counter/dismiss' })
    expect(s.staff.hired).toBe(false)
    expect(s.staff.gone).toBe('left')
    expect(flags(s)).toContain('appraiser.told_go')
    expect(s.story.arcs.appraiser?.ended).toBe(true)
  })

  it('cold (you asked Zhora instead), he is gone one morning, and the crew think you have the tin', () => {
    const s = afterZhora('ask_zhora', A.trust.hired)
    expect(flags(s)).toContain('appraiser.knows')
    expect(trust(s)).toBeLessThanOrEqual(A.arc.vanishTrust)
    expect(eligible(atDay(s, 40 + A.arc.confideAfter), 'appraiser.confide')).toBe(false)
    expect(eligible(atDay(s, 40 + A.arc.vanishAfter), 'appraiser.vanish')).toBe(true)
    // The voicemail plays between customers.
    let v = beatAtCounter(s, 'appraiser.vanish', 40 + A.arc.vanishAfter)
    expect(v.current?.via).toBe('phone')
    v = run(readScene(v), { type: 'scene/next' })
    expect(v.staff.gone).toBe('vanished')
    expect(flags(v)).toContain('appraiser.vanished')
    expect(v.crime.pressure).toBeGreaterThan(s.crime.pressure)
    expect(eligible(atDay(v, 40 + A.arc.vanishAfter + A.arc.afterVanish), 'appraiser.zhora_vanished')).toBe(true)
  })

  it('his epilogue card shows once he was hired, and reads how it went', () => {
    const card = (s: GameState) => epilogueCards(s).find((c) => c.id === 'appraiser')
    expect(card(withCounter())).toBeUndefined()
    const s = hired()
    expect(card(s)?.text).toMatch(/second counter to the end/)
    expect(card({ ...s, story: { ...s.story, flags: [...s.story.flags, 'appraiser.yuri_home'] } })?.text).toMatch(/brother/)
    expect(card({ ...s, story: { ...s.story, flags: [...s.story.flags, 'appraiser.vanished'] } })?.text).toMatch(/four o’clock train/)
  })
})

describe('his look', () => {
  it('is a staff-only cast entry that no walk-in wears', () => {
    const look = CAST.find((c) => c.id === APPRAISER.look)
    expect(look?.staff).toBe(true)
    expect(walkInCast().some((c) => c.id === APPRAISER.look)).toBe(false)
  })
})

describe('v8 → v9', () => {
  it('lays down an empty staff record and keeps playing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately untyped old-shape record
    const raw = JSON.parse(JSON.stringify(startedState(5, 'c'))) as Record<string, any>
    raw.meta.version = 8
    delete raw.staff
    const m = migrate(raw)
    expect(m.meta.version).toBe(STATE_VERSION)
    expect(m.staff).toEqual(createStaffState())
    expect(run(m, { type: 'day/open' }).day.phase).toBe('open')
  })
})

describe('sim', () => {
  it('the appraiser policy buys the counter, hires him, and he serves the overflow', () => {
    const runs = [1000, 1010, 1014].map((seed) => simulate(seed, appraiserPolicy, 90))
    const hiredRuns = runs.filter((r) => r.staff.hired || r.staff.gone)
    expect(hiredRuns.length).toBeGreaterThan(0)
    for (const r of hiredRuns) {
      expect(r.staff.sinceDay).toBeGreaterThanOrEqual(A.counterDay)
      expect(r.staff.record.served).toBeGreaterThan(0)
      expect(r.staff.record.wages).toBeGreaterThan(0)
    }
  })
})
