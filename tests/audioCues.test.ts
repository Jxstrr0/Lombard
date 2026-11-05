import { describe, expect, it } from 'vitest'
import { cuesFor } from '../src/audio/cues'
import { parseSoundSettings } from '../src/audio/settings'
import { DEFAULT_SOUND_SETTINGS, TOOL_SOUND } from '../src/data/audio'
import { reducer, type Action } from '../src/game/actions'
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

  it('maps every tool to a sound', () => {
    for (const sound of Object.values(TOOL_SOUND)) expect(sound).toMatch(/^tool_/)
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
