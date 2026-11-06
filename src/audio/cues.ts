/**
 * Which sounds a state change makes. Pure: reads the previous and next state and
 * the action (like render/stage.ts reacting to the store), never touches audio
 * or the DOM, so it is unit-tested in tests/audioCues.test.ts.
 *
 *   a new customer steps up            → door bell, then their item set on the mat
 *   an inspect tool is used            → that tool's sound
 *   money changes hands at the counter → cash drawer and coins (bought, pawned, sold, redeemed)
 *   an item goes into a display slot   → set down
 *   the dealer pays, an upgrade is paid → coins
 */
import { AUDIO_MIX, TOOL_SOUND, type SoundId } from '../data/audio'
import type { Action } from '../game/actions'
import type { GameState } from '../game/state'
import type { VisitOutcome } from '../game/types'

export interface Cue {
  sound: SoundId
  /** Seconds from now. */
  delay?: number
  /** Extra gain multiplier (default 1). */
  gain?: number
}

const PAID: ReadonlySet<VisitOutcome> = new Set(['bought', 'pawned', 'sold', 'redeemed'])
const SPENDING: ReadonlySet<string> = new Set(['ledger/sell', 'upgrade/buy', 'acid/restock', 'specialist/retain'])

export function cuesFor(prev: GameState, next: GameState, action: Action | { type: 'store/replace' }): Cue[] {
  // Loading a save or a new career swaps the world; nothing happened in the shop.
  if (action.type === 'store/replace' || action.type === 'career/new') return []
  const cues: Cue[] = []
  const c = next.current
  const p = prev.current

  if (c && c.visitId !== p?.visitId) {
    cues.push({ sound: 'door_bell' })
    if (c.item && (c.phase === 'present' || c.phase === 'scene')) cues.push({ sound: 'set_down', delay: AUDIO_MIX.setDownDelay })
  }

  if (action.type === 'inspect/useTool') {
    const before = prev.inspect?.toolUses[action.tool] ?? 0
    const after = next.inspect?.toolUses[action.tool] ?? 0
    if (after > before) cues.push({ sound: TOOL_SOUND[action.tool] })
  }

  if (c && c.visitId === p?.visitId && c.outcome && c.outcome !== p.outcome && PAID.has(c.outcome)) {
    cues.push({ sound: 'cash' })
  }

  if (action.type === 'shop/place' && action.slotId !== null && next.shop.slots !== prev.shop.slots) {
    cues.push({ sound: 'set_down', gain: 0.8 })
  }

  if (SPENDING.has(action.type) && next.cash !== prev.cash) cues.push({ sound: 'coins' })

  return cues
}
