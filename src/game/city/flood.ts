/**
 * The Flood (M6, GDD § 9: a city event). Pure; numbers in tuning.flood, words in src/data/flood.ts,
 * the people's beats in src/data/stories/flood.ts.
 *
 * Once per career, in the first spring's ice drift, the canal comes over the embankment. The day
 * is seeded from the career seed alone (floodDay), so it is the same day however the career is
 * played and nothing has to be stored: every phase below is a function of the seed and the day.
 *
 *   warning   the paper: ice jammed under the Kupetsky Bridge (D −7 … −4)
 *   rising    the water at the top step (D −3 … −1); Kuzmich comes round with sandbags (a beat, D −5 … −1)
 *   flood     over the embankment (D 0, 1): the flood morning hits the shop (floodHit), fewer
 *             walk-ins, many of them flooded out (floodSellers); the street's demand turns (floodFactor)
 *   receding  the water goes down, the mud stays (D 2 … 4); still flooded-out sellers
 *   drying    the shop floor dries (presentation only)
 *   after     the bill; demand back to normal from D +tuning.flood.demandDays
 *
 * Preparation is story flags set by the sandbags beat: flood.sandbags or flood.lifted (neither:
 * unprepared). The flood morning sets flood.hit, and flood.damaged or flood.dry. Being a hero or a
 * vulture is counted from flood.hero_* and flood.vulture_* flags (the `flood` story condition).
 */
import { FLOOD_LOG, FLOOD_MORNING, FLOOD_NEWS, FLOOD_PERSON, FLOOD_SELLER_LINES } from '../../data/flood'
import { getItemDef } from '../../data/items'
import type { NewsTemplate } from '../../data/news'
import { tuning } from '../../data/tuning'
import { conditionFactor, tidyPrice } from '../appraise/value'
import { Rng } from '../rng'
import type { GameState } from '../state'
import type { LedgerEntry, QueuedVisit, WalkIn } from '../types'

const F = tuning.flood

export const FLOOD_ID = FLOOD_PERSON.id

/** Flags the flood itself sets and reads (the beats set more; see src/data/stories/flood.ts). */
export const FLOOD_FLAGS = {
  sandbags: 'flood.sandbags',
  lifted: 'flood.lifted',
  unprepared: 'flood.unprepared',
  hit: 'flood.hit',
  damaged: 'flood.damaged',
  dry: 'flood.dry',
  heroPrefix: 'flood.hero_',
  vulturePrefix: 'flood.vulture_',
} as const

export function floodCustomer(): WalkIn {
  return { id: FLOOD_ID, name: FLOOD_PERSON.name, archetype: FLOOD_PERSON.role, temperament: 'stubborn', knowledge: 0.5, desperation: 0.2, portraitKey: FLOOD_PERSON.look }
}

/** The career's flood day (seeded from the career seed only; tuning.flood.days). */
export function floodDay(seed: number): number {
  const [a, b] = F.days
  return new Rng(seed >>> 0).fork('flood:day').int(a, b)
}

/** Days since the flood day (negative before it). */
export function floodOffset(state: Pick<GameState, 'meta' | 'calendar'>): number {
  return state.calendar.day - floodDay(state.meta.seed)
}

export type FloodPhase = 'before' | 'warning' | 'rising' | 'flood' | 'receding' | 'drying' | 'after'

/** The phase `d` days after the flood day. */
export function phaseAt(d: number): FloodPhase {
  if (d < -F.warnDays) return 'before'
  if (d < -F.risingDays) return 'warning'
  if (d < 0) return 'rising'
  if (d < F.floodDays) return 'flood'
  if (d < F.floodDays + F.recedeDays) return 'receding'
  if (d < F.floodDays + F.recedeDays + F.dryDays) return 'drying'
  return 'after'
}

export function floodPhase(state: Pick<GameState, 'meta' | 'calendar'>): FloodPhase {
  return phaseAt(floodOffset(state))
}

export type FloodPrep = 'none' | 'sandbags' | 'lifted'

export function floodPrep(state: Pick<GameState, 'story'>): FloodPrep {
  const f = state.story.flags
  return f.includes(FLOOD_FLAGS.lifted) ? 'lifted' : f.includes(FLOOD_FLAGS.sandbags) ? 'sandbags' : 'none'
}

/** How the shop behaved through the flood: hero and vulture choices, counted. */
export function floodRecord(state: Pick<GameState, 'story'>): { hero: number; vulture: number } {
  let hero = 0
  let vulture = 0
  for (const f of state.story.flags) {
    if (f.startsWith(FLOOD_FLAGS.heroPrefix)) hero++
    else if (f.startsWith(FLOOD_FLAGS.vulturePrefix)) vulture++
  }
  return { hero, vulture }
}

/** The flood's demand multiplier for a tag (1 outside the flood's days). */
export function floodFactor(state: Pick<GameState, 'meta' | 'calendar'>, tag: string): number {
  const d = floodOffset(state)
  if (d < 0 || d > F.demandDays) return 1
  return F.demand[tag] ?? 1
}

/** Walk-ins today, scaled down while the street is under water. */
export function floodWalkIns(state: Pick<GameState, 'meta' | 'calendar'>, count: number): number {
  return floodPhase(state) === 'flood' && count > 0 ? Math.max(1, Math.round(count * F.customersScale)) : count
}

/**
 * People sell to survive: from the flood day until the water is down, some walk-in sellers are
 * flooded out (more desperate, and they say so). Own streams per visit; no game draws.
 */
