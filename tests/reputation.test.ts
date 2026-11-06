import { describe, expect, it } from 'vitest'
import { ITEM_DEFS } from '../src/data/items'
import { reputationLines } from '../src/data/reputationLines'
import { tuning } from '../src/data/tuning'
import { reducer } from '../src/game/actions'
import { generateItem } from '../src/game/items/generate'
import {
  adjustRep,
  buyerRepFactor,
  patienceRepFactor,
  repAfterDeal,
  repAfterInsult,
  repAfterRedeem,
  repAfterSale,
  repAfterWalkout,
  repBand,
  repOf,
  repToday,
  standingLines,
  theftRepFactor,
} from '../src/game/reputation'
import { Rng } from '../src/game/rng'
import { migrate } from '../src/game/save/migrations'
import { sellChance } from '../src/game/sell/buyer'
import { type GameState } from '../src/game/state'
import type { ItemInstance, WalkIn } from '../src/game/types'
import { startedState } from './helpers'

const R = tuning.reputation

function person(archetype: string, desperation: number): WalkIn {
  return { id: 'c1', name: 'Zoya', archetype, temperament: 'flexible', knowledge: 0.5, desperation, portraitKey: archetype }
}

function item(value: number, authenticity: ItemInstance['authenticity'] = 'genuine'): ItemInstance {
  const it = generateItem(ITEM_DEFS[0]!, new Rng(3), 'i1')
  return { ...it, trueValue: value, authenticity }
}

const pensioner = person('pensioner', 0.3)
const desperate = person('office', 0.9)
const comfortable = person('office', 0.2)
const student = person('student', 0.3)

describe('adjustRep', () => {
  it('moves a group, clamps to −1…1 and tallies today’s change', () => {
    let s = startedState(1, 'c')
    s = adjustRep(s, 'neighbourhood', 0.3, 'test')
    expect(repOf(s, 'neighbourhood')).toBeCloseTo(0.3)
    expect(repToday(s, 'neighbourhood')).toBeCloseTo(0.3)
    s = adjustRep(s, 'neighbourhood', 5)
    expect(repOf(s, 'neighbourhood')).toBe(R.max)
    expect(repToday(s, 'neighbourhood')).toBeCloseTo(1)
    s = adjustRep(s, 'neighbourhood', -9)
    expect(repOf(s, 'neighbourhood')).toBe(R.min)
    expect(repOf(s, 'youth')).toBe(0)
  })

  it('returns the same state when nothing changes', () => {
    const s = startedState(1, 'c')
    expect(adjustRep(s, 'mob', 0)).toBe(s)
    expect(adjustRep(s, 'mob', Number.NaN)).toBe(s)
    const top = adjustRep(s, 'youth', 2)
    expect(adjustRep(top, 'youth', 0.1)).toBe(top)
  })

  it('today’s tally resets when the shop opens', () => {
    let s = adjustRep(startedState(1, 'c'), 'youth', 0.1)
    s = reducer(s, { type: 'day/open' })
    expect(repToday(s, 'youth')).toBe(0)
    expect(repOf(s, 'youth')).toBeCloseTo(0.1)
  })
})

