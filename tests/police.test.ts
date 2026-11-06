/**
 * M5 police (GDD § 8): heat sources, the passport book, the stolen-goods bulletin,
 * Detective Volkova's visits and her three answers, and the raid.
 */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { atDay, offer, readScene, run } from './storyHelpers'
import { reducer } from '../src/game/actions'
import { CAST } from '../src/data/customers/cast'
import { FENCE } from '../src/data/fence'
import { getItemDef, ITEM_DEFS } from '../src/data/items'
import { BULLETIN } from '../src/data/news'
import { VOLKOVA, volkovaLines } from '../src/data/police'
import { getRegular, REGULARS } from '../src/data/regulars'
import { SPECIALISTS } from '../src/data/specialists'
import { tuning } from '../src/data/tuning'
import { bringBulletin, bulletinPiece, matchesBulletin, printBulletin, wearOf } from '../src/game/crime/bulletin'
import { addEvent, RAID, TRAIL } from '../src/game/crime/events'
import { heatAfterDeal, heatNight, matureTrails, openTrails, volkovaInterested, type Trail } from '../src/game/crime/heat'
import { NO_PASSPORT_TELL, PASSPORT_TELL, passportCheck } from '../src/game/crime/ledger'
import {
  bribeAmount,
  bribeFailChance,
  executeRaid,
  isPoliceVisit,
  lieCatchChance,
  planPolice,
  raidTargets,
  rollRaid,
  volkovaCustomer,
} from '../src/game/crime/volkova'
import { Rng } from '../src/game/rng'
import { allHold } from '../src/game/story/conditions'
import { regularCustomer } from '../src/game/story/plan'
import { scriptedItem } from '../src/game/story/scripted'
import type { GameState } from '../src/game/state'
import type { ItemInstance, QueuedVisit, WalkIn } from '../src/game/types'

const P = tuning.police
const V = P.volkova
/** Looks reserved for arc characters (tests/specialistArcs.test.ts). */
const RESERVED_LOOKS = new Set(['business_male_05', 'male_adult_06', 'male_adult_20', 'male_adult_11'])
const ids = (day: number) => (prefix: string, who: string) => `${prefix}s${day.toString(36)}_${who}`

const walkIn: WalkIn = { id: 'c-test', name: 'Kirill Sobolev', archetype: 'worker', temperament: 'flexible', knowledge: 0.3, desperation: 0.3, portraitKey: 'male_adult_01' }

function piece(id: string, provenance: ItemInstance['provenance'], defId = 'gold_bracelet_585', revealed: string[] = []): ItemInstance {
  const item = scriptedItem(getItemDef(defId), { authenticity: 'genuine', provenance, story: 'x' }, new Rng(7), id)
  return { ...item, revealed: [...item.revealed, ...revealed] }
}

/** Closed on the morning of `day`, plenty of cash. */
function morning(day: number, seed = 41): GameState {
  const s = atDay(startedState(seed, `police-${seed}`), day)
  return { ...s, cash: 200_000 }
}

/** Hold `item` (bought `ago` days back for `paid`) with a trail that has reached you. */
function holding(s: GameState, item: ItemInstance, opts: Partial<Trail> = {}, ago = 2, paid = 5_000): GameState {
  const day = s.calendar.day
  const trail: Trail = { item: item.id, def: item.defId, seller: walkIn.name, bought: day - ago, passport: 0, tape: 0, bulletin: 0, heat: 0, ...opts }
  const held = { ...s, inventory: [...s.inventory, item], paid: { ...s.paid, [item.id]: paid } }
  return addEvent(held, { day: day - 1, kind: TRAIL, data: { ...trail } })
}

/** Open the day with Volkova first in line and call her to the counter, read to her question. */
function volkovaAtCounter(s: GameState, role = 'volkova'): GameState {
  let open = reducer(s, { type: 'day/open' })
  const visit: QueuedVisit = { visitId: ids(open.calendar.day)('v', role), kind: 'scene', customer: volkovaCustomer(), patience: P.patience, line: '' }
  open = { ...open, queue: [visit, ...open.queue.filter((v) => !isPoliceVisit(v))] }
  return readScene(reducer(open, { type: 'counter/next' }))
}

const answer = (s: GameState, choiceId: string) => reducer(s, { type: 'scene/choose', choiceId })
const repPolice = (s: GameState) => s.reputation.byGroup.police

