/**
 * The fence (M5, GDD § 8): Venya Mostovoy (src/data/fence.ts). Pure.
 *
 * "Sells you suspicious goods cheap and buys your problem items. Great margins, feeds
 * Heat, and the fence remembers every time you said no."
 *
 * - Meeting: the story beat fence.meet (src/data/stories/fence.ts) sets crime.fence.met
 *   and the first contact through the story effect { do: 'fence' } (applyFenceChange).
 * - Contacts: once met, every tuning.fence.every days (stretched by refusals, shortened
 *   by trust) he either rings to buy one of your problem pieces (a stolen piece in stock,
 *   or a fake in your window; a phone buyer with a take-it-or-leave-it offer, like
 *   Gennady's first refusal) or drops in with something cheap to sell (a seller visit;
 *   his price is fixed and he barely haggles). planFence is called from openDay. Both
 *   come on top of the day's walk-ins, so the walk-in queue never changes.
 * - Every draw comes from fenceRng (the career seed, the day and a label, the same
 *   fork as story/plan.ts storyRng) and ids are `<prefix>s<day>_fence` from the
 *   caller, so a contact never touches the game Rng or the shared id counter.
 * - After a contact (afterFenceVisit): a deal grows fenceTrust, adds heat (addHeat),
 *   dirties the clean axis (nudgeAxis) and moves mob standing a little; a no is
 *   counted in crime.fence.refusals, which raises his prices, lowers his offers,
 *   thins out his calls and sours his lines.
 * - Bulletin hook (police): every piece he sells you is recorded in crime.events as
 *   { day, kind: 'fence.sold', data: { itemId, defId } } (a record, not a schedule).
 *   He never rings to buy back a piece he sold you.
 */
import { FENCE, FENCE_LINES, timesWord, type FenceTier } from '../../data/fence'
import { getItemDef } from '../../data/items'
import { tuning } from '../../data/tuning'
import { claimedValue, tidyPrice } from '../appraise/value'
import { nudgeAxis } from '../endings/axes'
import { adjustRep } from '../reputation'
import { Rng } from '../rng'
import { shortName } from '../sell/buyer'
import { displayed } from '../shop/display'
import type { FenceState, GameState } from '../state'
import { scriptedItem, type ItemSpec } from '../story/scripted'
import type { HaggleState, ItemInstance, QueuedVisit, WalkIn } from '../types'
import { addHeat } from './dials'

const F = tuning.fence

export const FENCE_ID = FENCE.id
/** crime.events kind for a piece he sold you (the police's bulletin may pick it up). */
export const FENCE_SOLD_EVENT = 'fence.sold'