describe('what moves each group', () => {
  const s0 = startedState(1, 'c')

  it('fair buys and loans for vulnerable sellers warm the neighbourhood; lowballs cool it', () => {
    expect(repOf(repAfterDeal(s0, pensioner, item(10_000), 5_000, 'buy'), 'neighbourhood')).toBeCloseTo(R.neighbourhood.fair)
    expect(repOf(repAfterDeal(s0, desperate, item(10_000), 3_000, 'pawn'), 'neighbourhood')).toBeCloseTo(R.neighbourhood.fair)
    expect(repOf(repAfterDeal(s0, desperate, item(10_000), 2_000, 'buy'), 'neighbourhood')).toBeCloseTo(R.neighbourhood.lowball)
    expect(repOf(repAfterDeal(s0, pensioner, item(10_000), 1_000, 'pawn'), 'neighbourhood')).toBeCloseTo(R.neighbourhood.lowball)
    // The healthy middle (40% of value) is neither.
    expect(repAfterDeal(s0, pensioner, item(10_000), 4_000, 'buy')).toBe(s0)
  })

  it('people who aren’t vulnerable don’t move the neighbourhood with a deal', () => {
    expect(repAfterDeal(s0, comfortable, item(10_000), 1_000, 'buy')).toBe(s0)
    expect(repAfterDeal(s0, comfortable, item(10_000), 9_000, 'buy')).toBe(s0)
  })

  it('a fake’s real worth says nothing about fairness', () => {
    expect(repAfterDeal(s0, pensioner, item(500, 'fake'), 4_000, 'buy')).toBe(s0)
    expect(repAfterDeal(s0, pensioner, item(500, 'frankenstein'), 400, 'buy')).toBe(s0)
    // …but restored pieces are real enough to judge.
    expect(repOf(repAfterDeal(s0, pensioner, item(10_000, 'restored'), 6_000, 'buy'), 'neighbourhood')).toBeGreaterThan(0)
  })

  it('students move the youth group', () => {
    expect(repOf(repAfterDeal(s0, student, item(4_000), 2_400, 'buy'), 'youth')).toBeCloseTo(R.youth.fair)
    expect(repOf(repAfterDeal(s0, student, item(4_000), 500, 'buy'), 'youth')).toBeCloseTo(R.youth.lowball)
    expect(repOf(repAfterInsult(s0, student), 'youth')).toBeCloseTo(R.youth.lowball)
    expect(repOf(repAfterWalkout(s0, student), 'youth')).toBeCloseTo(R.youth.walkout)
    expect(repOf(repAfterSale(s0, student), 'youth')).toBeCloseTo(R.youth.sale)
    expect(repAfterSale(s0, comfortable)).toBe(s0)
  })

  it('insults, walkouts and redemptions move the neighbourhood', () => {
    expect(repOf(repAfterInsult(s0, comfortable), 'neighbourhood')).toBeCloseTo(R.neighbourhood.insult)
    expect(repOf(repAfterWalkout(s0, comfortable), 'neighbourhood')).toBeCloseTo(R.neighbourhood.walkout)
    expect(repOf(repAfterRedeem(s0), 'neighbourhood')).toBeCloseTo(R.neighbourhood.redeem)
  })

  it('specialists follow the mean relationship of everyone ever retained', () => {
    let s = { ...s0, cash: 100_000 }
    s = reducer(s, { type: 'specialist/retain', id: 'jeweler' })
    expect(repOf(s, 'specialists')).toBeCloseTo(tuning.specialists.relationshipStart)
    s = reducer(s, { type: 'specialist/release', id: 'jeweler' })
    expect(repOf(s, 'specialists')).toBeCloseTo(Math.max(0, tuning.specialists.relationshipStart - tuning.specialists.releaseRelationshipLoss))
  })

  it('police and mob stay at zero in the current game', () => {
    expect(repOf(s0, 'police')).toBe(0)
    expect(repOf(s0, 'mob')).toBe(0)
  })

  it('the reducer applies them at the counter: a walkout cools the street', () => {
    let s = reducer(startedState(5, 'c'), { type: 'day/open' })
    if (!s.day.newsRead) s = reducer(s, { type: 'news/dismiss' })
    s = reducer(s, { type: 'counter/next' })
    // Stand there long enough for everyone in the queue to give up.
    s = reducer(s, { type: 'time/tick', seconds: 10_000 })
    expect(s.queue.length).toBe(0)
    expect(repOf(s, 'neighbourhood')).toBeLessThan(0)
  })
})

