/**
 * Haggle state machine (2–5 rounds).
 * STUB (M1 foundation) — replaced by the haggle worker.
 */
import { tuning } from '../../data/tuning'
import type { Rng } from '../rng'
import type { Approach, Finding, HaggleResponse, HaggleState, ItemInstance, WalkIn } from '../types'

export interface HaggleContext {
  customer: WalkIn
  item: ItemInstance
  /** Findings revealed during inspection (evidence candidates). */
  findings: readonly Finding[]
}

export interface HaggleMove {
  offer: number
  approach: Approach
  /** Required when approach = evidence. */
  evidenceId?: string
}

export function startHaggle(ctx: HaggleContext, rng: Rng): HaggleState {
  const ask = Math.round((ctx.item.trueValue * rng.range(0.7, 1.1)) / 100) * 100
  return { ask, floor: Math.round(ask * 0.6), round: 0, maxRounds: tuning.haggle.maxRounds, irritation: 0, status: 'open', history: [] }
}

export function haggleRound(
  state: HaggleState,
  move: HaggleMove,
  _ctx: HaggleContext,
  _rng: Rng,
): { state: HaggleState; response: HaggleResponse } {
  const response: HaggleResponse =
    move.offer >= state.floor
      ? { kind: 'accept', price: move.offer, mood: 'pleased', lineKey: 'accept.flexible' }
      : { kind: 'counter', price: state.ask, mood: 'neutral', lineKey: 'counter.flexible' }
  const next: HaggleState = {
    ...state,
    round: state.round + 1,
    status: response.kind === 'accept' ? 'accepted' : 'open',
    history: [...state.history, { ...move, response }],
  }
  return { state: next, response }
}
