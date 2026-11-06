import { reducer } from '../src/game/actions'
import { createInitialState, type GameState } from '../src/game/state'

/** A new career with the career-start intro finished (default shop name, leftover stock). */
export function startedState(seed: number, careerId: string): GameState {
  return reducer(createInitialState(seed, careerId), { type: 'career/begin', shopName: '' })
}

/** Play a story scene at the counter through (first choice, then "Go on") so the visit moves on. */
export function playScene(s: GameState): GameState {
  for (let guard = 0; guard < 20 && s.current?.phase === 'scene'; guard++) {
    const scene = s.current.scene
    const last = scene ? scene.step >= scene.lines.length - 1 : true
    const choice = scene?.choices[0]
    s = last && choice && !scene.chosen ? reducer(s, { type: 'scene/choose', choiceId: choice.id }) : reducer(s, { type: 'scene/next' })
  }
  return s
}