describe('what each group does', () => {
  it('the neighbourhood scales buyer chance and queue patience', () => {
    const s0 = startedState(1, 'c')
    const warm = adjustRep(s0, 'neighbourhood', 1)
    const cold = adjustRep(s0, 'neighbourhood', -1)
    expect(buyerRepFactor(s0)).toBe(1)
    expect(buyerRepFactor(warm)).toBeCloseTo(1 + R.effects.buyerPerNeighbourhood)
    expect(patienceRepFactor(cold)).toBeCloseTo(1 - R.effects.patiencePerNeighbourhood)
    const it = item(5_000)
    expect(sellChance(warm, it, 'counter', 5_000)).toBeGreaterThan(sellChance(s0, it, 'counter', 5_000))
    expect(sellChance(cold, it, 'counter', 5_000)).toBeLessThan(sellChance(s0, it, 'counter', 5_000))
  })

  it('a warm street makes the queue more patient at day open', () => {
    const s0 = startedState(1, 'c')
    const a = reducer(s0, { type: 'day/open' })
    const b = reducer(adjustRep(s0, 'neighbourhood', 1), { type: 'day/open' })
    expect(b.queue.map((v) => v.visitId)).toEqual(a.queue.map((v) => v.visitId))
    for (let i = 0; i < a.queue.length; i++) expect(b.queue[i]!.patience).toBeGreaterThan(a.queue[i]!.patience)
  })

  it('the kids’ standing scales shoplifting', () => {
    const s0 = startedState(1, 'c')
    expect(theftRepFactor(adjustRep(s0, 'youth', -1))).toBeCloseTo(1 + R.effects.theftPerYouth)
    expect(theftRepFactor(adjustRep(s0, 'youth', 1))).toBeCloseTo(1 - R.effects.theftPerYouth)
  })
})

describe('ledger lines', () => {
  it('bands: cold, cool, neutral, warm, close', () => {
    expect([-1, -0.5, -0.3, -0.15, 0, 0.1, 0.15, 0.49, 0.5, 1].map(repBand)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4])
  })

  it('never shows numbers; neighbourhood and kids always, police and mob only when they move', () => {
    const s = startedState(1, 'c')
    const lines = standingLines(s)
    expect(lines.map((l) => l.group)).toEqual(['neighbourhood', 'youth'])
    expect(lines[0]!.text).toBe(reputationLines.neighbourhood.bands[2])
    for (const l of lines) expect(l.text).not.toMatch(/\d/)
  })

  it('a day that moved a group reads as a trend', () => {
    let s: GameState = startedState(1, 'c')
    s = adjustRep(s, 'neighbourhood', 0.04)
    s = adjustRep(s, 'youth', -0.06)
    const lines = Object.fromEntries(standingLines(s).map((l) => [l.group, l.text]))
    expect(lines.neighbourhood).toBe(reputationLines.neighbourhood.up)
    expect(lines.youth).toBe(reputationLines.youth.down)
  })

  it('a settled standing reads as its band; specialists appear once retained', () => {
    let s: GameState = reducer(adjustRep(startedState(1, 'c'), 'youth', -0.7), { type: 'day/open' })
    s = { ...s, specialists: { jeweler: { retained: true, relationship: 0.6, callsUsed: 0, sinceDay: 1 } } }
    s = adjustRep(s, 'specialists', 0.6)
    s = { ...s, day: { ...s.day, repDelta: {} } }
    const lines = Object.fromEntries(standingLines(s).map((l) => [l.group, l.text]))
    expect(lines.youth).toBe(reputationLines.youth.bands[0])
    expect(lines.specialists).toBe(reputationLines.specialists.bands[4])
  })
})

describe('v3 → v4 save migration', () => {
  it('adds the youth group and the stolen count, keeping the rest', () => {
    const s = startedState(9, 'old')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately untyped old-shape record
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, any>
    raw.meta.version = 3
    raw.reputation = { general: -4, byGroup: { neighbourhood: 0.2, police: 0, mob: 0, specialists: 0.1 } }
    delete raw.stats.itemsStolen
    const m = migrate(raw)
    expect(m.reputation.general).toBe(-4)
    expect(m.reputation.byGroup).toEqual({ neighbourhood: 0.2, youth: 0, police: 0, mob: 0, specialists: 0.1 })
    expect(m.stats.itemsStolen).toBe(0)
    expect(standingLines(m).length).toBeGreaterThan(0)
  })
})
