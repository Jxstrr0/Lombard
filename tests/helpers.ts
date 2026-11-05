import { reducer } from '../src/game/actions'
import { createInitialState, type GameState } from '../src/game/state'

/** A new career with the career-start intro finished (default shop name, leftover stock). */
export function startedState(seed: number, careerId: string): GameState {
  return reducer(createInitialState(seed, careerId), { type: 'career/begin', shopName: '' })
}
