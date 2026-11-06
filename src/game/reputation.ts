/**
 * Reputation by group (M4; GDD § 6, § 12 "Standing"). The one module that
 * changes `state.reputation.byGroup`; everything else calls in here.
 *
 * Every group sits in tuning.reputation.min…max (−1…1, 0 = no opinion yet).
 * The ledger shows it as vague lines, never numbers (standingLines).
 *
 * ## API
 *   adjustRep(state, group, delta, reason?) → state   clamped; also tallies today's change (day.repDelta)
 *   repOf(state, group) → number                      0 for groups an old save lacks
 *   repToday(state, group) → number                   net change since the shop opened
 *   repBand(value) → 0…4                              cold, cool, neutral, warm, close
 *   standingLines(state) → { group, text }[]          the ledger's "word on the street"
 *
 * ## What moves each group (resolution hooks, called by the reducer)
 * - neighbourhood: a fair buy or loan for a vulnerable seller (desperate, or a pensioner) up;
 *   lowballing one down; any insulting offer, anyone giving up in the queue down; a pawner
 *   redeeming their pledge up. Fair = paid ≥ fairBuyShare / fairLoanShare of the item's real
 *   worth (genuine or restored items only); lowball = under lowballBuyShare / lowballLoanShare.
 * - youth (the local kids and students): the same fair/lowball test for students (bigger steps),
 *   insulting a student, a student walking out of the queue, selling something to a student.
 * - specialists: the mean relationship of every specialist you have ever retained (it grows with
 *   each month paid in full and drops on release), synced after retain/release and at closing.
 * - police, mob: untouched until the M5 crime layer.
 *
 * ## What each group does
 * - neighbourhood: buyer chance (buyerRepFactor) and queue patience (patienceRepFactor).
 * - youth: shoplifting (theftRepFactor; src/game/shop/theft.ts).
 * - specialists, police, mob: nothing yet (standing for endings; M5 reads police and mob).
 * The older `reputation.general` (points, walkouts −1) still feeds buyer chance as before.
 */
import { reputationLines } from '../data/reputationLines'
import { tuning } from '../data/tuning'
import type { GameState, Group } from './state'
import type { ItemInstance, WalkIn } from './types'

const R = tuning.reputation

export const GROUPS: readonly Group[] = ['neighbourhood', 'youth', 'police', 'mob', 'specialists']

/** Why a group moved. Free-form for future systems (story beats, M5 crime); these are the M4 ones. */
export type RepReason = 'fair' | 'lowball' | 'insult' | 'walkout' | 'redeem' | 'sale' | 'specialists' | (string & {})

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const round4 = (x: number) => Math.round(x * 10_000) / 10_000

export function repOf(state: GameState, group: Group): number {
  return state.reputation.byGroup[group] ?? 0
}

export function repToday(state: GameState, group: Group): number {
  return state.day.repDelta?.[group] ?? 0
}

/**
 * Move a group's reputation by `delta`, clamped to tuning.reputation.min…max.
 * `reason` names the cause at the call site (kept for readability and future hooks; not stored).
 */
export function adjustRep(state: GameState, group: Group, delta: number, _reason?: RepReason): GameState {
  if (!Number.isFinite(delta) || delta === 0) return state
  const before = repOf(state, group)
  const after = round4(clamp(before + delta, R.min, R.max))
  if (after === before) return state
  const repDelta = { ...state.day.repDelta, [group]: round4((state.day.repDelta?.[group] ?? 0) + after - before) }
  return {
    ...state,
    reputation: { ...state.reputation, byGroup: { ...state.reputation.byGroup, [group]: after } },
    day: { ...state.day, repDelta },
  }
}

// --- who's who ----------------------------------------------------------------

export function isVulnerable(c: WalkIn): boolean {
  return c.desperation >= R.vulnerableDesperation || R.vulnerableArchetypes.includes(c.archetype)
}

export function isYouth(c: WalkIn): boolean {
  return R.youthArchetypes.includes(c.archetype)
}

// --- resolution hooks ---------------------------------------------------------

