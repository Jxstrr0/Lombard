/**
 * The specialists' small arcs (M4, GDD § 2b): what the story engine knows about
 * specialists. Pure; the reducer and the story planner call these.
 *
 * - monthsRetained: "retained N months" = retainers paid in full since sinceDay,
 *   and at least N × specialistArcs.monthDays days on the books.
 * - Call bookkeeping: noteCall after a call (soundBig, wrong, wrongSound), noteBought
 *   when you buy the piece (wrongBought, lowballed, Gennady's first-refusal call that
 *   evening). Selling a lowballed piece is counted in shop/sold.ts (lowballSold).
 * - Effects: applyChange (tuning.specialistArcs.changes), startBoost / boostSellers
 *   (tuning.specialistArcs.boosts), sellToSpecialist (tuning.specialistArcs.offers),
 *   walkoutOne, and the referred buyer Faina sends once a month.
 * Every draw comes from a stream forked off the game Rng (story:<day>:…), never the
 * game Rng itself, so arcs don't shift what walk-ins bring.
 */
import { getItemDef } from '../../data/items'
import { getSpecialist } from '../../data/specialists'
import { BOOST_STORIES, FIRST_REFUSAL_LINES, REFERRAL_LINES } from '../../data/stories/specialistLines'
import { tuning } from '../../data/tuning'
import { tidyPrice } from '../appraise/value'
import { generateWalkIn } from '../customers/walkins'
import { releaseSpecialist, specialistFor } from '../economy/specialists'
import { SPECIALIST_TELL, specialistCallSeconds } from '../inspect/tools'
import { repAfterWalkout, syncSpecialistsRep } from '../reputation'
import { Rng } from '../rng'
import { shortName } from '../sell/buyer'
import { displayed } from '../shop/display'
import { removeSold } from '../shop/sold'
import type { GameState } from '../state'
import type { ItemInstance, QueuedVisit, SpecialistEvent, SpecialistMods, SpecialistState, SpecialistVerdict, WalkIn } from '../types'
import { scriptedItem } from './scripted'

