/** M5 foundation: the ending axes, endCareer, and the v7 → v8 save step. */
import { describe, expect, it } from 'vitest'
import { ITEM_DEFS } from '../src/data/items'
import { tuning } from '../src/data/tuning'
import { axesAfterDeal, axisOf, flagAxis, nudgeAxis } from '../src/game/endings/axes'
import { canRetire, endCareer, isOver } from '../src/game/endings/end'
import { generateItem } from '../src/game/items/generate'
import { Rng } from '../src/game/rng'
import { migrate } from '../src/game/save/migrations'
import { STATE_VERSION, type GameState } from '../src/game/state'
import { applyEffect } from '../src/game/story/effects'
import type { ItemInstance, WalkIn } from '../src/game/types'
import { startedState } from './helpers'

const A = tuning.axes

function person(archetype: string, desperation: number): WalkIn {
  return { id: 'c1', name: 'Zoya', archetype, temperament: 'flexible', knowledge: 0.5, desperation, portraitKey: archetype }
}

function item(value: number, provenance: ItemInstance['provenance'] = 'clean'): ItemInstance {
  const it = generateItem(ITEM_DEFS[0]!, new Rng(3), 'i1')
  return { ...it, trueValue: value, authenticity: 'genuine', provenance }
}

const atDay = (s: GameState, day: number): GameState => ({ ...s, calendar: { ...s.calendar, day } })

describe('ending axes', () => {
  it('a new career starts at zero with no ending', () => {
    const s = startedState(1, 'c')
    expect(s.career).toEqual({ axes: { clean: 0, heart: 0 }, end: null })
    expect(s.stats.peopleHelped).toBe(0)
    expect(s.stats.peopleHurt).toBe(0)
  })

  it('nudgeAxis moves one axis and stops once the career is over', () => {
    let s = nudgeAxis(startedState(1, 'c'), 'heart', 0.25)
    s = nudgeAxis(s, 'clean', -1)
    expect(axisOf(s, 'heart')).toBe(0.25)
    expect(axisOf(s, 'clean')).toBe(-1)
    const over = endCareer(s, 'evicted')
    expect(nudgeAxis(over, 'heart', 5)).toBe(over)
  })

  it('a fair deal for someone vulnerable is heart and a person helped; a lowball is hustle and a person hurt', () => {
    const s = startedState(1, 'c')
    const pensioner = person('pensioner', 0.3)
    const fair = axesAfterDeal(s, pensioner, item(10_000), 6_000, 'buy')
    expect(axisOf(fair, 'heart')).toBe(A.fairDeal)
    expect(fair.stats.peopleHelped).toBe(1)
    const low = axesAfterDeal(s, pensioner, item(10_000), 1_000, 'buy')
    expect(axisOf(low, 'heart')).toBe(A.lowball)
    expect(low.stats.peopleHurt).toBe(1)
    // Someone comfortable: no judgement either way.
    expect(axesAfterDeal(s, person('office', 0.1), item(10_000), 1_000, 'buy')).toBe(s)
  })

  it('a stolen piece dirties the shop, known or not', () => {
    const s = axesAfterDeal(startedState(1, 'c'), person('office', 0.1), item(10_000, 'stolen'), 5_000, 'pawn')
    expect(axisOf(s, 'clean')).toBe(A.stolenBought)
  })

  it('heart.* and dirty.* story flags count once', () => {
    expect(flagAxis('heart.x')).toEqual({ axis: 'heart', delta: A.storyHeart })
    expect(flagAxis('dirty.x')).toEqual({ axis: 'clean', delta: A.storyDirty })
    expect(flagAxis('protection.running')).toBeNull()
    let s = applyEffect(startedState(1, 'c'), { do: 'flag', flag: 'heart.test' }, 'test')
    s = applyEffect(s, { do: 'flag', flag: 'heart.test' }, 'test')
    s = applyEffect(s, { do: 'flag', flag: 'dirty.test' }, 'test')
    expect(s.career.axes).toEqual({ clean: A.storyDirty, heart: A.storyHeart })
  })
})

describe('endCareer', () => {
  it('retiring opens on the retire day', () => {
    const s = startedState(1, 'c')
    expect(canRetire(atDay(s, tuning.endings.retireDay - 1))).toBe(false)
    expect(endCareer(atDay(s, 10), 'retired')).toEqual(atDay(s, 10))
    const done = endCareer(atDay(s, tuning.endings.retireDay), 'retired')
    expect(done.career.end).toEqual({ kind: 'retired', day: tuning.endings.retireDay })
    expect(isOver(done)).toBe(true)
    expect(canRetire(done)).toBe(false)
  })

  it('a forced ending can come any day, and the first ending wins', () => {
    const s = endCareer(atDay(startedState(1, 'c'), 12), 'raided')
    expect(s.career.end).toEqual({ kind: 'raided', day: 12 })
    expect(endCareer(s, 'pushedOut')).toBe(s)
  })
})

describe('v7 → v8', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately untyped old-shape record
  function v7(): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately untyped old-shape record
    const raw = JSON.parse(JSON.stringify(startedState(5, 'c'))) as Record<string, any>
    raw.meta.version = 7
    raw.crime = { heat: 2, pressure: 1, fenceTrust: 0.3, flags: ['x'] }
    raw.story.flags = ['heart.gennady_family', 'dirty.stanislav_silver', 'heart.ilya_widow', 'protection.running']
    delete raw.career
    delete raw.stats.peopleHelped
    delete raw.stats.peopleHurt
    return raw
  }

  it('keeps heat, pressure and the fence, and lays down the new crime state', () => {
    const m = migrate(v7())
    expect(m.meta.version).toBe(STATE_VERSION)
    expect(m.crime.heat).toBe(2)
    expect(m.crime.pressure).toBe(1)
    expect(m.crime.fenceTrust).toBe(0.3)
    expect(m.crime.flags).toEqual(['x'])
    expect(m.crime.bulletin).toEqual([])
    expect(m.crime.events).toEqual([])
    expect(m.crime.volkova).toEqual({ met: false, trust: 0, nextDay: 0, lies: 0, caught: 0, bribes: 0 })
    expect(m.crime.fence).toEqual({ met: false, deals: 0, refusals: 0, nextDay: 0 })
  })

  it('seeds the axes from story choices already made', () => {
    const m = migrate(v7())
    expect(m.career.axes).toEqual({ clean: A.storyDirty, heart: 2 * A.storyHeart })
    expect(m.career.end).toBeNull()
    expect(m.stats.peopleHelped).toBe(0)
    expect(m.stats.peopleHurt).toBe(0)
  })
})

describe('crime dials', () => {
  it('heat and pressure move through addHeat / addPressure and never go below zero', async () => {
    const { addHeat, addPressure } = await import('../src/game/crime/dials')
    let s = addHeat(startedState(1, 'c'), 0.3)
    s = addPressure(s, 0.2)
    expect(s.crime.heat).toBe(0.3)
    expect(s.crime.pressure).toBe(0.2)
    expect(addHeat(s, -1).crime.heat).toBe(0)
    expect(applyEffect(s, { do: 'pressure', delta: -0.05 }, 'protection').crime.pressure).toBe(0.15)
  })
})