/** After you buy (or lend on) a seller's item for `price`. */
/** Was a buy or loan fair, a lowball, or neither, judged on the item's real worth? (Also read by the ending axes.) */
export function dealVerdict(item: ItemInstance, price: number, kind: 'buy' | 'pawn'): 'fair' | 'lowball' | null {
  const share = price / Math.max(1, item.trueValue)
  const fairAt = kind === 'buy' ? R.fairBuyShare : R.fairLoanShare
  const lowAt = kind === 'buy' ? R.lowballBuyShare : R.lowballLoanShare
  // A fake's real worth says nothing about how fairly you treated the seller.
  const judgeable = item.authenticity === 'genuine' || item.authenticity === 'restored'
  return share < lowAt ? 'lowball' : judgeable && share >= fairAt ? 'fair' : null
}

export function repAfterDeal(state: GameState, customer: WalkIn, item: ItemInstance, price: number, kind: 'buy' | 'pawn'): GameState {
  const verdict = dealVerdict(item, price, kind)
  if (!verdict) return state
  let s = state
  if (isVulnerable(customer)) s = adjustRep(s, 'neighbourhood', R.neighbourhood[verdict], verdict)
  if (isYouth(customer)) s = adjustRep(s, 'youth', R.youth[verdict], verdict)
  return s
}

/** After an offer insults a seller (haggle mood 'insulted'). */
export function repAfterInsult(state: GameState, customer: WalkIn): GameState {
  let s = adjustRep(state, 'neighbourhood', R.neighbourhood.insult, 'insult')
  if (isYouth(customer)) s = adjustRep(s, 'youth', R.youth.lowball, 'insult')
  return s
}

/** After someone gives up waiting in the queue. */
export function repAfterWalkout(state: GameState, customer: WalkIn): GameState {
  let s = adjustRep(state, 'neighbourhood', R.neighbourhood.walkout, 'walkout')
  if (isYouth(customer)) s = adjustRep(s, 'youth', R.youth.walkout, 'walkout')
  return s
}

/** After a pawner redeems their pledge. */
export function repAfterRedeem(state: GameState): GameState {
  return adjustRep(state, 'neighbourhood', R.neighbourhood.redeem, 'redeem')
}

/** After a walk-in buyer pays for one of your items. */
export function repAfterSale(state: GameState, customer: WalkIn): GameState {
  return isYouth(customer) ? adjustRep(state, 'youth', R.youth.sale, 'sale') : state
}

/** Specialists' group standing = mean relationship of every specialist ever retained (unchanged if none). */
export function syncSpecialistsRep(state: GameState): GameState {
  const rels = Object.values(state.specialists).map((sp) => sp.relationship)
  if (rels.length === 0) return state
  const mean = rels.reduce((a, r) => a + r, 0) / rels.length
  return adjustRep(state, 'specialists', round4(mean) - repOf(state, 'specialists'), 'specialists')
}

// --- effects ------------------------------------------------------------------

/** Multiplier on a displayed item's daily buyer chance. */
export function buyerRepFactor(state: GameState): number {
  return 1 + repOf(state, 'neighbourhood') * R.effects.buyerPerNeighbourhood
}

/** Multiplier on how long people wait in the queue. */
export function patienceRepFactor(state: GameState): number {
  return 1 + repOf(state, 'neighbourhood') * R.effects.patiencePerNeighbourhood
}

/** Multiplier on the nightly shoplifting chance. */
export function theftRepFactor(state: GameState): number {
  return Math.max(0, 1 - repOf(state, 'youth') * R.effects.theftPerYouth)
}

// --- ledger -------------------------------------------------------------------

/** 0 = cold … 2 = neutral … 4 = close. */
export function repBand(value: number): number {
  let band = 0
  for (const edge of R.bands) if (edge > 0 ? value >= edge : value > edge) band++
  return band
}

export interface StandingLine {
  group: Group
  text: string
}

/**
 * One vague line per group that has anything to say: the neighbourhood and the kids
 * always, specialists once you've retained one, police and mob once they're off zero.
 * A noticeable change today reads as a trend ("warming to you"); otherwise the band.
 */
export function standingLines(state: GameState): StandingLine[] {
  const out: StandingLine[] = []
  for (const group of GROUPS) {
    const value = repOf(state, group)
    const today = repToday(state, group)
    if (group === 'specialists' && Object.keys(state.specialists).length === 0) continue
    if ((group === 'police' || group === 'mob') && value === 0 && today === 0) continue
    const lines = reputationLines[group]
    let text: string
    if (today >= R.trendDelta) text = lines.up
    else if (today <= -R.trendDelta) text = lines.down
    else text = lines.bands[repBand(value)] ?? lines.bands[2]
    out.push({ group, text })
  }
  return out
}
