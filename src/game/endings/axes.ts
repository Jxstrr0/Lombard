/**
 * The career's hidden ending axes (M5, GDD § 12). Pure.
 *
 * Clean ↔ dirty and heart ↔ hustle accumulate here over the whole career; wealth
 * and standing are read at the end from cash, stock and reputation. Every system
 * that judges the player (deals, stolen goods, bribes, the fence, protection, story
 * choices) moves an axis through nudgeAxis, with its weights in `tuning.axes`. The
 * unit is "one story choice": a heart.* or dirty.* flag is worth 1.
 */
import { tuning } from '../../data/tuning'
import { dealVerdict, isVulnerable } from '../reputation'
import type { CareerAxes, GameState } from '../state'
import type { ItemInstance, WalkIn } from '../types'

export type Axis = keyof CareerAxes

export function axisOf(state: GameState, axis: Axis): number {
  return state.career.axes[axis]
}

/** Move one axis. `_reason` documents the call site (like adjustRep's). */
export function nudgeAxis(state: GameState, axis: Axis, delta: number, _reason?: string): GameState {
  if (delta === 0 || state.career.end) return state
  const axes = { ...state.career.axes, [axis]: Math.round((state.career.axes[axis] + delta) * 1000) / 1000 }
  return { ...state, career: { ...state.career, axes } }
}

/** The axis move a story flag carries: heart.* → heart, dirty.* → the clean axis (negative). */
export function flagAxis(flag: string): { axis: Axis; delta: number } | null {
  if (flag.startsWith('heart.')) return { axis: 'heart', delta: tuning.axes.storyHeart }
  if (flag.startsWith('dirty.')) return { axis: 'clean', delta: tuning.axes.storyDirty }
  return null
}

/**
 * After you buy (or lend on) a seller's item: a fair deal for someone vulnerable counts
 * toward heart and the people you helped, a lowball against heart and toward the people
 * you hurt (the neighbourhood's test, src/game/reputation.ts); a stolen piece dirties the
 * shop whether or not you knew.
 */
export function axesAfterDeal(state: GameState, customer: WalkIn, item: ItemInstance, price: number, kind: 'buy' | 'pawn'): GameState {
  let s = state
  if (item.provenance === 'stolen') s = nudgeAxis(s, 'clean', tuning.axes.stolenBought, 'stolen')
  const verdict = isVulnerable(customer) ? dealVerdict(item, price, kind) : null
  if (!verdict) return s
  s = nudgeAxis(s, 'heart', verdict === 'fair' ? tuning.axes.fairDeal : tuning.axes.lowball, verdict)
  const stats = verdict === 'fair' ? { peopleHelped: s.stats.peopleHelped + 1 } : { peopleHurt: s.stats.peopleHurt + 1 }
  return { ...s, stats: { ...s.stats, ...stats } }
}
