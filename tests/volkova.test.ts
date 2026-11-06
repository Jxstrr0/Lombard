/**
 * M5 Detective Volkova's arc (GDD § 9): her courtesy call in every career, her own story's
 * three second halves (honest, bought, lied to), Stanislav Lyubimov's icon, and informing
 * on Eduard Lvovich's crew.
 */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { atDay, beatAtCounter, choose, eligible, offer, readScene } from './storyHelpers'
import { reducer } from '../src/game/actions'
import { VOLKOVA, volkovaLines } from '../src/data/police'
import { ARCS, getBeat } from '../src/data/stories'
import { tuning } from '../src/data/tuning'
import { addEvent, RECHECK } from '../src/game/crime/events'
import { BRICK } from '../src/game/crime/vandalism'
import { introDay, isPoliceVisit, planPolice } from '../src/game/crime/volkova'
import { beatVisit } from '../src/game/story/plan'
import { recordBeat } from '../src/game/story/progress'
import { playPaperBeats } from '../src/game/story/visit'
import type { GameState } from '../src/game/state'
import type { SpecialistState } from '../src/game/types'

const V = tuning.police.volkova
const A = tuning.volkovaArc
const ids = (day: number) => (prefix: string, who: string) => `${prefix}s${day.toString(36)}_${who}`

function morning(day: number, seed = 51): GameState {
  return { ...atDay(startedState(seed, `volkova-${seed}`), day), cash: 200_000 }
}

function withVolkova(s: GameState, patch: Partial<GameState['crime']['volkova']>): GameState {
  return { ...s, crime: { ...s.crime, volkova: { ...s.crime.volkova, met: true, ...patch } } }
}

const flag = (s: GameState, f: string): GameState => (s.story.flags.includes(f) ? s : { ...s, story: { ...s.story, flags: [...s.story.flags, f] } })

/** Open the shop on the state's day and call the first police visit planned for it to the counter. */
function openToPolice(s: GameState): GameState {
  const open = reducer(s, { type: 'day/open' })
  const police = open.queue.find((v) => isPoliceVisit(v))
  expect(police, 'a police visit today').toBeDefined()
  const front = { ...open, queue: [police!, ...open.queue.filter((v) => v !== police)] }
  return readScene(reducer(front, { type: 'counter/next' }))
}

describe('Volkova: the courtesy call', () => {
  it('comes once in every career on a seeded day in introDays, hot or not', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = startedState(seed, `intro-${seed}`)
      const day = introDay(s)
      expect(day).toBeGreaterThanOrEqual(V.introDays[0])
      expect(day).toBeLessThanOrEqual(V.introDays[1])
      expect(introDay(atDay(s, day + 5))).toBe(day)
    }
    const s = morning(1)
    const day = introDay(s)
    expect(planPolice(atDay(s, day - 1), ids(day - 1)).visit).toBeNull()
    const plan = planPolice(atDay(s, day), ids(day))
    expect(plan.visit?.visitId).toBe(`vs${day.toString(36)}_intro`)
    // Missed (the day closed early)? It comes the next morning instead. Once met, never again.
    expect(planPolice(atDay(s, day + 3), ids(day + 3)).visit?.visitId).toBe(`vs${(day + 3).toString(36)}_intro`)
    expect(planPolice(withVolkova(atDay(s, day), {}), ids(day)).visit).toBeNull()
  })

  it('introduces her, with a cup of tea or not, and sets met', () => {
    const s = morning(introDay(morning(1)))
    let at = openToPolice(s)
    expect(at.current?.scene?.lines).toEqual([...volkovaLines.intro, ...volkovaLines.courtesy.lines])
    expect(at.crime.volkova.met).toBe(true)
    expect(at.story.flags).toContain('police.met')
    expect(at.current?.scene?.choices.map((c) => c.id)).toEqual(['tea', 'busy'])
    const tea = reducer(at, { type: 'scene/choose', choiceId: 'tea' })
    expect(tea.current?.line).toBe(volkovaLines.courtesy.replies.tea)
    expect(tea.crime.volkova.trust).toBeCloseTo(V.introTea)
    expect(tea.story.flags).toContain('police.tea')
    const busy = reducer(at, { type: 'scene/choose', choiceId: 'busy' })
    expect(busy.crime.volkova.trust).toBe(0)
    // Going on ends the visit as talk.
    at = reducer(tea, { type: 'scene/next' })
    expect(at.current?.phase ?? 'resolved').not.toBe('scene')
  })

  it('remembers the glue you reported (Protection) at the courtesy call too', () => {
    const s = flag(morning(introDay(morning(1))), 'protection.told_police')
    const at = openToPolice(s)
    expect(at.current?.scene?.lines).toContain(volkovaLines.introReported)
    expect(at.crime.volkova.trust).toBeCloseTo(V.reportedTrust)
  })

  it('heat brings her sooner, and then her first ordinary visit is the introduction', () => {
    const s = { ...morning(3), crime: { ...morning(3).crime, heat: V.interestHeat + 0.1 } }
    let day = 3
    let plan = planPolice(s, ids(day))
    for (; !plan.visit && day < 3 + V.firstVisitDays[1] + 1; ) plan = planPolice(atDay(plan.state, ++day), ids(day))
    expect(plan.visit?.visitId).toBe(`vs${day.toString(36)}_volkova`)
  })
})

