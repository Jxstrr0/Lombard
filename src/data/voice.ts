/**
 * Voice pilot (docs/04-ASSETS.md § Voice): which recorded line plays when.
 * Not gameplay numbers, so they live here rather than in tuning.ts.
 *
 * The recordings are short spoken "barks" that go with the written dialogue.
 * They don't read the bubble word for word. Files are in
 * public/assets/audio/voice/ (built by art/audio/voice.py from the script
 * sheet art/audio/voice-lines.csv) and are fetched one at a time the first time
 * they're needed, so they never add to the first load.
 *
 * Walk-ins share two voices, one per gender (from their first name, the same
 * way their look is picked). Five story characters have their own voices; the
 * other regulars and the specialists stay silent so a named character never
 * gets a stranger's voice.
 */
import type { Temperament } from '../game/types'

/** Folder under the site base. */
export const VOICE_DIR = 'assets/audio/voice/'

/** A clip's file name (no folder). */
export const voiceFile = (character: string, n: number): string => {
  const code = character.startsWith('walkin') ? 'walkin' : (VOICE_CODE[character] ?? character)
  const lineId = `lom-${code}-${String(n).padStart(4, '0')}`
  return `lom_${character}_${lineId}.mp3`
}

/** Line-id codes in the script sheet (six letters at most). */
const VOICE_CODE: Record<string, string> = {
  eduard: 'eduard',
  volkova: 'volkov',
  venya: 'venya',
  edik: 'edik',
  zinaida: 'zinaid',
}

/**
 * Walk-in barks, by line number in the script sheet. Each slot has two takes of
 * the same idea (two different lines); one is picked per visit and round.
 */
export const WALKIN_GREETING = [1, 2] as const
export const WALKIN_BARKS: Record<Temperament, Record<'accept' | 'counter' | 'walk', readonly [number, number]>> = {
  stubborn: { accept: [3, 4], counter: [5, 6], walk: [7, 8] },
  flexible: { accept: [9, 10], counter: [11, 12], walk: [13, 14] },
  desperate: { accept: [15, 16], counter: [17, 18], walk: [19, 20] },
  proud: { accept: [21, 22], counter: [23, 24], walk: [25, 26] },
}

/** Who is speaking, by customer id or regularId (the fence's customer id is `fence`). */
export const VOICED: Record<string, string> = {
  eduard: 'eduard',
  volkova: 'volkova',
  fence: 'venya',
  edik: 'edik',
  zinaida: 'zinaida',
}

/**
 * When a story character's line plays. Checked in order; the first match wins.
 *   beat:   the visit plays this story beat (src/data/stories)
 *   police: one of Volkova's police visits, by role (src/game/crime/volkova.ts policeRole)
 *   plain:  a visit of this kind that plays no story beat
 *   item:   the item they brought (its defId)
 *   line:   what they're saying right now starts with this text
 *   haggle: a haggle response whose line key contains this text
 */
export interface VoiceRule {
  who: string
  n: number
  beat?: string
  police?: 'intro' | 'visit'
  plain?: 'seller' | 'buyer' | 'scene'
  item?: string
  line?: string
  haggle?: string
}

export const VOICE_RULES: readonly VoiceRule[] = [
  // Eduard Lvovich (src/data/stories/protection.ts)
  { who: 'eduard', n: 1, beat: 'protection.offer' },
  { who: 'eduard', n: 2, beat: 'protection.properly' },
  { who: 'eduard', n: 3, beat: 'protection.ultimatum' },
  // Detective Volkova (src/data/police.ts): her introduction, a stolen piece, a refused envelope.
  { who: 'volkova', n: 3, line: 'Put that away' },
  { who: 'volkova', n: 1, police: 'intro' },
  { who: 'volkova', n: 2, police: 'visit' },
  // Venya Mostovoy, the fence (src/data/stories/fence.ts, src/data/fence.ts)
  { who: 'venya', n: 1, beat: 'fence.meet' },
  { who: 'venya', n: 3, beat: 'fence.notebook' },
  { who: 'venya', n: 2, plain: 'seller' },
  // Edik and the Dubai watches (src/data/stories/rolex.ts)
  { who: 'edik', n: 1, beat: 'rolex.dubai' },
  { who: 'edik', n: 3, beat: 'rolex.real' },
  { who: 'edik', n: 2, haggle: 'evidence' },
  // Zinaida Petrovna (src/data/regulars/zinaida.ts, src/data/stories/medals.ts)
  { who: 'zinaida', n: 1, beat: 'medals.roof' },
  { who: 'zinaida', n: 1, line: 'Good day. You’re the new one?' },
  { who: 'zinaida', n: 2, item: 'gold_earrings_583' },
  { who: 'zinaida', n: 3, item: 'gold_signet_583' },
]

export const VOICE_MIX = {
  /** Gain of a voice line on top of the effects bus. */
  gain: 0.9,
  /** Seconds after the door bell before they speak. */
  afterBell: 0.7,
  /** On the phone (no bell). */
  onPhone: 0.3,
  /** Seconds after a haggle answer appears. */
  afterAnswer: 0.15,
  /** Share of walk-ins who say hello out loud (so the two greetings don't wear thin). */
  greetChance: 0.5,
  /** A line still loading this long after it was asked for is dropped, not played late. */
  maxLate: 1.5,
}