describe('police: content', () => {
  it('Volkova wears a female walk-in look nobody else in the cast is given', () => {
    const look = CAST.find((c) => c.id === VOLKOVA.look)
    expect(look).toBeDefined()
    expect(look!.regular ?? false).toBe(false)
    expect(look!.gender).toBe('f')
    expect(RESERVED_LOOKS.has(VOLKOVA.look)).toBe(false)
    expect(VOLKOVA.look).not.toBe(FENCE.look)
    expect(REGULARS.some((r) => r.look === VOLKOVA.look)).toBe(false)
    expect(SPECIALISTS.some((s) => s.look === VOLKOVA.look)).toBe(false)
  })

  it('the bulletin can describe pieces of every listed category, all of them real items', () => {
    const defs = ITEM_DEFS.filter((d) => P.bulletin.categories.includes(d.category) && d.baseValue.max <= P.bulletin.maxValue)
    expect(defs.length).toBeGreaterThan(10)
    expect(wearOf(95)).toBe('as new')
    expect(wearOf(10)).toBe(BULLETIN.wear[BULLETIN.wear.length - 1]![1])
  })
})

describe('police: the passport book', () => {
  it('a calm seller is written into the book; a refusal is noted as none shown', () => {
    const calm = passportCheck({ item: piece('p1', 'clean'), customer: walkIn, previous: [], rng: new Rng(1) })
    expect(calm.seconds).toBe(tuning.inspect.toolSeconds.passport)
    const tells = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const f = passportCheck({ item: piece('p2', 'stolen'), customer: walkIn, previous: [], rng: new Rng(i) }).findings[0]!
      tells.add(f.tellId!)
      expect(f.reveals).toBe('provenance')
      if (f.tellId === NO_PASSPORT_TELL) expect(f.polarity).toBe('negative')
    }
    expect(tells).toEqual(new Set([PASSPORT_TELL, NO_PASSPORT_TELL]))
  })

  it('a flagged seller reads wrong even when calm, and asking twice changes nothing', () => {
    const margarita = regularCustomer(getRegular('margarita')!)
    for (let i = 0; i < 20; i++) {
      const f = passportCheck({ item: piece('p3', 'clean'), customer: margarita, previous: [], rng: new Rng(i) }).findings[0]!
      expect(f.polarity).toBe('negative')
    }
    const first = passportCheck({ item: piece('p4', 'clean'), customer: walkIn, previous: [], rng: new Rng(3) })
    const again = passportCheck({ item: piece('p4', 'clean'), customer: walkIn, previous: first.findings, rng: new Rng(3) })
    expect(again.seconds).toBe(0)
    expect(again.findings[0]!.tellId).toBeUndefined()
  })

  it('at the counter it costs its seconds, marks the piece, never draws from the game Rng, and works once', () => {
    let s = reducer(morning(3), { type: 'day/open' })
    const seller = s.queue.find((v) => v.kind === 'seller' && !v.beatId)!
    s = run({ ...s, queue: [seller, ...s.queue.filter((v) => v !== seller)] }, { type: 'counter/next' }, { type: 'counter/inspect' })
    const before = s
    s = reducer(s, { type: 'inspect/useTool', tool: 'passport' })
    expect(s.meta.rng).toEqual(before.meta.rng)
    expect(s.day.clock - before.day.clock).toBe(tuning.inspect.toolSeconds.passport)
    const f = s.inspect!.findings.find((x) => x.tool === 'passport')!
    expect([PASSPORT_TELL, NO_PASSPORT_TELL]).toContain(f.tellId)
    expect(s.current!.item!.revealed).toContain(f.tellId)
    expect(reducer(s, { type: 'inspect/useTool', tool: 'passport' })).toBe(s)
  })
})

