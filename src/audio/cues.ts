/**
 * Which sounds a state change makes. Pure: reads the previous and next state and
 * the action (like render/stage.ts reacting to the store), never touches audio
 * or the DOM, so it is unit-tested in tests/audioCues.test.ts.
 *
 *   a new customer steps up            → door bell, then their item set on the mat
 *   a phone visit comes in             → the phone rings
 *   a walk-in's visit ends             → the door shuts behind them (once they reach it)
 *   an inspect tool is used            → that tool's sound
 *   inspecting a watch / a camera      → winding / a shutter, once per inspect
 *   money changes hands at the counter → cash drawer and coins (bought, pawned, sold, redeemed);
 *                                        a pawn stamps its ticket first
 *   an item goes into a display slot   → set down
 *   the dealer pays, an upgrade is paid → coins
 *   the day opens / closes             → the shutter goes up (then the paper) / down
 *
 * bedsFor says which ambience beds (rain, flood water) should be playing, and
 * prefetchFor which lazily loaded sounds the coming moments may need.
 */
import { getItemDef } from '../data/items'
import { AUDIO_MIX, BEDS, FLOOD_BED, INSPECT_SOUND, RAIN_BED, TOOL_SOUND, type BedId, type LazySoundId, type SoundId } from '../data/audio'
import type { Action } from '../game/actions'
import { floodView } from '../game/city/flood'
import type { GameState } from '../game/state'
import type { VisitOutcome } from '../game/types'

export interface Cue {
  sound: SoundId
  /** Seconds from now. */
  delay?: number
  /** Extra gain multiplier (default 1). */
  gain?: number
  /** Wait until the leaving customer has walked out of the street door (main.ts asks the scene). */
  atDoor?: boolean
  /** A lazily loaded sound may start whenever it arrives (ambient colour, not tied to a moment). */
  lateOk?: boolean
}

const PAID: ReadonlySet<VisitOutcome> = new Set(['bought', 'pawned', 'sold', 'redeemed'])
const SPENDING: ReadonlySet<string> = new Set(['ledger/sell', 'upgrade/buy', 'acid/restock', 'specialist/retain'])

export function cuesFor(prev: GameState, next: GameState, action: Action | { type: 'store/replace' }): Cue[] {
  // Loading a save or a new career swaps the world; nothing happened in the shop.
  if (action.type === 'store/replace' || action.type === 'career/new') return []
  const cues: Cue[] = []
  const c = next.current
  const p = prev.current

  // The day: the shutter goes up in the morning (and the paper is unfolded), down at night.
  if (prev.day.phase === 'closed' && next.day.phase === 'open') {
    cues.push({ sound: 'shutter_up' })
    if (!next.day.newsRead) cues.push({ sound: 'newspaper', delay: AUDIO_MIX.newspaperDelay })
  } else if (prev.day.phase === 'open' && next.day.phase === 'closed') {
    cues.push({ sound: 'shutter_down' })
  }

  // A walk-in leaves (served, passed or walked out): the door shuts once they reach it.
  if (p && !p.via && c?.visitId !== p.visitId) cues.push({ sound: 'door_close', atDoor: true })

  // A phone call (M4 specialists, phone story beats) rings the phone; nobody walks in.
  if (c && c.visitId !== p?.visitId) {
    if (c.via) cues.push({ sound: 'phone_ring' })
    else {
      cues.push({ sound: 'door_bell' })
      if (c.item && (c.phase === 'present' || c.phase === 'scene')) cues.push({ sound: 'set_down', delay: AUDIO_MIX.setDownDelay })
    }
  }

  // Picking a watch or a camera up to inspect it (once: coming back from the offer doesn't repeat it).
  if (c && c.visitId === p?.visitId && c.phase === 'inspect' && p.phase === 'present' && c.item) {
    const sound = INSPECT_SOUND[getItemDef(c.item.defId).category]
    if (sound) cues.push({ sound, delay: AUDIO_MIX.inspectSoundDelay })
  }

  if (action.type === 'inspect/useTool') {
    const before = prev.inspect?.toolUses[action.tool] ?? 0
    const after = next.inspect?.toolUses[action.tool] ?? 0
    if (after > before) cues.push({ sound: TOOL_SOUND[action.tool] })
  }

  if (c && c.visitId === p?.visitId && c.outcome && c.outcome !== p.outcome && PAID.has(c.outcome)) {
    // A pawn: the ticket is stamped and torn off, then the drawer runs out.
    if (c.outcome === 'pawned') cues.push({ sound: 'stamp' }, { sound: 'cash', delay: AUDIO_MIX.pawnCashDelay, gain: AUDIO_MIX.pawnCashGain })
    else cues.push({ sound: 'cash' })
  }

  if (action.type === 'shop/place' && action.slotId !== null && next.shop.slots !== prev.shop.slots) {
    cues.push({ sound: 'set_down', gain: 0.8 })
  }

  if (SPENDING.has(action.type) && next.cash !== prev.cash) cues.push({ sound: 'coins' })

  return cues
}

/** Today's weather as the street shows it (render/street), or null before the street has loaded. */
export interface BedWeather {
  kind: 'clear' | 'rain' | 'snow'
  intensity: number
}

/**
 * How loud each bed should be (0 = off, 1 = its full level): rain while the
 * street shows rain, canal water while the Flood's water stands in the shop.
 */
export function bedsFor(state: GameState, weather: BedWeather | null): Record<BedId, number> {
  const rain = weather?.kind === 'rain' ? RAIN_BED.base + RAIN_BED.range * Math.min(1, Math.max(0, weather.intensity)) : 0
  const flood = FLOOD_BED[floodView(state).phase] ?? 0
  const levels: Record<BedId, number> = { rain, flood }
  for (const id of Object.keys(BEDS) as BedId[]) levels[id] = Math.min(1, Math.max(0, levels[id]))
  return levels
}

/**
 * Lazily loaded sounds this state may soon need, so they are already decoded
 * when their cue fires: the shutter and the paper before the day opens; once
 * someone is at the counter, the door close, the stamp and the phone; the
 * closing shutter once nobody is left to serve; the inspect sound for the item
 * on the mat. The tram fetches itself the first time it passes.
 */
export function prefetchFor(state: GameState): LazySoundId[] {
  if (state.career.end) return []
  if (state.day.phase === 'closed') return ['shutter_up', 'newspaper']
  const out: LazySoundId[] = []
  const c = state.current
  if (c) {
    out.push('door_close', 'stamp', 'phone_ring')
    if (c.item && c.phase === 'present') {
      const sound = INSPECT_SOUND[getItemDef(c.item.defId).category]
      if (sound) out.push(sound)
    }
  } else if (state.queue.length === 0) out.push('shutter_down')
  return out
}
