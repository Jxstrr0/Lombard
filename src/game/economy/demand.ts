/**
 * Seasonal demand, market drift and the morning paper (owner: content worker).
 * GDD § 7 ("electronics before school year, gold when the ruble wobbles,
 * medals around Victory Day") and § 10 (newspaper at day start).
 *
 * Contract:
 *   updateMarket(state, rng) → MarketState   called at day open with the NEW day's calendar:
 *       step each tag's drift, then write today's news (1–3 items hinting at demand; never exact numbers).
 *   demandMultiplier(state, tags) → number   season × holiday × drift for an item's demandTags (1 = normal).
 *       Used by buyers (shop worker) and the dealer.
 *
 * Model (numbers in tuning.demand):
 *   factor(tag) = season[tag][season] × Π holiday boosts active today × drift[tag]
 *   demandMultiplier = mean of factor over the item's tags, clamped to tuning.demand.multiplier.
 *   Drift is a slow, mean-reverting random walk per tag, stepped once a day, plus an
 *   occasional shock (ruble wobble, phone launch, flea-market raid…) that the paper reports.
 *
 * updateMarket draws from a fork of the day's rng, so adding stories never reshuffles the queue.
 */
import { ITEM_DEFS } from '../../data/items'
import { DRY_DAYS_ONLY, FIRST_DAY, FLAVOUR_NEWS, HINT_ALIAS, HINT_NEWS, HOLIDAY_NEWS, SEASON_HINTS, SHOCK_NEWS, type NewsTemplate } from '../../data/news'
import { tuning } from '../../data/tuning'
import { floodFactor, floodNews } from '../city/flood'
import { Rng } from '../rng'
import { seasonOf, type GameState, type ISODate, type Season } from '../state'
import type { MarketState, NewsItem } from '../types'

const T = tuning.demand

/** Every tag the market tracks, sorted (drift is stepped in this order: part of the save contract). */
export const DEMAND_TAGS: readonly string[] = [...new Set([...ITEM_DEFS.flatMap((d) => d.demandTags), ...Object.keys(T.seasons)])].sort()

// --- calendar -----------------------------------------------------------------------------

/** "MM-DD" of an ISO date. */
function monthDay(date: ISODate): string {
  return date.slice(5, 10)
}

/** Is `date` inside the inclusive MM-DD window (which may wrap the year end)? */
export function inWindow(date: ISODate, from: string, to: string): boolean {
  const md = monthDay(date)
  return from <= to ? md >= from && md <= to : md >= from || md <= to
}

/** Holidays whose window contains `date`, in tuning order. */
export function activeHolidays(date: ISODate): (typeof T.holidays)[number][] {
  return T.holidays.filter((h) => inWindow(date, h.from, h.to))
}

// --- multipliers ---------------------------------------------------------------------------

export function seasonFactor(tag: string, season: Season): number {
  return T.seasons[tag]?.[season] ?? 1
}

export function holidayFactor(tag: string, date: ISODate): number {
  let k = 1
  for (const h of activeHolidays(date)) k *= h.boost[tag] ?? 1
  return k
}

/** Season × holiday × drift (× the M6 flood, while it lasts) for one tag on the state's calendar day. */
export function tagFactor(state: Pick<GameState, 'calendar' | 'market'> & Partial<Pick<GameState, 'meta'>>, tag: string): number {
  const { date } = state.calendar
  const flood = state.meta ? floodFactor({ meta: state.meta, calendar: state.calendar }, tag) : 1
  return seasonFactor(tag, seasonOf(date)) * holidayFactor(tag, date) * (state.market.drift[tag] ?? 1) * flood
}

export function demandMultiplier(state: GameState, tags: readonly string[]): number {
  if (tags.length === 0) return 1
  const mean = tags.reduce((a, t) => a + tagFactor(state, t), 0) / tags.length
  return Math.min(T.multiplier.max, Math.max(T.multiplier.min, mean))
}

// --- drift ------------------------------------------------------------------------------------

const clampDrift = (d: number) => Math.min(T.drift.max, Math.max(T.drift.min, d))
const round3 = (x: number) => Math.round(x * 1000) / 1000

/** One day of random walk for every tracked tag. */
export function stepDrift(drift: Readonly<Record<string, number>>, rng: Rng): Record<string, number> {
  const out: Record<string, number> = {}
  for (const tag of DEMAND_TAGS) {
    const d = drift[tag] ?? 1
    out[tag] = round3(clampDrift(d + rng.range(-T.drift.step, T.drift.step) + T.drift.revert * (1 - d)))
  }
  return out
}

function applyShock(drift: Record<string, number>, shock: (typeof T.shocks)[number]): Record<string, number> {
  const out = { ...drift }
  for (const [tag, delta] of Object.entries(shock.delta)) out[tag] = round3(clampDrift((out[tag] ?? 1) + delta))
  return out
}

// --- news ---------------------------------------------------------------------------------

/**
 * M6: city flavour comes off a deck shuffled once per career, year and season (its own stream, no
 * game draws), dealt in order through the season: up to three cards a day, so a story doesn't come
 * round again until the deck has been through (about a week and a half for thirty stories), and the
 * next year deals the same season in a different order.
 */