describe('police: heat sources', () => {
  const s0 = morning(5)
  const margarita = regularCustomer(getRegular('margarita')!)

  it('a clean piece from an unflagged seller raises nothing', () => {
    expect(heatAfterDeal(s0, walkIn, piece('h1', 'clean'))).toBe(s0)
  })

  it('a flagged seller adds heat, half again without a passport in the book', () => {
    const noBook = heatAfterDeal(s0, margarita, piece('h2', 'clean'))
    const book = heatAfterDeal(s0, margarita, piece('h3', 'clean', undefined, [PASSPORT_TELL]))
    expect(book.crime.heat).toBeCloseTo(P.heat.flaggedBuy, 6)
    expect(noBook.crime.heat).toBeCloseTo(P.heat.flaggedBuy * P.heat.noLedgerFactor, 6)
  })

  it('a stolen piece leaves a trail whose heat lands when it reaches you, once', () => {
    const s = heatAfterDeal(s0, walkIn, piece('h4', 'stolen'))
    expect(s.crime.heat).toBe(0)
    const ev = s.crime.events.find((e) => e.kind === TRAIL)!
    const [a, b] = P.trailDays.other
    expect(ev.day - s0.calendar.day).toBeGreaterThanOrEqual(a)
    expect(ev.day - s0.calendar.day).toBeLessThanOrEqual(b)
    expect(openTrails(s)).toHaveLength(0)
    const reached = { ...s, calendar: { ...s.calendar, day: ev.day } }
    const landed = matureTrails(reached)
    expect(landed.crime.heat).toBeCloseTo(P.heat.stolenTrail * P.heat.noLedgerFactor, 6)
    expect(matureTrails(landed).crime.heat).toBe(landed.crime.heat)
    expect(volkovaInterested(landed)).toBe(true)
  })

  it('a bulletin piece heats up at once and its trail reaches you within days', () => {
    const item = piece('h5', 'stolen')
    const listed = { ...s0, crime: { ...s0.crime, bulletin: [{ id: 'b1', day: 4, defId: item.defId, itemId: item.id, text: 'x' }] } }
    const s = heatAfterDeal(listed, walkIn, item)
    expect(s.crime.heat).toBeCloseTo(P.heat.bulletinBuy * P.heat.noLedgerFactor, 6)
    const ev = s.crime.events.find((e) => e.kind === TRAIL)!
    expect(ev.day - s0.calendar.day).toBeLessThanOrEqual(P.trailDays.bulletin[1])
    expect(ev.data?.bulletin).toBe(1)
  })

  it('heat fades by a share every night and old trails are dropped', () => {
    const hot = { ...s0, crime: { ...s0.crime, heat: 0.5 } }
    expect(heatNight(hot).crime.heat).toBeCloseTo(0.5 * (1 - P.heat.decayShare), 3)
    expect(heatNight({ ...s0, crime: { ...s0.crime, heat: 0.0005 } }).crime.heat).toBe(0)
    const old = addEvent(s0, { day: s0.calendar.day - P.trailKeepDays - 1, kind: TRAIL, data: { item: 'x' } })
    expect(heatNight(old).crime.events).toHaveLength(0)
  })

  it('buying through the reducer runs the same check', () => {
    let s = reducer(morning(6), { type: 'day/open' })
    const seller = s.queue.find((v) => v.kind === 'seller' && v.wants === 'sell' && !v.beatId && !v.customer.regularId)!
    const hot = { ...seller, item: { ...seller.item!, provenance: 'stolen' } } as QueuedVisit
    s = offer(reducer({ ...s, queue: [hot, ...s.queue.filter((v) => v !== seller)] }, { type: 'counter/next' }), 150_000)
    expect(s.current?.outcome).toBe('bought')
    expect(s.crime.events.some((e) => e.kind === TRAIL && e.data?.item === hot.item!.id)).toBe(true)
  })
})

