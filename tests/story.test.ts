import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { reducer, type Action } from '../src/game/actions'
import type { GameState } from '../src/game/state'
import { tuning } from '../src/data/tuning'
import { ITEM_DEFS, getItemDef } from '../src/data/items'
import { CAST } from '../src/data/customers/cast'
import { archetypes } from '../src/data/customers/walkins'
import { SPECIALISTS } from '../src/data/specialists'
import { FENCE } from '../src/data/fence'
import { COLLECTOR } from '../src/data/collector'
import { VOLKOVA } from '../src/data/police'
import { FLOOD_PERSON } from '../src/data/flood'
import { REGULARS, getRegular } from '../src/data/regulars'
import { ARCS, getBeat } from '../src/data/stories'
import { holds } from '../src/game/story/conditions'
import { applyEffects } from '../src/game/story/effects'
import { pickBeats, planStory, regularCustomer } from '../src/game/story/plan'
import { beatRecord, memoryOf, recordBeat, setMemory, warmthOf } from '../src/game/story/progress'
import { migrate } from '../src/game/save/migrations'
import type { Condition } from '../src/game/schema/story'
import type { QueuedVisit } from '../src/game/types'

const run = (s: GameState, ...actions: Action[]) => actions.reduce(reducer, s)
const onDay = (s: GameState, day: number): GameState => ({ ...s, calendar: { ...s.calendar, day } })
const zina = () => getRegular('zinaida')!
/** Every arc but `keep` has ended, so other arcs' beats stay out of a planning test. */
const only = (s: GameState, ...keep: string[]): GameState => ({
  ...s,
  story: { ...s.story, arcs: Object.fromEntries(ARCS.filter((a) => !keep.includes(a.id)).map((a) => [a.id, { beats: {}, ended: true }])) },
})

/**
 * Only Zinaida is due: everyone else's next visit is pushed far off (a fresh
 * career jumped to a late day would have every regular due at once).
 */
function onlyZinaida(s: GameState): GameState {
  const customers = { ...s.customers }
  for (const r of REGULARS) if (r.id !== 'zinaida') customers[r.id] = { ...memoryOf(s, r.id), nextDay: 10_000 }
  return { ...s, customers }
}

/** Every arc ended, so no story beat (of any arc) changes the day. */
function noArcs(s: GameState): GameState {
  return { ...s, story: { ...s.story, arcs: Object.fromEntries(ARCS.map((a) => [a.id, { beats: {}, ended: true }])) } }
}

/** An open day with this story visit first in line. */
function withVisit(s: GameState, visit: Partial<QueuedVisit> & { beatId?: string }): GameState {
  const open = reducer(s, { type: 'day/open' })
  const v = { visitId: 'vx', kind: 'scene', customer: regularCustomer(zina()), patience: tuning.story.patience, ...visit } as QueuedVisit
  return { ...open, queue: [v, ...open.queue] }
}

