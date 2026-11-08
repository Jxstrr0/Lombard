import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bedsFor, cuesFor, prefetchFor } from '../src/audio/cues'
import { parseSoundSettings } from '../src/audio/settings'
import { TramSchedule, tramGap } from '../src/audio/tram'
import {
  BEDS,
  DEFAULT_SOUND_SETTINGS,
  INSPECT_SOUND,
  LAZY_DIR,
  LAZY_SOUND_IDS,
  SOUND_DETUNE,
  SOUND_GAIN,
  SOUND_IDS,
  TOOL_SOUND,
  TRAM,
} from '../src/data/audio'
import { ITEM_DEFS } from '../src/data/items'
import { reducer, type Action } from '../src/game/actions'
import { floodDay } from '../src/game/city/flood'
import type { GameState } from '../src/game/state'
import { startedState } from './helpers'

function step(s: GameState, action: Action) {
  const next = reducer(s, action)
  return { next, cues: cuesFor(s, next, action).map((c) => c.sound) }
}

/** A day opened, paper read, and the first seller at the counter. */
function atCounter(): GameState {
  let s = startedState(7, 'career-audio')
  s = reducer(s, { type: 'day/open' })
  s = reducer(s, { type: 'news/dismiss' })
  // Put a seller first so the test does not depend on the queue order.
  const i = s.queue.findIndex((v) => v.kind === 'seller')
  expect(i).toBeGreaterThanOrEqual(0)
  return { ...s, queue: [s.queue[i]!, ...s.queue.filter((_, j) => j !== i)] }
}

/** The seller at the counter brings this item instead. */
function withItem(s: GameState, defId: string): GameState {
  const c = s.current!
  return { ...s, current: { ...c, item: { ...c.item!, defId } } as GameState['current'] }
}

describe('audio cues', () => {
  it('rings the door and sets the item down when a customer steps up', () => {
    const { next, cues } = step(atCounter(), { type: 'counter/next' })
    expect(next.current?.kind).toBe('seller')
    expect(cues).toEqual(['door_bell', 'set_down'])
  })

  it('plays the tool sound only when the tool was actually used', () => {
    let s = reducer(atCounter(), { type: 'counter/next' })
    s = reducer(s, { type: 'counter/inspect' })
    const used = step(s, { type: 'inspect/useTool', tool: 'loupe' })
    expect(used.cues).toEqual([TOOL_SOUND.loupe])
    // Not inspecting any more: the reducer ignores the tool, so there is no sound.
    const done = reducer(used.next, { type: 'inspect/done' })
    expect(step(done, { type: 'inspect/useTool', tool: 'scale' }).cues).toEqual([])
  })

  it('plays the cash drawer when money changes hands, once', () => {
    const s = reducer(atCounter(), { type: 'counter/next' })
    const c = s.current!
    const paid: GameState = { ...s, current: { ...c, phase: 'resolved', outcome: 'bought', price: 1000 } }
    expect(cuesFor(s, paid, { type: 'offer/acceptAsk' }).map((q) => q.sound)).toEqual(['cash'])
    expect(cuesFor(paid, { ...paid }, { type: 'time/tick', seconds: 1 })).toEqual([])
    const passed: GameState = { ...s, current: { ...c, phase: 'resolved', outcome: 'passed' } }
    expect(cuesFor(s, passed, { type: 'counter/pass' })).toEqual([])
  })

  it('stays silent when a save is loaded', () => {
    const s = atCounter()
    const loaded = reducer(s, { type: 'counter/next' })
    expect(cuesFor(s, loaded, { type: 'store/replace' })).toEqual([])
  })

  it('rolls the shutter up (then the paper) when the day opens, down when it closes', () => {
    const closed = startedState(7, 'career-audio')
    const open = step(closed, { type: 'day/open' })
    expect(open.cues[0]).toBe('shutter_up')
    if (!open.next.day.newsRead) expect(open.cues).toEqual(['shutter_up', 'newspaper'])
    // Empty the day so it can close.
    const empty: GameState = { ...open.next, queue: [], current: null, day: { ...open.next.day, newsRead: true } }
    const shut = step(empty, { type: 'day/close' })
    expect(shut.next.day.phase).toBe('closed')
    expect(shut.cues).toEqual(['shutter_down'])
  })

  it('shuts the door behind a walk-in once they reach it, not after a phone call', () => {
    const s = reducer(atCounter(), { type: 'counter/next' })
    const c = s.current!
    const resolved: GameState = { ...s, current: { ...c, phase: 'resolved', outcome: 'passed' } }
    const out = cuesFor(resolved, reducer(resolved, { type: 'counter/dismiss' }), { type: 'counter/dismiss' })
    expect(out).toEqual([{ sound: 'door_close', atDoor: true }])
    const call: GameState = { ...resolved, current: { ...resolved.current!, via: 'phone' } }
    expect(cuesFor(call, reducer(call, { type: 'counter/dismiss' }), { type: 'counter/dismiss' })).toEqual([])
  })

  it('rings the phone for an incoming call instead of the door bell', () => {
    const s = atCounter()
    const call: GameState = { ...s, queue: [{ ...s.queue[0]!, via: 'phone' }, ...s.queue.slice(1)] }
    const { next, cues } = step(call, { type: 'counter/next' })
    expect(next.current?.via).toBe('phone')
    expect(cues).toEqual(['phone_ring'])
  })

  it('stamps a pawn ticket before the cash drawer', () => {
    const s = reducer(atCounter(), { type: 'counter/next' })
    const pawned: GameState = { ...s, current: { ...s.current!, phase: 'resolved', outcome: 'pawned', price: 1000 } }
    const cues = cuesFor(s, pawned, { type: 'offer/acceptAsk' })
    expect(cues.map((q) => q.sound)).toEqual(['stamp', 'cash'])
    expect(cues[1]!.delay).toBeGreaterThan(0)
  })

  it('winds a watch / clicks a camera once when it is picked up to inspect', () => {
    for (const [category, sound] of Object.entries(INSPECT_SOUND)) {
      const def = ITEM_DEFS.find((d) => d.category === category)!
      const present = withItem(reducer(atCounter(), { type: 'counter/next' }), def.id)
      const inspecting = reducer(present, { type: 'counter/inspect' })
      expect(inspecting.current?.phase).toBe('inspect')
      expect(cuesFor(present, inspecting, { type: 'counter/inspect' }).map((q) => q.sound)).toEqual([sound])
      expect(prefetchFor(present)).toContain(sound)
      // Back from the offer to look again: no repeat.
      const offer: GameState = { ...inspecting, current: { ...inspecting.current!, phase: 'offer' } }
      expect(cuesFor(offer, reducer(offer, { type: 'inspect/back' }), { type: 'inspect/back' })).toEqual([])
    }
    const gold = ITEM_DEFS.find((d) => d.category === 'gold')!
    const present = withItem(reducer(atCounter(), { type: 'counter/next' }), gold.id)
    expect(cuesFor(present, reducer(present, { type: 'counter/inspect' }), { type: 'counter/inspect' })).toEqual([])
  })

  it('maps every tool to a sound', () => {
    for (const sound of Object.values(TOOL_SOUND)) expect(sound).toMatch(/^tool_/)
  })
})