describe('police: the stolen-goods bulletin', () => {
  it('prints on some mornings, from its stream, and plans who brings the pieces in', () => {
    let printed = 0
    let brings = 0
    for (let day = 2; day < 62; day++) {
      const s = morning(day, 43)
      const out = printBulletin(s)
      expect(out.meta.rng).toEqual(s.meta.rng)
      if (out === s) continue
      printed++
      for (const e of out.crime.bulletin) {
        const def = getItemDef(e.defId)
        expect(P.bulletin.categories).toContain(def.category)
        expect(e.text).toContain(`, ${wearOf(bulletinPiece(out, e, 'x').condition)}.`)
      }
      brings += out.crime.events.filter((e) => e.kind === 'police.bring').length
    }
    expect(printed).toBeGreaterThan(60 * P.bulletin.chance * 0.5)
    expect(printed).toBeLessThan(60 * P.bulletin.chance * 1.6)
    expect(brings).toBeGreaterThan(0)
  })

  it('otherwise a walk-in seller of its own brings the listed piece in: stolen, genuine, the listed thing as worn', () => {
    const s0 = morning(8)
    const listed = addEvent({ ...s0, crime: { ...s0.crime, bulletin: [{ id: 'b8', day: 6, defId: 'watch_poljot_strela', text: 'x' }] } }, { day: 8, kind: 'police.bring', data: { entry: 'b8' } })
    const open = reducer(listed, { type: 'day/open' })
    const entry = open.crime.bulletin.find((e) => e.id === 'b8')!
    expect(entry.itemId).toBeDefined()
    const v = open.queue.find((q) => q.item?.id === entry.itemId)!
    expect(v.kind).toBe('seller')
    expect(v.visitId).toBe(ids(8)('v', 'bulletin_b8'))
    const plain = reducer(morning(8), { type: 'day/open' })
    expect(open.queue.filter((q) => q !== v).map((q) => q.visitId)).toEqual(plain.queue.map((q) => q.visitId))
    expect(open.meta.rng).toEqual(plain.meta.rng)
    expect(v.customer.regularId).toBeUndefined()
    expect(v.item!.defId).toBe('watch_poljot_strela')
    expect(v.item!.provenance).toBe('stolen')
    expect(v.item!.authenticity).toBe('genuine')
    expect(matchesBulletin({ ...open, crime: { ...open.crime, bulletin: [{ ...entry, text: `Watch, ${wearOf(v.item!.condition)}. Taken.` }] } }, v.item!, 7)).toBe(true)
    expect(open.crime.events.some((e) => e.kind === 'police.bring' && e.data?.entry === 'b8')).toBe(false)
  })

  it('Margarita carries bulletin pieces when she drops in, keeping her greeting', () => {
    const def = getRegular('margarita')!
    let carried = 0
    for (let seed = 1; seed <= 12; seed++) {
      const s = morning(9, seed)
      const visit: QueuedVisit = { visitId: 'vs9_margarita', kind: 'seller', wants: 'sell', customer: regularCustomer(def), item: piece('im', 'clean', 'phone_mangosteen_m5'), patience: 200, line: `${def.lines.warm[0]} It was a gift.` }
      const listed = addEvent({ ...s, crime: { ...s.crime, bulletin: [{ id: 'b9', day: 7, defId: 'gold_signet_583', text: 'x' }] } }, { day: 9, kind: 'police.bring', data: { entry: 'b9' } })
      const out = bringBulletin(listed, [visit], ids(9))
      if (out.story[0]!.item!.defId !== 'gold_signet_583') continue
      carried++
      expect(out.story[0]!.item!.id).toBe('im')
      expect(out.story[0]!.line!.startsWith(def.lines.warm[0]!)).toBe(true)
      expect(out.state.crime.bulletin[0]!.itemId).toBe('im')
    }
    expect(carried).toBeGreaterThan(0)
    expect(carried).toBeLessThan(12)
  })
})