describe('story content', () => {
  const looks = new Set(CAST.map((c) => c.id))
  const kinds = new Set(archetypes.map((a) => a.id))
  const items = new Set(ITEM_DEFS.map((d) => d.id))

  it('regulars have real looks, archetypes and items', () => {
    const ids = new Set<string>()
    for (const r of REGULARS) {
      expect(ids.has(r.id), r.id).toBe(false)
      ids.add(r.id)
      expect(looks.has(r.look), `${r.id} look ${r.look}`).toBe(true)
      expect(kinds.has(r.archetype), `${r.id} archetype`).toBe(true)
      for (const it of r.items) {
        expect(items.has(it.defId), `${r.id} item ${it.defId}`).toBe(true)
      }
      for (const k of ['first', 'again', 'warm', 'cold'] as const) expect(r.lines[k].length, `${r.id} ${k}`).toBeGreaterThan(0)
    }
  })

  it('beats name real people, items, fake profiles and beats', () => {
    const beats = new Set(ARCS.flatMap((a) => a.beats.map((b) => b.id)))
    const specialists = new Set(SPECIALISTS.map((s) => s.id))
    for (const arc of ARCS) {
      for (const beat of arc.beats) {
        const v = beat.visit
        // M4: a regular, or a specialist (their own arcs); `as` someone they sent.
        // M5: or the fence, the Collector or Detective Volkova (their own arcs).
        const person = v.who === FENCE.id ? FENCE : v.who === COLLECTOR.id ? COLLECTOR : v.who === VOLKOVA.id ? VOLKOVA : v.who === FLOOD_PERSON.id ? FLOOD_PERSON : undefined
        expect(getRegular(v.who) ?? SPECIALISTS.find((s) => s.id === v.who) ?? person, `${beat.id} who`).toBeDefined()
        if (v.as) expect(looks.has(v.as.look), `${beat.id} as.look`).toBe(true)
        if (v.item) {
          expect(items.has(v.item.defId), `${beat.id} item`).toBe(true)
          if (v.item.fakeProfileId) {
            const def = getItemDef(v.item.defId)
            expect(def.fakeProfiles.some((p) => p.id === v.item!.fakeProfileId), `${beat.id} profile`).toBe(true)
          }
        }
        const conds: readonly Condition[] = beat.when
        for (const c of conds) {
          if (c.if === 'beat') expect(beats.has(c.beat), `${beat.id} → ${c.beat}`).toBe(true)
          if (c.if === 'trust' || c.if === 'visits' || c.if === 'loan') expect(getRegular(c.who), `${beat.id} ${c.who}`).toBeDefined()
          if (c.if === 'specialist') expect(specialists.has(c.id), `${beat.id} ${c.id}`).toBe(true)
        }
        const effects = [...(v.scene?.choices.flatMap((c) => c.effects) ?? []), ...Object.values(v.after).flatMap((a) => a?.effects ?? [])]
        for (const e of effects) if (e.do === 'trust') expect(getRegular(e.who), `${beat.id} ${e.who}`).toBeDefined()
      }
    }
  })

  // Specialists' arcs (M4) are the exception: their beats trigger on their own (GDD § 2b: months, relationship, events).
  it('every beat after the first depends on an earlier beat of its arc', () => {
    for (const arc of ARCS) {
      if (arc.specialist) continue
      for (const beat of arc.beats.slice(1)) {
        // Directly, or through an `any` whose every option is an earlier beat of the arc.
        // M5: or on having met Detective Volkova (her courtesy call, a systemic visit, opens her arc).
        const ofArc = (c: Condition) => c.if === 'beat' && c.beat.startsWith(`${arc.id}.`)
        const metHer = (c: Condition) => arc.id === 'volkova' && c.if === 'volkova' && c.met === true
        // M6: the Flood is a city event; its days (the `flood` condition) open its beats, met or not.
        const theWater = (c: Condition) => (arc.id === 'flood' || arc.id === 'flood_talk') && c.if === 'flood'
        expect(beat.when.some((c) => ofArc(c) || metHer(c) || theWater(c) || (c.if === 'any' && c.of.every(ofArc))), beat.id).toBe(true)
      }
    }
  })
})

describe('conditions and effects', () => {
  it('reads days, flags, beats, trust and rep', () => {
    let s = onDay(startedState(1, 'c1'), 10)
    expect(holds({ if: 'day', gte: 10, lte: 10 }, s)).toBe(true)
    expect(holds({ if: 'day', gte: 11 }, s)).toBe(false)
    expect(holds({ if: 'flag', flag: 'x' }, s)).toBe(false)
    expect(holds({ if: 'flag', flag: 'x', not: true }, s)).toBe(true)
    expect(holds({ if: 'beat', beat: 'medals.roof' }, s)).toBe(false)
    expect(holds({ if: 'beat', beat: 'medals.roof', not: true }, s)).toBe(true)

    s = recordBeat(s, 'medals.roof', { day: 4, outcome: 'bought', ratio: 0.5 })
    expect(holds({ if: 'beat', beat: 'medals.roof', outcome: ['bought'] }, s)).toBe(true)
    expect(holds({ if: 'beat', beat: 'medals.roof', outcome: ['passed'] }, s)).toBe(false)
    expect(holds({ if: 'beat', beat: 'medals.roof', daysAgo: { gte: 6 } }, s)).toBe(true)
    expect(holds({ if: 'beat', beat: 'medals.roof', daysAgo: { gte: 7 } }, s)).toBe(false)
    expect(holds({ if: 'beat', beat: 'medals.roof', ratio: { gte: 0.45 } }, s)).toBe(true)

    s = applyEffects(
      s,
      [
        { do: 'flag', flag: 'x' },
        { do: 'trust', who: 'zinaida', delta: 0.3 },
        { do: 'rep', group: 'neighbourhood', delta: 0.1 },
        { do: 'cash', amount: 500, text: 'A gift' },
      ],
      'medals',
    )
    expect(holds({ if: 'flag', flag: 'x' }, s)).toBe(true)
    expect(holds({ if: 'trust', who: 'zinaida', gte: 0.3 }, s)).toBe(true)
    expect(holds({ if: 'rep', group: 'neighbourhood', gte: 0.1 }, s)).toBe(true)
    expect(s.day.log.at(-1)).toMatchObject({ kind: 'story', amount: 500 })

    s = applyEffects(s, [{ do: 'unflag', flag: 'x' }, { do: 'trust', who: 'zinaida', delta: -5 }, { do: 'endArc' }], 'medals')
    expect(s.story.flags).not.toContain('x')
    expect(memoryOf(s, 'zinaida').trust).toBe(-1)
    expect(s.story.arcs.medals?.ended).toBe(true)
  })

  it('warmth follows visits and trust', () => {
    const m = memoryOf(startedState(1, 'c1'), 'zinaida')
    expect(warmthOf(m)).toBe('first')
    expect(warmthOf({ ...m, visits: 1 })).toBe('again')
    expect(warmthOf({ ...m, visits: 1, trust: tuning.regulars.warmAt })).toBe('warm')
    expect(warmthOf({ ...m, visits: 1, trust: tuning.regulars.coldAt })).toBe('cold')
  })
})

