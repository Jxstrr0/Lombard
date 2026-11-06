/**
 * Helpers for walking a story arc beat by beat in tests: jump to a morning,
 * put a beat's visit first in line, read its scene, pick a choice, then pass
 * or deal on its item.
 */
import { expect } from 'vitest'
import { reducer, type Action } from '../src/game/actions'
import { getBeat } from '../src/data/stories'
import { allHold } from '../src/game/story/conditions'
import { beatVisit } from '../src/game/story/plan'
import { beatRecord } from '../src/game/story/progress'
import type { GameState } from '../src/game/state'

export const run = (s: GameState, ...actions: Action[]): GameState => actions.reduce(reducer, s)

/** The shop closed on the morning of `day`, nobody at the counter (a test shortcut past the days between beats). */
export function atDay(s: GameState, day: number): GameState {
  return { ...s, current: null, inspect: null, haggle: null, queue: [], day: { ...s.day, phase: 'closed' }, calendar: { ...s.calendar, day } }
}

/** Could this beat play this morning (conditions hold, not played yet; its chance aside)? */
export function eligible(s: GameState, beatId: string): boolean {
  const beat = getBeat(beatId)
  if (!beat) throw new Error(`no beat ${beatId}`)
  const arc = beatId.slice(0, beatId.indexOf('.'))
  return !s.story.arcs[arc]?.ended && !beatRecord(s, beatId) && allHold(beat.when, s)
}

/** Open the shop on `day` with this beat's visit first in line, and call it to the counter. */
export function beatAtCounter(s: GameState, beatId: string, day: number): GameState {
  let open = reducer(atDay(s, day), { type: 'day/open' })
  const beat = getBeat(beatId)!
  let n = 0
  const visit = beatVisit(open, beat, (p) => `${p}t${n++}`)
  expect(visit, beatId).not.toBeNull()
  open = { ...open, queue: [visit!, ...open.queue.filter((q) => q.beatId !== beatId)] }
  return reducer(open, { type: 'counter/next' })
}

/** "Go on" through a scene with no choice (or up to its last line, if it has one). */
export function readScene(s: GameState): GameState {
  for (let guard = 0; guard < 20 && s.current?.phase === 'scene'; guard++) {
    const scene = s.current.scene!
    if (scene.step >= scene.lines.length - 1 && scene.choices.length > 0 && !scene.chosen) return s
    s = reducer(s, { type: 'scene/next' })
  }
  return s
}

/** Read to the scene's last line, pick `choiceId`, and go on (to the item, or the end of the visit). */
export function choose(s: GameState, choiceId: string): GameState {
  s = readScene(s)
  const next = reducer(s, { type: 'scene/choose', choiceId })
  expect(next.current?.scene?.chosen, `choice ${choiceId}`).toBe(choiceId)
  return reducer(next, { type: 'scene/next' })
}

/** Pass on the item on the mat. */
export function pass(s: GameState): GameState {
  expect(s.current?.phase).toBe('present')
  return reducer(s, { type: 'counter/pass' })
}

/** Inspect, estimate and offer `amount` (buy or loan, as they want). At or above their ask it's taken at once. */
export function offer(s: GameState, amount: number): GameState {
  expect(s.current?.phase).toBe('present')
  s = run(s, { type: 'counter/inspect' }, { type: 'inspect/done' }, { type: 'offer/estimate', value: s.current!.item!.trueValue })
  return reducer(s, { type: 'offer/make', amount: Math.round(amount), approach: 'straight' })
}
