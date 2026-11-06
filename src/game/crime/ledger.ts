/**
 * The passport book (M5, GDD § 8 "fail to keep a ledger"). Pure.
 *
 * Asking a seller for their passport is an optional step in inspect (the
 * `passport` tool, tuning.inspect.toolSeconds.passport): it costs a little time
 * and writes the seller into your book. How they take being asked is a tell
 * about where the piece came from: most people hand it over, someone selling a
 * stolen piece often can't find it or won't. The game never says "stolen".
 *
 * A noted passport is stored on the item itself as the reserved tell id
 * `@passport` in `item.revealed` (kept after purchase, like every finding), so
 * the book needs no new save field. It matters later: heat from a stolen piece
 * bought without one is × tuning.police.heat.noLedgerFactor, cooperating with
 * Volkova goes further with a name to give her, and she reads the book.
 */
import { passportLines } from '../../data/police'
import { tuning } from '../../data/tuning'
import type { Rng } from '../rng'
import type { Finding, ItemInstance, WalkIn } from '../types'

export const PASSPORT_TELL = '@passport'
export const NO_PASSPORT_TELL = '@passport-none'

/** Was the seller's passport written into the book for this piece? */
export function passportNoted(item: Pick<ItemInstance, 'revealed'>): boolean {
  return item.revealed.includes(PASSPORT_TELL)
}

/** Did you ask on this visit already (either answer)? */
export function passportAsked(findings: readonly Finding[]): boolean {
  return findings.some((f) => f.tellId === PASSPORT_TELL || f.tellId === NO_PASSPORT_TELL)
}

export function isFlagged(customer: Pick<WalkIn, 'regularId'>): boolean {
  return !!customer.regularId && tuning.police.flagged.includes(customer.regularId)
}

export type PassportReaction = 'calm' | 'nervous' | 'refuse'

/** How this seller takes being asked (the reducer draws from a stream keyed by the piece, never the game Rng). */
export function passportReaction(item: ItemInstance, rng: Rng): PassportReaction {
  const r = tuning.police.passport.react[item.provenance] ?? tuning.police.passport.react.clean!
  return rng.weighted<PassportReaction>([
    { item: 'calm', weight: r.calm },
    { item: 'nervous', weight: r.nervous },
    { item: 'refuse', weight: r.refuse },
  ])
}

/** The finding for asking (inspect tool 'passport'). One answer per visit. */
export function passportCheck(input: { item: ItemInstance; customer: WalkIn; previous: readonly Finding[]; rng: Rng }): { findings: Finding[]; seconds: number } {
  const { item, customer, previous, rng } = input
  const seconds = tuning.inspect.toolSeconds.passport
  const taken = new Set(previous.map((f) => f.id))
  let n = previous.length
  let id: string
  do id = `f${++n}`
  while (taken.has(id))
  if (passportAsked(previous)) return { findings: [{ id, tool: 'passport', text: passportLines.again, polarity: 'neutral' }], seconds: 0 }
  const reaction = passportReaction(item, rng)
  const street = rng.pick(passportLines.streets)
  let text = rng.pick(passportLines[reaction]).replaceAll('{street}', street)
  const flaggedNote = customer.regularId ? passportLines.flagged[customer.regularId] : undefined
  if (reaction !== 'refuse' && flaggedNote && isFlagged(customer)) text = `${text} ${flaggedNote}`
  const shady = reaction !== 'calm' || (flaggedNote !== undefined && isFlagged(customer))
  return {
    findings: [
      {
        id,
        tool: 'passport',
        text,
        tellId: reaction === 'refuse' ? NO_PASSPORT_TELL : PASSPORT_TELL,
        reveals: 'provenance',
        polarity: shady ? 'negative' : 'neutral',
      },
    ],
    seconds,
  }
}