describe('planning', () => {
  it('a beat comes up only when its conditions hold, at most one per arc', () => {
    const early = onDay(startedState(1, 'c1'), 2)
    expect(pickBeats(early)).toEqual([])
    let seen = 0
    for (let seed = 1; seed <= 40; seed++) {
      const beats = pickBeats(onDay(startedState(seed, 'c1'), 3))
      expect(beats.length).toBeLessThanOrEqual(tuning.story.maxBeatsPerDay)
      expect(new Set(beats.map((b) => b.id.split('.')[0])).size).toBe(beats.length)
      if (beats.some((b) => b.id === 'medals.roof')) seen++
    }
    // chance 0.5 over 40 careers
    expect(seen).toBeGreaterThan(8)
    expect(seen).toBeLessThan(32)
  })

  it('an ended arc and a played beat stay quiet', () => {
    const s = onDay(startedState(1, 'c1'), 3)
    const played = recordBeat(s, 'medals.roof', { day: 3, outcome: 'passed' })
    expect(pickBeats(played).some((b) => b.id === 'medals.roof')).toBe(false)
    const ended = { ...s, story: { ...s.story, arcs: { medals: { beats: {}, ended: true } } } }
    expect(pickBeats(ended).filter((b) => b.id.startsWith('medals.'))).toEqual([])
  })

  it('a beat seller takes a walk-in place and the day keeps its length; planning is deterministic', () => {
    let found = false
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const s = only(onDay(startedState(seed, 'c1'), 3), 'medals')
      if (!pickBeats(s).some((b) => b.id === 'medals.roof')) continue
      found = true
      const a = reducer(s, { type: 'day/open' })
      expect(a).toEqual(reducer(s, { type: 'day/open' }))
      const beat = a.queue.find((v) => v.beatId === 'medals.roof')!
      expect(beat.kind).toBe('seller')
      expect(beat.customer.regularId).toBe('zinaida')
      expect(beat.item?.defId).toBe('order_red_star')
      expect(beat.item?.authenticity).toBe('genuine')
      expect(a.queue).toHaveLength(tuning.day.customersPerDay)
    }
    expect(found).toBe(true)
  })

  it('a regular comes in on schedule with one of their items, then not again for a while', () => {
    const def = zina()
    const day = def.schedule!.from + tuning.regulars.firstVisitJitter[1]
    // Keep every arc out of the way.
    const s = noArcs(onlyZinaida(onDay(startedState(5, 'c1'), day)))
    let id = 0
    const plan = planStory(s, (p) => `${p}${id++}`)
    const visit = plan.visits.find((v) => v.visit.customer.regularId === 'zinaida')
    expect(visit).toBeDefined()
    expect(visit!.visit.kind).toBe('seller')
    expect(def.items.some((i) => i.defId === visit!.visit.item?.defId)).toBe(true)
    expect(plan.sellerPlaces).toBe(plan.visits.length)
    expect(plan.customers.zinaida!.nextDay).toBeGreaterThanOrEqual(day + def.schedule!.every[0])

    const opened = reducer(s, { type: 'day/open' })
    expect(opened.queue.filter((v) => v.customer.regularId === 'zinaida')).toHaveLength(1)
    expect(opened.queue).toHaveLength(tuning.day.customersPerDay)
  })

  it('a regular coming back for a pledge does not come in to sell', () => {
    const def = zina()
    const day = def.schedule!.from + tuning.regulars.firstVisitJitter[1]
    let s = noArcs(onlyZinaida(onDay(startedState(5, 'c1'), day)))
    const fake = { customer: regularCustomer(def), redeemDay: day + 5 } as unknown as GameState['loans'][number]
    s = { ...s, loans: [fake] }
    let id = 0
    expect(planStory(s, (p) => `${p}${id++}`).visits).toEqual([])
  })

  it('story visits never reroll the walk-ins: same ids, looks, items, order and game Rng without them', () => {
    // A day with a story scene that takes its place in the line (no walk-in place, not first),
    // and the same day with every arc ended. Regulars are away on both.
    const nobody = (s: GameState): GameState => {
      const customers = { ...s.customers }
      for (const r of REGULARS) customers[r.id] = { ...memoryOf(s, r.id), nextDay: 10_000 }
      return { ...s, customers }
    }
    let found: GameState | null = null
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const t = recordBeat(only(nobody(onDay(startedState(seed, 'c1'), 12)), 'protection'), 'protection.asking', { day: 3, outcome: 'talked' })
      if (pickBeats(t).some((b) => b.id === 'protection.offer')) found = t
    }
    expect(getBeat('protection.offer')!.visit.first).toBe(false)
    const quiet = only(found!)
    const busy = reducer(found!, { type: 'day/open' })
    const plain = reducer(quiet, { type: 'day/open' })
    const isStory = (v: QueuedVisit) => v.beatId !== undefined || v.customer.regularId !== undefined
    expect(busy.queue.some((v) => v.beatId === 'protection.offer')).toBe(true)
    expect(busy.queue.filter((v) => !isStory(v))).toEqual(plain.queue)
    expect(busy.meta.rng).toBe(plain.meta.rng)
    expect(busy.meta.nextId).toBe(plain.meta.nextId)
  })

  it('which beats come up depends on the career and the day, not on what happened at the counter', () => {
    const s = only(onDay(startedState(3, 'c1'), 12), 'protection')
    const ids = (t: GameState) => pickBeats(t).map((b) => b.id)
    for (const rng of [1, 77, 123_456]) expect(ids({ ...s, meta: { ...s.meta, rng } })).toEqual(ids(s))
  })

  it('a regular who has given up on a pledge still drops in on schedule', () => {
    const def = zina()
    const day = def.schedule!.from + tuning.regulars.firstVisitJitter[1]
    let s = noArcs(onlyZinaida(onDay(startedState(5, 'c1'), day)))
    const fake = { customer: regularCustomer(def), redeemDay: null } as unknown as GameState['loans'][number]
    s = { ...s, loans: [fake] }
    let id = 0
    expect(planStory(s, (p) => `${p}${id++}`).visits.map((v) => v.visit.customer.regularId)).toEqual(['zinaida'])
  })
})