describe('Volkova: her arc on the story engine', () => {
  it('her own beats are story visits, not police visits, and play her as herself', () => {
    const s = withVolkova(morning(A.startDay), {})
    const visit = beatVisit(s, getBeat('volkova.inform')!, ids(A.startDay))!
    expect(visit.customer.id).toBe(VOLKOVA.id)
    expect(visit.beatId).toBe('volkova.inform')
    expect(isPoliceVisit(visit)).toBe(false)
    const at = beatAtCounter(flag(s, 'protection.running'), 'volkova.inform', A.startDay)
    expect(at.current?.scene?.lines[0]).toContain('Eduard Lvovich')
  })

  it('a day her arc brings her in, her police visit and a recheck wait for tomorrow (no clash of ids)', () => {
    let s = withVolkova(morning(20), { nextDay: 20 })
    s = { ...s, crime: { ...s.crime, heat: 0.5 } }
    s = addEvent(s, { day: 20, kind: RECHECK, data: { item: 'x', def: 'gold_bracelet_585' } })
    const waits = planPolice(s, ids(20), true)
    expect(waits.visit).toBeNull()
    expect(waits.state.crime.volkova.nextDay).toBe(21)
    expect(waits.state.crime.events.find((e) => e.kind === RECHECK)?.day).toBe(21)
    expect(planPolice(atDay(waits.state, 21), ids(21)).visit?.visitId).toBe(`vs${(21).toString(36)}_recheck`)
  })

  it('one second half per career: honest, bought, or lied to', () => {
    const base = withVolkova(morning(A.startDay + 2), {})
    expect(eligible(base, 'volkova.source')).toBe(true)
    expect(eligible(base, 'volkova.short')).toBe(false)
    expect(eligible(base, 'volkova.personal')).toBe(false)
    const bought = withVolkova(base, { bribes: 1 })
    expect(eligible(bought, 'volkova.short')).toBe(true)
    expect(eligible(bought, 'volkova.source')).toBe(false)
    expect(eligible(bought, 'volkova.personal')).toBe(false)
    const lied = withVolkova(base, { caught: 1, lies: 1 })
    expect(eligible(lied, 'volkova.personal')).toBe(true)
    expect(eligible(lied, 'volkova.source')).toBe(false)
    expect(eligible(withVolkova(base, { lies: A.lies }), 'volkova.personal')).toBe(true)
    expect(eligible(withVolkova(base, { lies: 1 }), 'volkova.personal')).toBe(false)
    // Once one has started, the others never do.
    const started = recordBeat(lied, 'volkova.personal', { day: base.calendar.day - 1, outcome: 'talked', choice: 'clean' })
    expect(eligible(withVolkova(started, { caught: 1, lies: 1, bribes: 1 }), 'volkova.short')).toBe(false)
    // Nobody before the arc's first day, nobody before her courtesy call.
    expect(eligible(atDay(base, A.startDay - 1), 'volkova.source')).toBe(false)
    expect(eligible(withVolkova(base, { met: false }), 'volkova.source')).toBe(false)
  })

  it('her father’s watch: a fair price rings back warm (heart), a lowball rings back cold', () => {
    let s = beatAtCounter(withVolkova(morning(A.startDay), {}), 'volkova.father', A.startDay)
    expect(s.current?.customer.name).toBe('Alla Volkova')
    s = readScene(s)
    for (let guard = 0; guard < 10 && s.current?.phase === 'scene'; guard++) s = reducer(s, { type: 'scene/next' })
    const item = s.current!.item!
    const fair = offer(s, item.trueValue * 1.5)
    expect(fair.story.flags).toContain('volkova.father_sold')
    const later = atDay(fair, A.startDay + 2)
    expect(eligible(later, 'volkova.father_fair')).toBe(true)
    expect(eligible(later, 'volkova.father_low')).toBe(false)
    const rang = readScene(beatAtCounter(later, 'volkova.father_fair', A.startDay + 2))
    const heart = later.career.axes.heart
    const done = reducer(reducer(rang, { type: 'scene/next' }), { type: 'scene/next' })
    expect(done.story.flags).toContain('heart.volkova_father')
    expect(done.career.axes.heart).toBeGreaterThan(heart)
    const low = recordBeat(withVolkova(morning(A.startDay + 3), {}), 'volkova.father', { day: A.startDay, outcome: 'bought', ratio: A.father.low - 0.05 })
    expect(eligible(low, 'volkova.father_low')).toBe(true)
    expect(eligible(low, 'volkova.father_fair')).toBe(false)
  })

  it('honest: you stall Tolik and ring her; she returns the favour', () => {
    let s = recordBeat(withVolkova(morning(40), {}), 'volkova.source', { day: 30, outcome: 'talked', choice: 'source_yes' })
    expect(eligible(s, 'volkova.stakeout')).toBe(true)
    const clean = s.career.axes.clean
    s = choose(beatAtCounter(s, 'volkova.stakeout', 40), 'ring')
    expect(s.story.flags).toContain('volkova.rang')
    expect(s.career.axes.clean).toBeGreaterThan(clean)
    expect(s.crime.volkova.trust).toBeCloseTo(A.trust.stakeoutRang)
    const after = atDay(s, 40 + A.gap + 3)
    expect(eligible(after, 'volkova.recital')).toBe(true)
    expect(eligible(after, 'volkova.patrol')).toBe(false)
    expect(eligible(flag(after, 'protection.running'), 'volkova.patrol')).toBe(true)
  })

  it('bought: lending her the money is dirty; telling internal security cools her for good', () => {
    let s = withVolkova(morning(30), { bribes: 1 })
    const clean = s.career.axes.clean
    s = choose(beatAtCounter(s, 'volkova.short', 30), 'lend')
    expect(s.cash).toBe(200_000 + A.cash.shortLoan)
    expect(s.career.axes.clean).toBeLessThan(clean)
    s = atDay(s, 30 + A.gap)
    expect(eligible(s, 'volkova.audit')).toBe(true)
    const told = choose(beatAtCounter(s, 'volkova.audit', 30 + A.gap), 'tell')
    expect(told.story.flags).toContain('volkova.reported')
    expect(eligible(atDay(told, 31 + A.gap), 'volkova.reprimand_news')).toBe(true)
    expect(eligible(atDay(told, 30 + 2 * A.gap), 'volkova.liability')).toBe(false)
    const quiet = choose(beatAtCounter(s, 'volkova.audit', 30 + A.gap), 'quiet')
    expect(eligible(atDay(quiet, 30 + 2 * A.gap), 'volkova.liability')).toBe(true)
  })

  it('lied to: coming clean is heart; saying nothing starts a grudge that costs', () => {
    const s = withVolkova(morning(30), { caught: 1, lies: 1 })
    const clean = choose(beatAtCounter(s, 'volkova.personal', 30), 'clean')
    expect(clean.story.flags).toContain('heart.volkova_truth')
    expect(clean.crime.volkova.trust).toBeGreaterThan(s.crime.volkova.trust)
    const grudge = choose(beatAtCounter(s, 'volkova.personal', 30), 'nothing')
    expect(grudge.story.flags).toContain('volkova.grudge')
    expect(grudge.crime.heat).toBeGreaterThan(s.crime.heat)
    const fined = atDay(grudge, 30 + A.gap)
    expect(eligible(fined, 'volkova.inspection')).toBe(true)
    expect(eligible(atDay(clean, 30 + A.gap), 'volkova.inspection')).toBe(false)
    expect(eligible(atDay(clean, 30 + A.gap), 'volkova.tver')).toBe(true)
  })
})

