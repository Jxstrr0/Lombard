/**
 * Heat sources (M5, GDD § 8 "Heat"). Pure. The police worker owns this formula;
 * other systems add heat only through addHeat (dials.ts).
 *
 * What raises heat (numbers in tuning.police.heat):
 * - buying (or lending on) a piece printed on the stolen-goods bulletin: at once,
 *   because the police are already looking for it;
 * - any other stolen piece through your books: when the police trail reaches you,
 *   tuning.police.trailDays later ("buy stolen goods and nothing happens today;
 *   something happens in three weeks");
 * - buying from a seller the police have flagged (tuning.police.flagged);
 * - failing to keep a ledger: each of the above × noLedgerFactor when no passport
 *   was noted on the deal (crime/ledger.ts).
 * Heat fades every night (decayShare of itself, at least decayMin). Volkova's answers and the raid move it too
 * (crime/volkova.ts).
 *
 * A stolen piece leaves a **trail**: a crime event (`police.trail`) on the day the
 * police learn it came through your shop, holding what Volkova will ask about
 * (the piece, the seller, the day, whether a passport was noted or the camera
 * was running, whether it was on the bulletin). Trails reuse `crime.events`
 * (v8); no new save field. Draws fork from the career seed and the piece's id,
 * never the game Rng.
 */
import { tuning } from '../../data/tuning'
import { recordsEvidence } from '../economy/upgrades'
import { Rng } from '../rng'
import type { CrimeEvent, GameState } from '../state'
import type { ItemInstance, WalkIn } from '../types'
import { onBulletin } from './bulletin'
import { addHeat } from './dials'
import { TRAIL, addEvent, dropEvents } from './events'
import { isFlagged, passportNoted } from './ledger'

const H = tuning.police.heat
const round = (v: number) => Math.round(v * 1000) / 1000

/** A trail's data (CrimeEvent.data holds strings and numbers; flags are 0/1). */
export interface Trail {
  /** The piece and its def. */
  item: string
  def: string
  /** Who sold or pawned it to you. */
  seller: string
  /** Career day you took it in. */
  bought: number
  passport: number
  tape: number
  bulletin: number
  /** Heat still to land when the trail reaches you (0 once it has, or for a bulletin piece). */
  heat: number
}

export function trailOf(e: CrimeEvent): Trail | null {
  if (e.kind !== TRAIL || !e.data) return null
  const d = e.data
  return {
    item: String(d.item ?? ''),
    def: String(d.def ?? ''),
    seller: String(d.seller ?? ''),
    bought: Number(d.bought ?? 0),
    passport: Number(d.passport ?? 0),
    tape: Number(d.tape ?? 0),
    bulletin: Number(d.bulletin ?? 0),
    heat: Number(d.heat ?? 0),
  }
}

/** Trails that have reached you (the police know) and Volkova hasn't asked about yet. */
export function openTrails(state: GameState): { event: CrimeEvent; trail: Trail }[] {
  const out: { event: CrimeEvent; trail: Trail }[] = []
  for (const event of state.crime.events) {
    const trail = event.day <= state.calendar.day ? trailOf(event) : null
    if (trail) out.push({ event, trail })
  }
  return out
}

/**
 * After you buy (or lend on) a seller's item: a flagged seller and a stolen piece raise heat
 * (more without a passport in the book), and a stolen piece leaves a trail.
 */
export function heatAfterDeal(state: GameState, customer: WalkIn, item: ItemInstance): GameState {
  const noted = passportNoted(item)
  const f = noted ? 1 : H.noLedgerFactor
  let s = state
  if (isFlagged(customer)) s = addHeat(s, round(H.flaggedBuy * f), 'flagged')
  if (item.provenance !== 'stolen') return s
  const bulletin = onBulletin(s, item.id)
  const [a, b] = bulletin ? tuning.police.trailDays.bulletin : tuning.police.trailDays.other
  const delay = new Rng(s.meta.seed).fork(`police:trail:${item.id}`).int(a, b)
  if (bulletin) s = addHeat(s, round(H.bulletinBuy * f), 'bulletin')
  const day = s.calendar.day
  const data: Trail = {
    item: item.id,
    def: item.defId,
    seller: customer.name,
    bought: day,
    passport: noted ? 1 : 0,
    tape: recordsEvidence(s) ? 1 : 0,
    bulletin: bulletin ? 1 : 0,
    heat: bulletin ? 0 : round(H.stolenTrail * f),
  }
  return addEvent(s, { day: day + delay, kind: TRAIL, data: { ...data } })
}

/** Morning: trails reaching you today land their heat. */
export function matureTrails(state: GameState): GameState {
  let s = state
  let changed = false
  const events = state.crime.events.map((e) => {
    const t = e.day <= state.calendar.day ? trailOf(e) : null
    if (!t || t.heat <= 0) return e
    s = addHeat(s, t.heat, 'trail')
    changed = true
    return { ...e, data: { ...e.data, heat: 0 } }
  })
  return changed ? { ...s, crime: { ...s.crime, events } } : s
}

/** Is Volkova interested in you: enough heat, or a trail that has reached you. */
export function volkovaInterested(state: GameState): boolean {
  return state.crime.heat >= tuning.police.volkova.interestHeat || openTrails(state).length > 0
}

/**
 * Night: heat fades, and old police events go (trails Volkova never asked about after
 * trailKeepDays; one-day events dated today or earlier are spent). Other systems' events are left alone.
 */
export function heatNight(state: GameState): GameState {
  const day = state.calendar.day
  const s = addHeat(state, -Math.min(state.crime.heat, Math.max(H.decayMin, state.crime.heat * H.decayShare)), 'decay')
  return dropEvents(s, (e) => {
    if (!e.kind.startsWith('police.')) return false
    if (e.kind === TRAIL) return e.day + tuning.police.trailKeepDays < day
    return e.day <= day
  })
}
