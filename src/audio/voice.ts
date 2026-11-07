/**
 * Which voice line a state change says (voice pilot, src/data/voice.ts). Pure, like
 * cues.ts: reads the previous and next state, never touches audio or the DOM, so it
 * is unit-tested in tests/voice.test.ts.
 *
 *   a customer steps up          → a story character's line for this beat, or a walk-in's hello
 *   a haggle or sale answer      → a walk-in's bark for that answer and temperament
 *   what they say changes        → a story character's line that matches it
 *
 * The take is picked from the visit id (hashString), not Math.random, so a replayed
 * moment says the same thing.
 */
import { VOICED, VOICE_MIX, VOICE_RULES, WALKIN_BARKS, WALKIN_GREETING, voiceFile, type VoiceRule } from '../data/voice'
import type { Action } from '../game/actions'
import { isPoliceVisit, policeRole } from '../game/crime/volkova'
import { genderOf } from '../game/customers/look'
import { hashString } from '../game/rng'
import type { GameState } from '../game/state'
import type { VisitState } from '../game/types'

export interface VoiceCue {
  /** File name under VOICE_DIR. */
  file: string
  /** Seconds from now. */
  delay: number
}

/** The voiced character at the counter, or 'walkin_m' / 'walkin_f', or null (stays silent). */
export function speakerOf(c: VisitState): string | null {
  const who = c.customer.regularId ?? c.customer.id
  if (VOICED[who]) return VOICED[who]!
  if (c.customer.regularId || c.customer.specialistId) return null
  return genderOf(c.customer.name) === 'f' ? 'walkin_f' : 'walkin_m'
}

function ruleMatches(r: VoiceRule, c: VisitState, opts: { arrived: boolean; haggleKey?: string }): boolean {
  if (r.haggle !== undefined) return opts.haggleKey?.includes(r.haggle) ?? false
  if (opts.haggleKey) return false
  if (r.line !== undefined) return c.line.startsWith(r.line)
  if (!opts.arrived) return false
  if (r.beat !== undefined) return c.beatId === r.beat
  if (r.police !== undefined) return isPoliceVisit(c) && policeRole(c.visitId) === r.police
  if (r.plain !== undefined) return !c.beatId && c.kind === r.plain
  if (r.item !== undefined) return c.item?.defId === r.item
  return false
}

const pick = <T>(list: readonly T[], seed: string): T => list[hashString(seed) % list.length]!

export function voiceFor(prev: GameState, next: GameState, action: Action | { type: 'store/replace' }): VoiceCue | null {
  if (action.type === 'store/replace' || action.type === 'career/new') return null
  const c = next.current
  if (!c) return null
  const p = prev.current?.visitId === c.visitId ? prev.current : null
  const who = speakerOf(c)
  if (!who) return null
  const walkIn = who.startsWith('walkin')

  // A haggle (seller) or sale (buyer) answer just came back.
  const before = p ? (prev.haggle?.history.length ?? 0) + (p.sale?.history.length ?? 0) : 0
  const after = (next.haggle?.history.length ?? 0) + (c.sale?.history.length ?? 0)
  if (p && after > before) {
    const last = c.sale ? c.sale.history[c.sale.history.length - 1]?.response : next.haggle?.history[next.haggle.history.length - 1]?.response
    if (!last) return null
    if (walkIn) {
      const n = pick(WALKIN_BARKS[c.customer.temperament][last.kind], `${c.visitId}:${after}`)
      return { file: voiceFile(who, n), delay: VOICE_MIX.afterAnswer }
    }
    const rule = VOICE_RULES.find((r) => r.who === who && ruleMatches(r, c, { arrived: false, haggleKey: last.lineKey }))
    return rule ? { file: voiceFile(who, rule.n), delay: VOICE_MIX.afterAnswer } : null
  }

  const arrived = !p
  const lineChanged = !!p && c.line !== p.line
  if (!arrived && !lineChanged) return null
  const delay = arrived ? (c.via === 'phone' ? VOICE_MIX.onPhone : VOICE_MIX.afterBell) : VOICE_MIX.afterAnswer

  if (walkIn) {
    if (!arrived) return null
    if (hashString(`greet:${c.visitId}`) % 1000 >= VOICE_MIX.greetChance * 1000) return null
    return { file: voiceFile(who, pick(WALKIN_GREETING, c.visitId)), delay }
  }
  const rule = VOICE_RULES.find((r) => r.who === who && ruleMatches(r, c, { arrived }))
  return rule ? { file: voiceFile(who, rule.n), delay } : null
}