describe('police: Volkova comes round', () => {
  it('stays away from a shop the police have no reason to know', () => {
    const s = morning(10)
    const out = planPolice(s, ids(10))
    expect(out.visit).toBeNull()
  })

  it('once interested she sets a day, comes then, and then about weekly', () => {
    const s = { ...morning(10), crime: { ...morning(10).crime, heat: V.interestHeat } }
    const first = planPolice(s, ids(10))
    const due = first.state.crime.volkova.nextDay
    expect(due - 10).toBeGreaterThanOrEqual(V.firstVisitDays[0])
    expect(due - 10).toBeLessThanOrEqual(V.firstVisitDays[1])
    const atDue = { ...first.state, calendar: { ...first.state.calendar, day: due } }
    const comes = planPolice(atDue, ids(due))
    expect(comes.visit?.visitId).toBe(`vs${due.toString(36)}_volkova`)
    const next = comes.state.crime.volkova.nextDay - due
    expect(next).toBeGreaterThanOrEqual(V.everyDays[0])
    expect(next).toBeLessThanOrEqual(V.everyDays[1])
  })

  it('planning her visit shifts neither the walk-ins’ ids nor the game Rng', () => {
    const quiet = morning(12)
    const watched = { ...quiet, crime: { ...quiet.crime, heat: 0.3, volkova: { ...quiet.crime.volkova, nextDay: 12 } } }
    const a = reducer(quiet, { type: 'day/open' })
    const b = reducer(watched, { type: 'day/open' })
    expect(b.queue.some(isPoliceVisit)).toBe(true)
    expect(b.queue.filter((v) => !isPoliceVisit(v)).map((v) => v.visitId)).toEqual(a.queue.map((v) => v.visitId))
    expect(b.meta.rng).toEqual(a.meta.rng)
    expect(b.meta.nextId).toBe(a.meta.nextId)
  })

  it('introduces herself the first time and asks about the piece you hold', () => {
    const s = volkovaAtCounter(holding(morning(14), piece('v1', 'stolen')))
    expect(s.crime.volkova.met).toBe(true)
    expect(s.story.flags).toContain('police.met')
    const scene = s.current!.scene!
    expect(scene.lines[0]).toBe(volkovaLines.intro[0])
    expect(scene.choices.map((c) => c.id)).toEqual(['cooperate', 'lie', 'bribe'])
  })

  it('remembers who reported the glue in their lock (Protection)', () => {
    const shop = holding(morning(14), piece('v0', 'stolen'))
    const plain = volkovaAtCounter(shop)
    const told = volkovaAtCounter({ ...shop, story: { ...shop.story, flags: [...shop.story.flags, 'protection.told_police'] } })
    expect(told.current!.scene!.lines).toContain(volkovaLines.introReported)
    expect(plain.current!.scene!.lines).not.toContain(volkovaLines.introReported)
    expect(told.crime.volkova.trust).toBeCloseTo(plain.crime.volkova.trust + V.reportedTrust, 6)
  })

  it('with nothing to ask about, she looks at the passport book', () => {
    const shop = morning(14)
    const s = { ...shop, inventory: [piece('v2', 'clean')], paid: { v2: 3000 }, crime: { ...shop.crime, heat: 0.2, volkova: { ...shop.crime.volkova, met: true } } }
    const thin = volkovaAtCounter(s)
    expect(thin.current!.scene!.choices).toHaveLength(0)
    expect(thin.current!.scene!.lines).toContain(volkovaLines.routine.thin)
    const kept = volkovaAtCounter({ ...s, inventory: [piece('v2', 'clean', undefined, [PASSPORT_TELL])] })
    expect(kept.current!.scene!.lines).toContain(volkovaLines.routine.good)
    expect(kept.crime.volkova.trust).toBeGreaterThan(thin.crime.volkova.trust)
  })
})