function flavourDeck(state: Pick<GameState, 'meta' | 'calendar'>, pool: readonly NewsTemplate[], label = 'deck', perDay: number = T.news.storyCountWeights.length): { deck: NewsTemplate[]; at: number } {
  const { date } = state.calendar
  const season = seasonOf(date)
  const month = Number(date.slice(5, 7))
  // The season's first day (winter starts on 1 December of the year before January and February).
  const year = Number(date.slice(0, 4)) - (season === 'winter' && month <= 2 ? 1 : 0)
  const startMonth = { winter: 12, spring: 3, summer: 6, autumn: 9 }[season]
  const start = Date.UTC(year, startMonth - 1, 1)
  const day = Math.round((Date.parse(`${date}T00:00:00Z`) - start) / 86_400_000)
  const deck = new Rng(state.meta.seed).fork(`news:${label}:${year}:${season}`).shuffle(pool.slice())
  return { deck, at: day * perDay }
}

function toNews(t: NewsTemplate, shopName: string, tags: string[], direction: NewsItem['direction']): NewsItem {
  const fill = (s: string) => s.replaceAll('{shop}', shopName)
  return { id: t.id, headline: fill(t.headline), body: fill(t.body), tags, direction }
}

function directionOf(delta: Readonly<Record<string, number>>): NewsItem['direction'] {
  const sum = Object.values(delta).reduce((a, b) => a + b, 0)
  return sum > 0 ? 'up' : sum < 0 ? 'down' : 'flat'
}

/** Pick a template not printed yesterday (falls back to any if all were). */
function pickFresh(rng: Rng, pool: readonly NewsTemplate[], avoid: ReadonlySet<string>): NewsTemplate | undefined {
  if (pool.length === 0) return undefined
  const fresh = pool.filter((t) => !avoid.has(t.id))
  return rng.pick(fresh.length > 0 ? fresh : pool)
}

export function updateMarket(state: GameState, rng0: Rng): MarketState {
  const rng = rng0.fork('market')
  const { date, day } = state.calendar
  const season = seasonOf(date)
  const yesterday = new Set(state.market.news.map((n) => n.id))
  const used = new Set<string>()

  // 1. Drift, then maybe a shock.
  let drift = stepDrift(state.market.drift, rng)
  const shock = rng.chance(T.shockChance) ? rng.weighted(T.shocks.map((s) => ({ item: s, weight: s.weight }))) : undefined
  if (shock) drift = applyShock(drift, shock)

  // 2. Today's paper: target length, then the stories that must or may run, then flavour.
  const counts = T.news.storyCountWeights.map((w, i) => ({ item: i + 1, weight: w }))
  const target = rng.weighted(counts)
  const news: NewsItem[] = []
  const add = (t: NewsTemplate | undefined, tags: string[], direction: NewsItem['direction']) => {
    if (!t || used.has(t.id)) return
    used.add(t.id)
    news.push(toNews(t, state.shop.name, tags, direction))
  }

  if (day === 1) add(FIRST_DAY[0], [], 'flat')
  // M6 the Flood: its story leads the paper while the water is about (src/game/city/flood.ts).
  const flood = floodNews(state)
  // Tags no item carries yet (tools: pumps, boots, generators) are left off the hint.
  const floodTags = (flood?.tags ?? []).filter((t) => DEMAND_TAGS.includes(t))
  if (flood) add(flood, floodTags, floodTags.length ? (flood.direction ?? 'flat') : 'flat')
  if (shock) add(pickFresh(rng, SHOCK_NEWS[shock.id] ?? [], yesterday), Object.keys(shock.delta), directionOf(shock.delta))
  for (const h of activeHolidays(date)) {
    const firstDay = monthDay(date) === h.from || day === 1
    const tags = Object.keys(h.boost)
    if (firstDay || rng.chance(T.news.holidayChance)) add(pickFresh(rng, HOLIDAY_NEWS[h.id] ?? [], yesterday), tags, tags.length ? 'up' : 'flat')
  }
  if (news.length < T.news.storyCountWeights.length) {
    // The tag that has wandered furthest, if far enough, gets a hint.
    let best: { tag: string; d: number } | undefined
    for (const tag of DEMAND_TAGS) {
      const d = drift[tag] ?? 1
      if (!best || Math.abs(d - 1) > Math.abs(best.d - 1)) best = { tag, d }
    }
    if (best && Math.abs(best.d - 1) >= T.news.driftHintThreshold && rng.chance(T.news.driftHintChance)) {
      const hints = HINT_NEWS[best.tag] ?? HINT_NEWS[HINT_ALIAS[best.tag] ?? '']
      const up = best.d > 1
      add(pickFresh(rng, hints ? (up ? hints.up : hints.down) : [], yesterday), [best.tag], up ? 'up' : 'down')
    }
  }
  // M6: a seasonal market note now and then (SEASON_HINTS agree with tuning.demand.seasons; tests check),
  // dealt one a day from the season's own deck so the same note doesn't come round for days. Not while
  // the water is about: the flood's own stories say where trade has gone.
  const floodDays = flood !== undefined
  if (!floodDays && news.length < target && rng.chance(T.news.seasonHintChance)) {
    const hints = flavourDeck(state, SEASON_HINTS[season], 'hints', 1)
    const t = hints.deck[hints.at % hints.deck.length]
    if (t && !yesterday.has(t.id)) add(t, [...(t.tags ?? [])], t.direction ?? 'flat')
  }
  const flavour = FLAVOUR_NEWS.filter((t) => !t.seasons || t.seasons.includes(season))
  const { deck, at } = flavourDeck(state, flavour)
  for (let i = 0; news.length < target && i < deck.length; i++) {
    const t = deck[(at + i) % deck.length]!
    // (the deck is the whole season's, so leaving some out on flood days doesn't reshuffle it)
    if (used.has(t.id) || yesterday.has(t.id) || (floodDays && DRY_DAYS_ONLY.has(t.id))) continue
    add(t, [], 'flat')
  }
  return { drift, news: news.slice(0, T.news.storyCountWeights.length) }
}
