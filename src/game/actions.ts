/**
 * Actions are plain objects (loggable, replayable). The reducer is pure:
 * same state + same action = same result, including RNG draws, because the
 * RNG state lives in GameState.meta.rng.
 */
import {
  placeholderCustomers,
  placeholderInspectLine,
  placeholderPassLine,
} from '../data/placeholder'
import { Rng } from './rng'
import type { GameState, Settings } from './state'

export type Action =
  | { type: 'counter/next' }
  | { type: 'counter/inspect' }
  | { type: 'counter/pass' }
  | { type: 'settings/set'; patch: Partial<Settings> }

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'counter/next': {
      const rng = Rng.from(state.meta.rng)
      const visitor = rng.pick(placeholderCustomers)
      return {
        ...state,
        meta: { ...state.meta, rng: rng.state },
        current: { customerName: visitor.name, line: visitor.line },
        stats: { ...state.stats, customersSeen: state.stats.customersSeen + 1 },
      }
    }
    case 'counter/inspect': {
      if (!state.current) return state
      return { ...state, current: { ...state.current, line: placeholderInspectLine } }
    }
    case 'counter/pass': {
      if (!state.current) return state
      return { ...state, current: null, narration: placeholderPassLine }
    }
    case 'settings/set':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    default: {
      const unknown: never = action
      return unknown
    }
  }
}