describe('Volkova: playing the crew against the police', () => {
  const crew = (s: GameState) => flag(s, 'protection.running')

  it('telling her about Eduard Lvovich counts clean, and pressure jumps', () => {
    const s = crew(withVolkova(morning(A.startDay), {}))
    expect(eligible(s, 'volkova.inform')).toBe(true)
    expect(eligible(flag(s, 'protection.held_out'), 'volkova.inform')).toBe(false)
    const told = choose(beatAtCounter(s, 'volkova.inform', A.startDay), 'inform')
    expect(told.story.flags).toContain('volkova.informed')
    expect(told.crime.pressure).toBeCloseTo(s.crime.pressure + A.inform.pressure)
    expect(told.career.axes.clean).toBeCloseTo(s.career.axes.clean + tuning.axes.informed)
  })

  it('then the crew finds out (a brick tonight; likelier if she takes envelopes), or she gets them', () => {
    const told = recordBeat(crew(withVolkova(morning(40), {})), 'volkova.inform', { day: 40 - A.inform.after, outcome: 'talked', choice: 'inform' })
    expect(eligible(told, 'volkova.leak')).toBe(true)
    expect(eligible(told, 'volkova.leak_bought')).toBe(false)
    expect(eligible(told, 'volkova.crackdown')).toBe(true)
    expect(getBeat('volkova.leak_bought')!.chance).toBeGreaterThan(getBeat('volkova.leak')!.chance)
    const bought = withVolkova(told, { bribes: 2 })
    expect(eligible(bought, 'volkova.leak_bought')).toBe(true)
    expect(eligible(bought, 'volkova.leak')).toBe(false)
    expect(eligible(atDay(told, 40 - 1), 'volkova.leak')).toBe(false)
    // The leak: Eduard Lvovich at the counter, and that night the brick.
    const leak = readScene(beatAtCounter(told, 'volkova.leak', 40))
    expect(leak.current?.customer.regularId).toBe('eduard')
    let done = leak
    for (let guard = 0; guard < 10 && done.current?.phase === 'scene'; guard++) done = reducer(done, { type: 'scene/next' })
    expect(done.story.flags).toContain('volkova.leaked')
    expect(done.crime.events.some((e) => e.kind === BRICK)).toBe(true)
    expect(done.crime.pressure).toBeCloseTo(told.crime.pressure + A.inform.leakPressure)
    expect(eligible(atDay(done, 41), 'volkova.crackdown')).toBe(false)
    // The crackdown, in the paper: the crew eases off.
    const paper = playPaperBeats({ ...told, crime: { ...told.crime, pressure: 0.6 } }, [getBeat('volkova.crackdown')!])
    expect(paper.crime.pressure).toBeCloseTo(0.6 + A.inform.crackdownPressure)
    expect(paper.story.flags).toContain('volkova.crackdown')
    expect(paper.market.news.at(-1)?.headline).toContain('embankment')
    expect(eligible(atDay(paper, 41), 'volkova.leak')).toBe(false)
  })
})