describe('at the counter', () => {
  it('a scene visit plays its lines, takes a choice and ends talked', () => {
    let s = withVisit(onDay(startedState(3, 'c1'), 20), { kind: 'scene', beatId: 'medals.truth', line: getBeat('medals.truth')!.visit.scene!.lines[0] })
    s = run(s, { type: 'counter/next' })
    const scene = getBeat('medals.truth')!.visit.scene!
    expect(s.current?.phase).toBe('scene')
    expect(s.current?.line).toBe(scene.lines[0])
    // Can't pass on a scene.
    expect(run(s, { type: 'counter/pass' }).current?.outcome).toBeUndefined()
    s = run(s, { type: 'scene/next' })
    expect(s.current?.line).toBe(scene.lines[1])
    // Last line: waits for a choice.
    expect(run(s, { type: 'scene/next' })).toEqual(s)
    const before = memoryOf(s, 'zinaida').trust
    s = run(s, { type: 'scene/choose', choiceId: 'truth' })
    expect(s.current?.line).toBe(scene.choices.find((c) => c.id === 'truth')!.reply)
    expect(memoryOf(s, 'zinaida').trust).toBeCloseTo(before + 0.2)
    // A second choice is ignored.
    expect(run(s, { type: 'scene/choose', choiceId: 'lie' })).toEqual(s)
    s = run(s, { type: 'scene/next' })
    expect(s.current?.phase).toBe('resolved')
    expect(s.current?.outcome).toBe('talked')
    expect(beatRecord(s, 'medals.truth')).toMatchObject({ day: 20, outcome: 'talked', choice: 'truth' })
    expect(memoryOf(s, 'zinaida').visits).toBe(1)
    expect(holds({ if: 'beat', beat: 'medals.truth', outcome: ['truth', 'unsure'] }, s)).toBe(true)
    s = run(s, { type: 'counter/dismiss' })
    expect(s.current).toBeNull()
  })

  it('an item beat opens with its scene, then the item; buying fairly records the beat, flag and trust', () => {
    const beat = getBeat('medals.roof')!
    let s: GameState
    let found: GameState | null = null
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const t = onDay(startedState(seed, 'c1'), 3)
      if (pickBeats(t).some((b) => b.id === 'medals.roof')) found = t
    }
    s = reducer(found!, { type: 'day/open' })
    const v = s.queue.find((x) => x.beatId === 'medals.roof')!
    s = { ...s, queue: [v, ...s.queue.filter((x) => x !== v)] }
    s = run(s, { type: 'counter/next' })
    expect(s.current?.phase).toBe('scene')
    for (let i = 0; i < 5 && s.current?.phase === 'scene'; i++) s = run(s, { type: 'scene/next' })
    expect(s.current?.phase).toBe('present')
    expect(s.current?.line).toBe(beat.visit.line)
    s = run(s, { type: 'counter/inspect' }, { type: 'inspect/done' }, { type: 'offer/estimate', value: 50_000 })
    const value = s.current!.item!.trueValue
    s = run(s, { type: 'offer/make', amount: Math.min(s.cash, value), approach: 'straight' })
    // Whether she takes the first fair offer or counters is the haggle's draw; either way, meet her.
    if (s.haggle?.status === 'open') s = run(s, { type: 'offer/acceptAsk' })
    expect(s.current?.outcome).toBe('bought')
    expect(s.current?.line).toBe(beat.visit.after.bought!.line)
    expect(s.story.flags).toContain('medals_bought_real')
    const rec = beatRecord(s, 'medals.roof')!
    expect(rec.outcome).toBe('bought')
    expect(rec.ratio).toBeGreaterThanOrEqual(tuning.regulars.trust.bought.fair)
    expect(memoryOf(s, 'zinaida').trust).toBeCloseTo(tuning.regulars.trust.bought.fairDelta)
  })

  it('trust softens the regular’s opening ask', () => {
    const def = zina()
    const day = def.schedule!.from + tuning.regulars.firstVisitJitter[1]
    // Only Zinaida's ordinary visit changes the day: no other regular due, every arc ended.
    const quiet = noArcs(onlyZinaida(onDay(startedState(9, 'c1'), day)))
    const askWith = (trust: number) => {
      let s = setMemory(quiet, 'zinaida', { trust })
      s = reducer(s, { type: 'day/open' })
      const v = s.queue.find((x) => x.customer.regularId === 'zinaida')!
      s = { ...s, queue: [{ ...v, wants: 'sell' }, ...s.queue.filter((x) => x !== v)] }
      s = run(s, { type: 'counter/next' }, { type: 'counter/inspect' }, { type: 'inspect/done' }, { type: 'offer/estimate', value: 10_000 })
      s = run(s, { type: 'offer/make', amount: 1, approach: 'straight' })
      return s.haggle?.status === 'open' ? s.haggle.ask : null
    }
    const cold = askWith(0)
    const warm = askWith(1)
    expect(cold).not.toBeNull()
    expect(warm).not.toBeNull()
    expect(warm!).toBeLessThan(cold!)
  })
})

describe('v3 → v4 (M4 story)', () => {
  it('a v3 save gains empty regulars and story flags and keeps playing', () => {
    const s = reducer(startedState(77, 'm3-career'), { type: 'day/open' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately untyped old-shape record
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, any>
    raw.meta.version = 3
    raw.customers = {}
    raw.story = { arcs: {}, pendingEvents: [] }
    const m = migrate(raw)
    expect(m.story.flags).toEqual([])
    expect(m.customers).toEqual({})
    expect(reducer(m, { type: 'counter/next' }).current).not.toBeNull()
  })
})