describe('police: the three answers', () => {
  const base = () => holding(morning(14), piece('a1', 'stolen'), { bulletin: 1 })

  it('cooperate: the piece goes, her trust and the precinct’s view go up, heat down, the clean axis untouched', () => {
    const s0 = volkovaAtCounter({ ...base(), crime: { ...base().crime, heat: 0.4 } })
    const s = answer(s0, 'cooperate')
    expect(s.inventory.some((i) => i.id === 'a1')).toBe(false)
    expect(s.paid.a1).toBeUndefined()
    expect(s.crime.volkova.trust).toBeCloseTo(V.cooperate.trust, 6)
    expect(s.crime.heat).toBeCloseTo(0.4 + V.cooperate.heat, 6)
    expect(repPolice(s)).toBeGreaterThan(repPolice(s0))
    expect(s.career.axes.clean).toBe(s0.career.axes.clean)
    expect(s.day.log.some((e) => e.itemId === 'a1' && e.kind === 'story')).toBe(true)
    expect(openTrails(s)).toHaveLength(0)
  })

  it('cooperate with a passport in the book counts as evidence', () => {
    const s0 = volkovaAtCounter(holding(morning(14), piece('a2', 'stolen', undefined, [PASSPORT_TELL]), { passport: 1 }))
    const s = answer(s0, 'cooperate')
    expect(s.crime.volkova.trust).toBeCloseTo(V.cooperate.trust + V.evidence.trust, 6)
    expect(s.current!.line).toContain(volkovaLines.replies.cooperatePassport)
  })

  it('lie: the clean axis dips, and what she can check decides the catch', () => {
    const s0 = volkovaAtCounter(base())
    const s = answer(s0, 'lie')
    expect(s.crime.volkova.lies).toBe(1)
    expect(s.career.axes.clean).toBeCloseTo(s0.career.axes.clean + tuning.axes.lie, 6)
    const trail = (o: Partial<Trail>): Trail => ({ item: 'x', def: 'gold_bracelet_585', seller: '', bought: 0, passport: 0, tape: 0, bulletin: 0, heat: 0, ...o })
    expect(lieCatchChance(s0, trail({}))).toBeCloseTo(V.lie.base, 6)
    expect(lieCatchChance(s0, trail({ bulletin: 1, tape: 1 }))).toBeCloseTo(V.lie.base + V.lie.bulletin + V.lie.tape, 6)
    expect(lieCatchChance(s0, trail({ bulletin: 1, tape: 1, passport: 1 }))).toBeLessThanOrEqual(V.lie.max)
  })

  it('lie about a bulletin piece: caught on some careers, getting away with it on others', () => {
    let caught = 0
    let away = 0
    for (let seed = 1; seed <= 16; seed++) {
      const s = answer(volkovaAtCounter(holding(morning(14, seed), piece('a3', 'stolen'), { bulletin: 1 })), 'lie')
      if (s.crime.volkova.caught > 0) {
        caught++
        expect(s.inventory.some((i) => i.id === 'a3')).toBe(false)
        expect(s.story.flags).toContain('police.caught')
      } else {
        away++
        expect(s.inventory.some((i) => i.id === 'a3')).toBe(true)
      }
    }
    expect(caught).toBeGreaterThan(0)
    expect(away).toBeGreaterThan(0)
  })

  it('a lie that holds may bring her back to check, and the second look can catch it', () => {
    let rechecked = 0
    for (let seed = 1; seed <= 30 && rechecked === 0; seed++) {
      const s = answer(volkovaAtCounter(holding(morning(14, seed), piece('a4', 'stolen'))), 'lie')
      const ev = s.crime.events.find((e) => e.kind === 'police.recheck')
      if (s.crime.volkova.caught > 0 || !ev) continue
      rechecked++
      const back = volkovaAtCounter(atDay(run(s, { type: 'scene/next' }), ev.day), 'recheck')
      expect(back.crime.events.some((e) => e.kind === 'police.recheck')).toBe(false)
      expect(back.current!.scene!.choices).toHaveLength(0)
    }
    expect(rechecked).toBe(1)
  })

  it('bribe: cash and the clean axis go, heat drops; no envelope offered without the cash', () => {
    const s0 = volkovaAtCounter({ ...base(), crime: { ...base().crime, heat: 0.4 } })
    const amount = bribeAmount(s0)
    expect(amount).toBe(Math.round((V.bribe.base + V.bribe.perHeat * 0.4) / 500) * 500)
    const s = answer(s0, 'bribe')
    expect(s.career.axes.clean).toBeCloseTo(s0.career.axes.clean + tuning.axes.bribe, 6)
    if (s.crime.volkova.bribes === 1) {
      expect(s.cash).toBe(s0.cash - amount)
      expect(s.crime.heat).toBeCloseTo(0.4 + V.bribe.heat, 6)
      expect(s.inventory.some((i) => i.id === 'a1')).toBe(true)
    } else {
      expect(s.inventory.some((i) => i.id === 'a1')).toBe(false)
      expect(s.crime.heat).toBeGreaterThan(0.4)
    }
    const broke = volkovaAtCounter({ ...base(), cash: 100 })
    expect(broke.current!.scene!.choices.map((c) => c.id)).toEqual(['cooperate', 'lie'])
  })

  it('each envelope makes the next more likely to be refused, up to a cap', () => {
    const curve = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(bribeFailChance)
    expect(curve[0]).toBeCloseTo(V.bribe.failBase, 6)
    for (let i = 1; i < curve.length; i++) expect(curve[i]!).toBeGreaterThanOrEqual(curve[i - 1]!)
    expect(curve[3]!).toBeGreaterThan(curve[0]! * 4)
    expect(curve[8]).toBe(V.bribe.failMax)
  })

  it('asked about a piece you no longer have: handing over what you know costs nothing in stock', () => {
    const held = base()
    const sold = { ...held, inventory: held.inventory.filter((i) => i.id !== 'a1') }
    const s0 = volkovaAtCounter(sold)
    expect(s0.current!.scene!.choices[0]!.label).toBe(volkovaLines.choices.cooperateGone)
    const s = answer(s0, 'cooperate')
    expect(s.crime.volkova.trust).toBeCloseTo(V.cooperate.goneTrust, 6)
    expect(s.inventory).toEqual(s0.inventory)
  })

  it('story conditions can read her state and the heat', () => {
    const s = answer(volkovaAtCounter(base()), 'cooperate')
    expect(allHold([{ if: 'volkova', met: true, trust: { gte: 0.1 } }], s)).toBe(true)
    expect(allHold([{ if: 'volkova', lies: { gte: 1 } }], s)).toBe(false)
    expect(allHold([{ if: 'heat', lte: 0.5 }], s)).toBe(true)
  })
})