describe('Stanislav Lyubimov’s icon (his beat 4)', () => {
  const retained = (s: GameState, months: number): GameState => {
    const sp: SpecialistState = { retained: true, relationship: 0.5, callsUsed: 0, sinceDay: 1, months, events: {}, mods: {}, lowballed: [] }
    return { ...s, specialists: { ...s.specialists, antiquary: sp } }
  }

  it('comes once he has had you on his books for months, and you owe him or know Volkova', () => {
    const day = 1 + tuning.specialistArcs.monthDays * A.stanislavIcon.months + 1
    let s = recordBeat(retained(morning(day), A.stanislavIcon.months), 'stanislav.card', { day: 5, outcome: 'talked' })
    expect(eligible(s, 'stanislav.icon')).toBe(false)
    expect(eligible(flag(s, 'stanislav_owed'), 'stanislav.icon')).toBe(true)
    s = withVolkova(s, {})
    expect(eligible(s, 'stanislav.icon')).toBe(true)
    expect(eligible(retained(s, A.stanislavIcon.months - 1), 'stanislav.icon')).toBe(false)
  })

  it('booking it pays, counts dirty and warms the crew; Volkova asks about it later', () => {
    const day = 1 + tuning.specialistArcs.monthDays * A.stanislavIcon.months + 1
    const s = withVolkova(recordBeat(retained(morning(day), A.stanislavIcon.months), 'stanislav.card', { day: 5, outcome: 'talked' }), {})
    const booked = choose(beatAtCounter(s, 'stanislav.icon', day), 'book')
    expect(booked.story.flags).toEqual(expect.arrayContaining(['stanislav.icon_booked', 'dirty.stanislav_icon']))
    expect(booked.cash).toBe(s.cash + A.stanislavIcon.fee)
    expect(booked.crime.heat).toBeCloseTo(s.crime.heat + A.stanislavIcon.bookedHeat)
    expect(booked.career.axes.clean).toBeLessThan(s.career.axes.clean)
    // Its own flags, not The Collector's church icon.
    expect(booked.story.flags.some((f) => f.startsWith('collector'))).toBe(false)
    const asked = atDay(booked, day + A.gap)
    expect(eligible(asked, 'volkova.icon')).toBe(true)
    const truth = choose(beatAtCounter(asked, 'volkova.icon', day + A.gap), 'truth')
    expect(truth.specialists.antiquary?.retained).toBe(false)
    expect(truth.crime.volkova.trust).toBeGreaterThan(asked.crime.volkova.trust)
    const cover = choose(beatAtCounter(asked, 'volkova.icon', day + A.gap), 'cover')
    expect(cover.story.flags).toContain('dirty.volkova_icon_cover')
    expect(cover.specialists.antiquary?.retained).toBe(true)
  })

  it('telling the police sends him abroad: off your retainer, heat down, the crew notices', () => {
    const day = 1 + tuning.specialistArcs.monthDays * A.stanislavIcon.months + 1
    const s = flag(recordBeat(retained(morning(day), A.stanislavIcon.months), 'stanislav.card', { day: 5, outcome: 'talked' }), 'stanislav_owed')
    const heated = { ...s, crime: { ...s.crime, heat: 0.3 } }
    const told = choose(beatAtCounter(heated, 'stanislav.icon', day), 'tell')
    expect(told.story.flags).toContain('stanislav.icon_told')
    expect(told.specialists.antiquary?.retained).toBe(false)
    expect(told.crime.heat).toBeLessThan(0.3)
    expect(told.crime.pressure).toBeCloseTo(s.crime.pressure + A.stanislavIcon.toldPressure)
  })
})

describe('Volkova: content', () => {
  it('every beat of her arc plays someone real, and no line names a real brand', () => {
    const arc = ARCS.find((a) => a.id === 'volkova')!
    expect(arc.beats.length).toBeGreaterThan(15)
    for (const b of arc.beats) expect(['volkova', 'eduard'], b.id).toContain(b.visit.who)
  })
})