describe('ambience beds', () => {
  it('plays rain only while the street shows rain, louder in a downpour', () => {
    const s = startedState(7, 'career-audio')
    expect(bedsFor(s, null).rain).toBe(0)
    expect(bedsFor(s, { kind: 'clear', intensity: 0 }).rain).toBe(0)
    expect(bedsFor(s, { kind: 'snow', intensity: 1 }).rain).toBe(0)
    const light = bedsFor(s, { kind: 'rain', intensity: 0.2 }).rain
    const heavy = bedsFor(s, { kind: 'rain', intensity: 1 }).rain
    expect(light).toBeGreaterThan(0)
    expect(heavy).toBeGreaterThan(light)
    expect(heavy).toBeLessThanOrEqual(1)
  })

  it('plays the flood water while it stands in the shop, and not before or after', () => {
    const s = startedState(7, 'career-audio')
    const on = (day: number) => bedsFor({ ...s, calendar: { ...s.calendar, day } }, null).flood
    const d = floodDay(s.meta.seed)
    expect(on(d - 2)).toBe(0)
    expect(on(d)).toBe(1)
    expect(on(d + 40)).toBe(0)
  })
})

describe('lazy sounds', () => {
  it('keeps the new sounds out of the first-tap preload and ships every file', () => {
    for (const id of LAZY_SOUND_IDS) {
      expect(SOUND_IDS as readonly string[]).not.toContain(id)
      expect(SOUND_GAIN[id]).toBeGreaterThan(0)
      expect(existsSync(`public/assets/audio/${LAZY_DIR}${id}.mp3`)).toBe(true)
    }
    for (const bed of Object.values(BEDS)) expect(existsSync(`public/assets/audio/${LAZY_DIR}${bed.file}`)).toBe(true)
    for (const id of Object.keys(SOUND_DETUNE)) expect([...SOUND_IDS, ...LAZY_SOUND_IDS] as string[]).toContain(id)
  })

  it('prefetches only lazy sounds, by what is coming', () => {
    const closed = startedState(7, 'career-audio')
    expect(prefetchFor(closed)).toEqual(['shutter_up', 'newspaper'])
    const s = reducer(atCounter(), { type: 'counter/next' })
    expect(prefetchFor(s)).toEqual(expect.arrayContaining(['door_close', 'stamp', 'phone_ring']))
    expect(prefetchFor({ ...s, current: null, queue: [] })).toEqual(['shutter_down'])
    for (const id of [...prefetchFor(closed), ...prefetchFor(s)]) expect(LAZY_SOUND_IDS as readonly string[]).toContain(id)
  })
})

describe('distant trams', () => {
  it('draws the same gaps for the same day, within the tuned range', () => {
    expect(tramGap(7, 3, 0)).toBe(tramGap(7, 3, 0))
    expect(tramGap(7, 3, 1)).not.toBe(tramGap(7, 4, 1))
    for (let n = 0; n < 20; n++) {
      const [lo, hi] = n === 0 ? TRAM.first : TRAM.gap
      const g = tramGap(11, 5, n)
      expect(g).toBeGreaterThanOrEqual(lo)
      expect(g).toBeLessThan(hi)
    }
  })

  it('passes only while the shop is open, at most every couple of minutes', () => {
    const t = new TramSchedule()
    let passes = 0
    for (let i = 0; i < 6000; i++) if (t.update(0.1, 7, 3, false)) passes++
    expect(passes).toBe(0)
    // Ten real minutes open.
    for (let i = 0; i < 6000; i++) if (t.update(0.1, 7, 3, true)) passes++
    expect(passes).toBeGreaterThanOrEqual(1)
    expect(passes).toBeLessThanOrEqual(Math.ceil(600 / TRAM.gap[0]) + 1)
  })
})

describe('sound settings', () => {
  it('parses stored values and falls back to the defaults', () => {
    expect(parseSoundSettings(null, null)).toEqual(DEFAULT_SOUND_SETTINGS)
    expect(parseSoundSettings('0', '0.5')).toEqual({ enabled: false, ambience: 0.5 })
    expect(parseSoundSettings('1', '0')).toEqual({ enabled: true, ambience: 0 })
    expect(parseSoundSettings('x', '7')).toEqual(DEFAULT_SOUND_SETTINGS)
  })
})