export function floodSellers(state: GameState, visits: readonly QueuedVisit[]): QueuedVisit[] {
  const phase = floodPhase(state)
  if (phase !== 'flood' && phase !== 'receding') return visits.slice()
  const S = F.sellers
  return visits.map((v) => {
    if (v.kind !== 'seller' || v.beatId || v.customer.regularId) return v
    const rng = new Rng(state.meta.seed).fork(`flood:seller:${state.calendar.day}:${v.visitId}`)
    if (!rng.chance(S.chance)) return v
    const desperation = Math.round(Math.min(S.cap, v.customer.desperation + S.desperation) * 100) / 100
    const temperament = desperation > 0.85 ? ('desperate' as const) : v.customer.temperament
    const said = rng.pick(FLOOD_SELLER_LINES)
    const line = v.wants === 'pawn' ? `${said} ${v.line ?? ''}`.trim() : `${said} ${v.line ?? v.item.story}`
    return { ...v, customer: { ...v.customer, desperation, temperament }, line }
  })
}

function addFlags(state: GameState, flags: readonly string[]): GameState {
  const add = flags.filter((f) => !state.story.flags.includes(f))
  return add.length ? { ...state, story: { ...state.story, flags: [...state.story.flags, ...add] } } : state
}

/** Stock the water can reach: the back (low) shelf and everything not on display. */
export function atRisk(state: GameState): string[] {
  const area = new Map<string, string>()
  for (const s of state.shop.slots) if (s.itemId) area.set(s.itemId, s.area)
  return state.inventory.filter((i) => {
    const a = area.get(i.id)
    return a === undefined || a === 'back'
  }).map((i) => i.id)
}

/**
 * The flood morning (D 0): wet stock loses condition (and value) by category, and the clean-up is
 * billed, both by how ready the shop was. Once per career (flood.hit). Its own stream.
 */
export function floodHit(state: GameState): { state: GameState; morning: string | null } {
  if (floodOffset(state) !== 0 || state.story.flags.includes(FLOOD_FLAGS.hit)) return { state, morning: null }
  const prep = floodPrep(state)
  const cfg = F.hit[prep]
  const rng = new Rng(state.meta.seed).fork('flood:hit')
  const risk = new Set(atRisk(state))
  const log: LedgerEntry[] = []
  let damaged = 0
  const inventory = state.inventory.map((item) => {
    if (!risk.has(item.id) || !rng.chance(cfg.chance)) return item
    const def = getItemDef(item.defId)
    const [lo, hi] = F.damage[def.category] ?? F.damage.other!
    const condition = Math.max(1, item.condition - rng.int(lo, hi))
    if (condition === item.condition) return item
    const k = conditionFactor(def.valueCurve, condition) / conditionFactor(def.valueCurve, item.condition)
    damaged++
    log.push({ kind: 'story', amount: 0, text: FLOOD_LOG.damaged.replace('{item}', def.name).replace('{from}', String(item.condition)).replace('{to}', String(condition)), itemId: item.id, defId: item.defId })
    return { ...item, condition, trueValue: tidyPrice(item.trueValue * k) }
  })
  log.unshift({ kind: 'expense', amount: -cfg.bill, text: FLOOD_LOG.bill.replace('{prep}', FLOOD_LOG.prep[prep]) })
  let s: GameState = { ...state, inventory, cash: state.cash - cfg.bill, day: { ...state.day, log: [...state.day.log, ...log] } }
  s = addFlags(s, [FLOOD_FLAGS.hit, damaged > 0 ? FLOOD_FLAGS.damaged : FLOOD_FLAGS.dry])
  return { state: s, morning: FLOOD_MORNING[prep] }
}

/** The morning line on a flood day after the first, or while the water goes down (null otherwise). */
export function floodMorningLine(state: GameState): string | null {
  const d = floodOffset(state)
  if (d === 0) return null
  const phase = phaseAt(d)
  if (phase === 'flood') return FLOOD_MORNING.still
  if (phase === 'receding' && d === F.floodDays) return FLOOD_MORNING.receding
  return null
}

/**
 * Today's flood story for the paper (the lead), or undefined. Deterministic: the phase's stories
 * in turn, so none repeats while the water is about; the flood morning always leads with the first.
 * After the water has gone, one story a day about the bill until those run out.
 */
export function floodNews(state: Pick<GameState, 'meta' | 'calendar'>): NewsTemplate | undefined {
  const d = floodOffset(state)
  const phase = phaseAt(d)
  const at = (pool: readonly NewsTemplate[], i: number) => pool[((i % pool.length) + pool.length) % pool.length]
  switch (phase) {
    case 'warning':
      return at(FLOOD_NEWS.warning, d + F.warnDays)
    case 'rising':
      return at(FLOOD_NEWS.rising, d + F.risingDays)
    case 'flood':
      return at(FLOOD_NEWS.flood, d)
    case 'receding':
      return at(FLOOD_NEWS.receding, d - F.floodDays)
    default: {
      const k = d - F.floodDays - F.recedeDays
      return k >= 0 && k < FLOOD_NEWS.after.length ? FLOOD_NEWS.after[k] : undefined
    }
  }
}

/** What the render shows (presentation only reads this): the phase, days since the flood, how ready the shop was. */
export function floodView(state: Pick<GameState, 'meta' | 'calendar' | 'story'>): { phase: FloodPhase; offset: number; prep: FloodPrep; sandbags: boolean } {
  const offset = floodOffset(state)
  const phase = phaseAt(offset)
  const prep = floodPrep(state)
  // The sandbags stand at the door from the day they came until the water has gone.
  const sandbags = prep === 'sandbags' && offset < F.floodDays + F.recedeDays
  return { phase, offset, prep, sandbags }
}