const rub = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₽`
const round3 = (x: number) => Math.round(x * 1000) / 1000
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

function fill(text: string, vars: Record<string, string>): string {
  const out = text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m).replace(/\s+/g, ' ').trim()
  return out.charAt(0).toUpperCase() + out.slice(1)
}

/** The fence's draws: the career seed, the day and a label (as storyRng), never the game Rng. */
function fenceRng(state: GameState, label: string): Rng {
  return new Rng(state.meta.seed).fork(`story:${state.calendar.day}:fence:${label}`)
}

/** Venya as the person at the counter or on the phone. */
export function fenceCustomer(): WalkIn {
  return { id: FENCE_ID, name: FENCE.name, archetype: FENCE.role, temperament: 'stubborn', knowledge: 1, desperation: 0, portraitKey: FENCE.look }
}

export function isFence(c: Pick<WalkIn, 'id'>): boolean {
  return c.id === FENCE_ID
}

function withFence(state: GameState, fence: FenceState, trust = state.crime.fenceTrust): GameState {
  return { ...state, crime: { ...state.crime, fence, fenceTrust: round3(clamp(trust, -1, 1)) } }
}

/** Which of his voices: first contact, warm, plain, or sore (refusals at soreAt and outnumbering deals). */
export function fenceTier(state: GameState): FenceTier {
  const f = state.crime.fence
  if (f.refusals >= F.soreAt && f.refusals > f.deals) return 'sore'
  if (state.crime.fenceTrust >= F.warmAt) return 'warm'
  return f.deals === 0 && f.refusals === 0 ? 'first' : 'again'
}

function share(cfg: { base: number; perRefusal: number; perTrust: number; min: number; max: number }, state: GameState): number {
  return clamp(cfg.base + cfg.perRefusal * state.crime.fence.refusals + cfg.perTrust * state.crime.fenceTrust, cfg.min, cfg.max)
}

/** His price for a piece he brings: a share of what it would fetch if genuine (he prices the story, not the truth). */
export function fenceAsk(state: GameState, item: ItemInstance): number {
  return tidyPrice(claimedValue(getItemDef(item.defId), item) * share(F.ask, state))
}

/** What he offers for one of your problem pieces: a share of its real worth. */
export function fenceOffer(state: GameState, item: ItemInstance): number {
  return tidyPrice(item.trueValue * share(F.offer, state))
}

/** Days until his next contact, from today. */
function gap(state: GameState, label: string): number {
  const [a, b] = F.every
  const f = state.crime.fence
  const stretch = Math.min(F.maxStretch, 1 + F.refusalStretch * f.refusals)
  const shorten = 1 - F.trustShorten * Math.max(0, state.crime.fenceTrust)
  return Math.max(1, Math.round(fenceRng(state, label).int(a, b) * stretch * shorten))
}

/** Ids of pieces he sold you (crime.events). */
export function soldByFence(state: GameState): Set<string> {
  const ids = new Set<string>()
  for (const e of state.crime.events) if (e.kind === FENCE_SOLD_EVENT && typeof e.data?.itemId === 'string') ids.add(e.data.itemId)
  return ids
}

export interface ProblemPiece {
  item: ItemInstance
  kind: 'stolen' | 'fake'
}

/**
 * A piece you'd rather not have: the dearest stolen piece in stock (word gets around), else the
 * dearest fake or mixed-up piece in your window (he walks past). Never one he sold you.
 */
export function problemPiece(state: GameState): ProblemPiece | null {
  const his = soldByFence(state)
  const dearest = (xs: ItemInstance[]) => xs.filter((i) => !his.has(i.id)).sort((a, b) => b.trueValue - a.trueValue || a.id.localeCompare(b.id))[0]
  const stolen = dearest(state.inventory.filter((i) => i.provenance === 'stolen'))
  if (stolen) return { item: stolen, kind: 'stolen' }
  const fake = dearest(displayed(state).map((d) => d.item).filter((i) => i.authenticity === 'fake' || i.authenticity === 'frankenstein'))
  return fake ? { item: fake, kind: 'fake' } : null
}

function greeting(state: GameState, rng: Rng): string {
  return fill(rng.pick(FENCE_LINES.greet[fenceTier(state)]), { times: timesWord(state.crime.fence.refusals) })
}

type Ids = (prefix: string, who: string) => string

/** He drops in with something cheap to sell. Exported for the dev scenario. */
export function fenceGoods(state: GameState, nextId: Ids): QueuedVisit {
  const rng = fenceRng(state, 'goods')
  const entry = rng.weighted(F.goods.map((g) => ({ item: g, weight: g.weight })))
  const def = getItemDef(entry.defId)
  const f = state.crime.fence
  const bad = def.fakeProfiles.filter((p) => p.kind === 'fake' || p.kind === 'frankenstein')
  const fake = bad.length > 0 && rng.chance(Math.min(F.fakeChance.max, F.fakeChance.base + F.fakeChance.perRefusal * f.refusals))
  const profile = fake ? rng.pick(bad) : undefined
  const spec: ItemSpec = {
    authenticity: profile ? profile.kind : 'genuine',
    ...(profile ? { fakeProfileId: profile.id } : {}),
    provenance: rng.chance(F.stolenChance) ? 'stolen' : 'unknown',
    condition: F.condition,
    story: rng.pick(FENCE_LINES.story),
  }
  const item = scriptedItem(def, spec, rng, nextId('i', FENCE_ID))
  const vars = { greet: greeting(state, rng), item: shortName(def.name), price: rub(fenceAsk(state, item)) }
  let line = fill(rng.pick(FENCE_LINES.pitch), vars)
  if (fenceTier(state) === 'sore') line = `${line} ${rng.pick(FENCE_LINES.pitchSore)}`
  return { visitId: nextId('v', FENCE_ID), kind: 'seller', wants: 'sell', customer: fenceCustomer(), item, patience: tuning.story.patience, line }
}

/** He rings to take a problem piece off your hands, take it or leave it. */
export function fenceBuyCall(state: GameState, piece: ProblemPiece, nextId: Ids): QueuedVisit {
  const rng = fenceRng(state, 'buy')
  const offer = fenceOffer(state, piece.item)
  const pool = piece.kind === 'stolen' ? FENCE_LINES.buyStolen : FENCE_LINES.buyFake
  const line = fill(rng.pick(pool), { greet: greeting(state, rng), item: shortName(getItemDef(piece.item.defId).name), price: rub(offer) })
  return {
    visitId: nextId('v', FENCE_ID),
    kind: 'buyer',
    via: 'phone',
    customer: fenceCustomer(),
    item: { ...piece.item, revealed: [...piece.item.revealed] },
    patience: tuning.story.patience,
    line,
    offer,
  }
}

export interface FencePlan {
  /** Today's contact, if any (comes on top of the walk-ins). */
  visit: QueuedVisit | null
  fence: FenceState
}

/**
 * This morning's contact. Nothing before you've met him, while the career is over, or when a
 * fence beat already has him in today (`busy`; he comes the next morning instead).
 */
export function planFence(state: GameState, nextId: Ids, busy: boolean): FencePlan {
  const f = state.crime.fence
  const day = state.calendar.day
  if (!f.met || state.career.end) return { visit: null, fence: f }
  if (f.nextDay <= 0) return { visit: null, fence: { ...f, nextDay: day + gap(state, 'next') } }
  if (busy || day < f.nextDay) return { visit: null, fence: f }
  const piece = problemPiece(state)
  const visit = piece && fenceRng(state, 'contact').chance(F.buyCallChance) ? fenceBuyCall(state, piece, nextId) : fenceGoods(state, nextId)
  return { visit, fence: { ...f, nextDay: day + gap(state, 'next') } }
}

/** His haggle: his price is the ask, his floor barely under it, few rounds. No draws. */
export function fenceHaggle(state: GameState, item: ItemInstance): HaggleState {
  const ask = fenceAsk(state, item)
  return { ask, floor: Math.min(ask, Math.round(ask * F.floorShare)), round: 0, maxRounds: F.rounds, irritation: 0, status: 'open', history: [] }
}

/** A no on record: he counts it and trusts you a little less. */
export function noteFenceRefusal(state: GameState): GameState {
  const f = state.crime.fence
  return withFence(state, { ...f, refusals: f.refusals + 1 }, state.crime.fenceTrust + F.trust.refusal)
}

function noteFenceDeal(state: GameState, kind: 'bought' | 'sold', item: ItemInstance | undefined): GameState {
  const f = state.crime.fence
  let s = withFence(state, { ...f, deals: f.deals + 1 }, state.crime.fenceTrust + F.trust.deal)
  s = addHeat(s, F.heat[kind], `fence:${kind}`)
  s = nudgeAxis(s, 'clean', tuning.axes.fenceDeal, 'fence')
  s = adjustRep(s, 'mob', F.mobRep.deal, 'fence')
  if (kind === 'bought' && item) {
    const event = { day: s.calendar.day, kind: FENCE_SOLD_EVENT, data: { itemId: item.id, defId: item.defId } }
    s = { ...s, crime: { ...s.crime, events: [...s.crime.events, event] } }
  }
  return s
}

/**
 * The visit at the counter just resolved: if it was one of his contacts (not a story beat), a deal
 * or a no is remembered and he gets the last word. Called from story/visit.ts afterVisit.
 */
export function afterFenceVisit(state: GameState): GameState {
  const c = state.current
  if (!c || !isFence(c.customer) || c.beatId || c.phase !== 'resolved') return state
  const rng = fenceRng(state, `after:${c.visitId}`)
  let s: GameState
  let line: string
  if (c.outcome === 'bought' || c.outcome === 'sold') {
    s = noteFenceDeal(state, c.outcome, c.item)
    line = rng.pick(c.outcome === 'bought' ? FENCE_LINES.afterBought : FENCE_LINES.afterSold)
  } else if (c.outcome === 'passed' || c.outcome === 'walked') {
    s = noteFenceRefusal(state)
    const pool = fenceTier(s) === 'sore' ? FENCE_LINES.afterRefusedSore : FENCE_LINES.afterRefused
    line = fill(rng.pick(pool), { times: timesWord(s.crime.fence.refusals) })
  } else {
    return state
  }
  return { ...s, current: { ...s.current!, line } }
}

/** A named change from the fence arc (tuning.fence.changes): met, trust, a refusal, the next contact. */
export function applyFenceChange(state: GameState, name: string): GameState {
  const ch = F.changes[name]
  if (!ch) return state
  const day = state.calendar.day
  let s = state
  if (ch.refusal) s = noteFenceRefusal(s)
  const f = { ...s.crime.fence }
  if (ch.met) f.met = true
  s = withFence(s, f, s.crime.fenceTrust + (ch.trust ?? 0))
  if (ch.nextIn) f.nextDay = day + fenceRng(s, `change:${name}`).int(ch.nextIn[0], ch.nextIn[1])
  else if (ch.met && f.nextDay <= day) f.nextDay = day + gap(s, 'meet')
  return withFence(s, f)
}