const A = tuning.specialistArcs
const rub = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₽`
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m)

function arcRng(state: GameState, label: string): Rng {
  return Rng.from(state.meta.rng).fork(`story:${state.calendar.day}:${label}`)
}

function patch(state: GameState, id: string, p: Partial<SpecialistState>): GameState {
  const sp = state.specialists[id]
  return sp ? { ...state, specialists: { ...state.specialists, [id]: { ...sp, ...p } } } : state
}

/** Take the next id the way the reducer does (meta.nextId, base 36). */
function takeId(state: GameState, prefix: string): [string, GameState] {
  const n = state.meta.nextId
  return [`${prefix}${n.toString(36)}`, { ...state, meta: { ...state.meta, nextId: n + 1 } }]
}

/** Months on retainer for arc conditions (0 when not retained). */
export function monthsRetained(state: GameState, id: string): number {
  const sp = state.specialists[id]
  if (!sp?.retained || sp.retired) return 0
  const elapsed = Math.floor((state.calendar.day - sp.sinceDay) / A.monthDays)
  return Math.max(0, Math.min(sp.months, elapsed))
}

/** The specialist as the person talking (at the counter, or on the phone). */
export function specialistCustomer(id: string): WalkIn | null {
  const def = getSpecialist(id)
  if (!def) return null
  // archetype carries their role: the dialogue strip shows it under the name.
  return { id: `sp_${id}`, name: def.name, archetype: def.role, temperament: 'flexible', knowledge: 1, desperation: 0, portraitKey: def.look ?? '', specialistId: id }
}

// --- calls ------------------------------------------------------------------------

type Truth = 'sound' | 'redone' | 'mixed' | 'doubt'

function truthOf(item: ItemInstance): Truth {
  if (item.authenticity === 'genuine') return 'sound'
  if (item.authenticity === 'restored') return 'redone'
  return item.authenticity === 'frankenstein' ? 'mixed' : 'doubt'
}

const missed = (verdict: SpecialistVerdict, item: ItemInstance) => verdict !== 'lowball' && verdict !== truthOf(item)

function bump(state: GameState, id: string, event: SpecialistEvent): GameState {
  const sp = state.specialists[id]
  return sp ? patch(state, id, { events: { ...sp.events, [event]: (sp.events[event] ?? 0) + 1 } }) : state
}

/** After a specialist's call on `item`: count what it turned out to be. */
export function noteCall(state: GameState, id: string, item: ItemInstance, verdict: SpecialistVerdict): GameState {
  let s = state
  if (verdict === 'sound' && item.authenticity === 'genuine' && item.trueValue >= A.bigValue) s = bump(s, id, 'soundBig')
  if (missed(verdict, item)) s = bump(s, id, 'wrong')
  if (verdict === 'sound' && item.authenticity !== 'genuine') s = bump(s, id, 'wrongSound')
  return s
}

/**
 * You just bought `item` at the counter. If a specialist was called on it this visit: a missed
 * call counts as wrongBought, a lowball is remembered until you sell the piece, and a sound call
 * from someone with first refusal (Gennady) puts their call at the end of today's line.
 */
export function noteBought(state: GameState, item: ItemInstance): GameState {
  const verdict = state.inspect?.findings.find((f) => f.tellId === SPECIALIST_TELL && f.verdict)?.verdict
  if (!verdict) return state
  const def = getItemDef(item.defId)
  const id = specialistFor(state, def)
  const sp = id ? state.specialists[id] : undefined
  if (!id || !sp) return state
  let s = state
  if (missed(verdict, item)) s = bump(s, id, 'wrongBought')
  if (verdict === 'lowball') s = patch(s, id, { lowballed: [...s.specialists[id]!.lowballed, item.id] })
  if (verdict === 'sound' && item.authenticity === 'genuine' && sp.mods.firstRefusal) s = firstRefusalCall(s, id, item)
  return s
}

/** Gennady rings that evening (the last call of the day) with a take-it-or-leave-it offer. */
function firstRefusalCall(state: GameState, id: string, item: ItemInstance): GameState {
  const customer = specialistCustomer(id)
  if (!customer) return state
  const offer = tidyPrice(item.trueValue * A.firstRefusalShare)
  const rng = arcRng(state, `refusal:${item.id}`)
  const line = fill(rng.pick(FIRST_REFUSAL_LINES), { item: shortName(getItemDef(item.defId).name), price: rub(offer) })
  const [visitId, s] = takeId(state, 'v')
  const visit: QueuedVisit = { visitId, kind: 'buyer', via: 'phone', customer, item: { ...item, revealed: [...item.revealed] }, patience: tuning.story.patience, line, offer }
  return { ...s, queue: [...s.queue, visit], day: { ...s.day, total: s.day.total + 1 } }
}

// --- effects ----------------------------------------------------------------------

/** Apply a named change (tuning.specialistArcs.changes) to a specialist. `text` labels a cash move in the ledger. */
export function applyChange(state: GameState, id: string, name: string, text?: string): GameState {
  const c = A.changes[name]
  const sp = state.specialists[id]
  const def = getSpecialist(id)
  if (!c || !sp || !def) return state
  const mods: SpecialistMods = { ...sp.mods }
  if (c.resetAccuracy) {
    delete mods.accuracy
    delete mods.driftPerMonth
  }
  if (c.accuracy) mods.accuracy = Math.round(((mods.accuracy ?? 0) + c.accuracy) * 1000) / 1000
  if (c.lowball !== undefined) mods.lowball = (mods.lowball ?? 1) * c.lowball
  if (c.driftPerMonth !== undefined) {
    if (c.driftPerMonth === 0) delete mods.driftPerMonth
    else mods.driftPerMonth = c.driftPerMonth
  }
  if (c.callSeconds !== undefined) mods.callSeconds = c.callSeconds === 'standard' ? tuning.inspect.toolSeconds.specialist : c.callSeconds
  if (c.callSecondsScale) mods.callSeconds = Math.round(specialistCallSeconds(id, mods) * c.callSecondsScale)
  if (c.freeMonths) mods.freeMonths = (mods.freeMonths ?? 0) + c.freeMonths
  if (c.freeCalls) mods.freeCalls = (mods.freeCalls ?? 0) + c.freeCalls
  if (c.firstRefusal !== undefined) mods.firstRefusal = c.firstRefusal
  if (c.referral) mods.referral = [...c.referral]
  if (c.sellBoost) mods.sellBoost = { categories: [...c.sellBoost.categories], factor: c.sellBoost.factor }
  if (c.rentIn) mods.rentIn = c.rentIn
  const relationship = Math.round(Math.min(1, Math.max(0, sp.relationship + (c.relationship ?? 0))) * 1000) / 1000
  let s = patch(state, id, { mods, relationship })
  if (c.cash) {
    s = { ...s, cash: s.cash + c.cash, day: { ...s.day, log: [...s.day.log, { kind: 'story', amount: c.cash, text: text ?? def.name }] } }
  }
  if (c.release) s = releaseSpecialist(s, id, { gentle: true })
  if (c.retire) s = s.specialists[id]!.retained ? releaseSpecialist(s, id, { retire: true }) : patch(s, id, { retired: true })
  return syncSpecialistsRep(s)
}

/** Start (or extend) a "turns up more for a while". */
export function startBoost(state: GameState, boostId: string): GameState {
  const cfg = A.boosts[boostId]
  if (!cfg) return state
  const until = state.calendar.day + cfg.days - 1
  const boosts = [...state.story.boosts.filter((b) => b.id !== boostId), { id: boostId, until }]
  return { ...state, story: { ...state.story, boosts } }
}

/** Running boosts only (expired ones dropped). Called at day open. */
export function pruneBoosts(state: GameState): GameState {
  const boosts = state.story.boosts.filter((b) => b.until >= state.calendar.day)
  return boosts.length === state.story.boosts.length ? state : { ...state, story: { ...state.story, boosts } }
}

/**
 * While a boost runs, each plain walk-in seller (came to sell, no story) may bring its item instead.
 * The item keeps its id; no boost, no change (and no draws from the day's stream).
 */
export function boostSellers(state: GameState, visits: readonly QueuedVisit[]): QueuedVisit[] {
  const active = state.story.boosts.filter((b) => b.until >= state.calendar.day)
  if (active.length === 0) return visits.slice()
  return visits.map((v) => {
    if (v.kind !== 'seller' || v.wants !== 'sell' || v.line !== undefined || v.beatId || v.customer.regularId) return v
    for (const b of active) {
      const cfg = A.boosts[b.id]
      const rng = arcRng(state, `boost:${b.id}:${v.visitId}`)
      if (!cfg || !rng.chance(cfg.chance)) continue
      const def = getItemDef(rng.pick(cfg.defs))
      const stories = cfg.story ? BOOST_STORIES[cfg.story] : undefined
      const story = stories?.length ? rng.pick(stories) : rng.pick(def.claims)
      const spec = { authenticity: cfg.authenticity, provenance: cfg.provenance, story, ...(cfg.fakeProfileId ? { fakeProfileId: cfg.fakeProfileId } : {}) }
      return { ...v, item: scriptedItem(def, spec, rng, v.item.id) }
    }
    return v
  })
}

/** A specialist buys from your stock (tuning.specialistArcs.offers): dead phones for parts, a medal for a family. */
export function sellToSpecialist(state: GameState, id: string, offerName: string): GameState {
  const o = A.offers[offerName]
  const def = getSpecialist(id)
  if (!o || !def) return state
  const mine = state.inventory.filter((i) => o.categories.includes(getItemDef(i.defId).category))
  const picked =
    o.pick === 'dead'
      ? mine.filter((i) => i.authenticity !== 'genuine' || i.condition <= (o.deadCondition ?? 0))
      : mine.filter((i) => i.authenticity === 'genuine').sort((a, b) => b.trueValue - a.trueValue).slice(0, 1)
  let s = state
  for (const item of picked) {
    const price = Math.max(o.min, tidyPrice(item.trueValue * o.share))
    s = removeSold(s, item.id, price)
    s = { ...s, day: { ...s.day, log: [...s.day.log, { kind: 'sell', amount: price, text: `Sold the ${getItemDef(item.defId).name} to ${def.short}`, itemId: item.id, defId: item.defId }] } }
  }
  return s
}

/** One person waiting in line gives up and leaves (Ilya's widow's watch took the time). */
export function walkoutOne(state: GameState): GameState {
  let i = state.queue.length - 1
  while (i >= 0 && (state.queue[i]!.beatId || state.queue[i]!.via || state.queue[i]!.kind === 'scene')) i--
  const v = state.queue[i]
  if (!v) return state
  const queue = state.queue.filter((_, j) => j !== i)
  const entry = { kind: 'walkout' as const, amount: 0, text: `${v.customer.name} got tired of waiting and left`, ...(v.item ? { defId: v.item.defId } : {}) }
  const next: GameState = {
    ...state,
    queue,
    day: { ...state.day, served: state.day.served + 1, log: [...state.day.log, entry] },
    reputation: { ...state.reputation, general: state.reputation.general - tuning.day.walkoutRepPenalty },
  }
  return repAfterWalkout(next, v.customer)
}

/**
 * Faina's referral (she said nothing, you said nothing): once a calendar month, on a morning you have
 * one of those categories on display with a tag, a buyer she sent comes in for the dearest of them.
 */
export function referralBuyers(state: GameState, nextId: (prefix: string) => string): { state: GameState; visits: QueuedVisit[] } {
  const month = state.calendar.date.slice(0, 7)
  const visits: QueuedVisit[] = []
  let s = state
  for (const [id, sp] of Object.entries(state.specialists)) {
    const cats = sp.mods.referral
    const def = getSpecialist(id)
    if (!sp.retained || !cats?.length || sp.mods.referralMonth === month || !def) continue
    const wanted = displayed(s)
      .filter((d) => d.price !== undefined && d.price > 0 && cats.includes(getItemDef(d.item.defId).category))
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0]
    if (!wanted) continue
    const rng = arcRng(s, `referral:${id}`)
    const customer = generateWalkIn(rng, nextId('c'))
    const line = fill(rng.pick(REFERRAL_LINES), { name: def.short, item: shortName(getItemDef(wanted.item.defId).name), price: rub(wanted.price ?? 0) })
    const [pMin, pMax] = tuning.sell.patience
    visits.push({ visitId: nextId('v'), kind: 'buyer', customer, item: { ...wanted.item, revealed: [...wanted.item.revealed] }, patience: Math.round(rng.range(pMin, pMax)), line })
    s = patch(s, id, { mods: { ...sp.mods, referralMonth: month } })
  }
  return { state: s, visits }
}