describe('police: the raid', () => {
  it('is only ordered past the line, and more likely the hotter the shop', () => {
    const s = morning(20)
    expect(rollRaid({ ...s, crime: { ...s.crime, heat: P.raid.at - 0.01 } }).crime.events).toHaveLength(0)
    let ordered = 0
    for (let seed = 1; seed <= 20; seed++) {
      const hot = morning(20, seed)
      const out = rollRaid({ ...hot, crime: { ...hot.crime, heat: 2 } })
      if (out.crime.events.some((e) => e.kind === RAID && e.day === 21)) ordered++
    }
    expect(ordered).toBeGreaterThan(5)
  })

  it('takes stolen pieces and unbooked ones of unknown origin, fines the shop and cools it', () => {
    let s = morning(20)
    const stolen = piece('r1', 'stolen')
    const unbooked = piece('r2', 'unknown')
    const booked = piece('r3', 'unknown', undefined, [PASSPORT_TELL])
    const old = piece('r4', 'stolen')
    s = { ...s, inventory: [stolen, unbooked, booked, old], paid: { r1: 4000, r2: 4000, r3: 4000, r4: 0 }, crime: { ...s.crime, heat: 1 } }
    expect(raidTargets(s).sort()).toEqual(['r1', 'r2'])
    const out = executeRaid(addEvent(s, { day: 20, kind: RAID }))
    expect(out.inventory.map((i) => i.id).sort()).toEqual(['r3', 'r4'])
    const fine = P.raid.fine.base + 2 * P.raid.fine.perItem
    expect(out.cash).toBe(s.cash - fine)
    expect(out.crime.heat).toBeCloseTo(P.raid.heatKeep, 6)
    expect(out.crime.flags).toContain('police.raided')
    expect(out.career.end).toBeFalsy()
  })

  it('a second raid, or one at shutdown heat, closes the shop for good', () => {
    const s = morning(20)
    const again = executeRaid({ ...s, crime: { ...s.crime, heat: 1, flags: ['police.raided'] } })
    expect(again.career.end?.kind).toBe('raided')
    const scorching = executeRaid({ ...s, crime: { ...s.crime, heat: P.raid.shutdownHeat } })
    expect(scorching.career.end?.kind).toBe('raided')
  })

  it('happens at opening, first thing, as a scene', () => {
    const s0 = holding(morning(22), piece('r5', 'stolen'))
    const ordered = addEvent({ ...s0, crime: { ...s0.crime, heat: 1 } }, { day: 22, kind: RAID })
    const open = reducer(ordered, { type: 'day/open' })
    expect(open.inventory.some((i) => i.id === 'r5')).toBe(false)
    expect(open.queue[0]!.visitId).toBe(`vs${(22).toString(36)}_raid`)
    const at = reducer(open, { type: 'counter/next' })
    expect(at.current!.scene!.lines[0]).toBe(volkovaLines.raid.open)
    expect(at.current!.scene!.choices).toHaveLength(0)
  })

  it('someone back for a seized pledge is told so and leaves', () => {
    const s0 = morning(24)
    const item = piece('r6', 'stolen')
    const loan = { id: 'l-r6', item, customer: walkIn, principal: 3000, startDay: 10, dueDay: 40, monthlyRate: tuning.loans.monthlyRate, redeemDay: 24 }
    let open = reducer({ ...s0, loans: [loan] }, { type: 'day/open' })
    const visit = open.queue.find((v) => v.loanId === 'l-r6')!
    open = { ...open, loans: [], queue: [visit, ...open.queue.filter((v) => v !== visit)] }
    const at = reducer(open, { type: 'counter/next' })
    expect(at.current!.phase).toBe('resolved')
    expect(at.current!.outcome).toBe('left')
    expect(at.current!.line).toContain(getItemDef(item.defId).name)
  })
})
