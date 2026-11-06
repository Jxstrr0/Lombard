/**
 * Walk-in buyers (owner: shop worker). GDD § 4 "Buying side" and § 6.
 *
 * Contract (the reducer calls these; keep the signatures):
 *   planBuyers(state, rng, nextId) → QueuedVisit[]   kind 'buyer', item = snapshot of a displayed item,
 *       `line` = their opening line. Called at day open.
 *   startSale(state, item, tag, customer, rng) → SaleState   their opening offer (≤ tag) and hidden ceiling.
 *   saleRound(sale, counter, customer, rng) → { sale, response }   you counter with a price between
 *       their offer and your tag; they accept, raise, or walk.
 *
 * ## Who comes in (planBuyers)
 * Each displayed item with a tag rolls once per day:
 *   chance = baseChance × priceFactor(tag / trueValue) × visibility[area] × visibilityBonus(area)
 *            × demandMultiplier(def.demandTags) × reputationFactor × buyerRepFactor (neighbourhood, M4),
 *            capped at maxChance.
 * priceFactor > 1 under value (up to maxUnderBoost), decays exponentially over value. At most
 * maxBuyersPerDay buyers come (a seeded shuffle picks which). Items without a tag, or in the
 * safe, are not for sale.
 *
 * ## What they will pay (startSale)
 * The hidden ceiling comes from the item's real worth, never the tag alone:
 *   seen      = trueValue (+ part of the fake's claimed value for naive buyers: fakeFooled × (1 − knowledge))
 *   perceived = seen × demand × (1 ± perceptionNoise × (1 − knowledge))
 *   want      = perceived × (valuation draw + premium[temperament])
 *   ceiling   = min(tag, want × (1 + tagAnchor × (1 − knowledge) × max(0, tag / perceived − 1)))
 * A high tag pulls naive buyers up a little (so pricing high sells slowly but for more); a
 * knowledgeable buyer ignores it and won't overpay much for a fake. Opening offer =
 * ceiling × openShare[temperament], never above tag × openTagCap.
 *
 * ## A round (saleRound): the seller haggle in reverse
 * - A counter at or under their offer is treated as accepting their offer.
 * - Counters above the tag are read as the tag.
 * - Within their ceiling: accepted with a chance (certain on the final round), else they raise.
 * - Above their ceiling: on the final round they walk; otherwise they may walk (more the further
 *   over), else they raise toward your number, never past their ceiling.
 * - Holding firm (not coming down from your last counter, or opening at the tag) makes flexible
 *   and desperate buyers raise faster and proud ones respect it (accept bonus); stubborn and
 *   proud buyers above their ceiling are likelier to walk.
 * A sale never happens above the ceiling. Every number lives in tuning.sell / tuning.shop.
 */
import { getItemDef } from '../../data/items'
import { pickLine } from '../../data/lines'
import { saleWhere } from '../../data/saleLines'
import { tuning } from '../../data/tuning'
import { claimedValue } from '../appraise/value'
import { generateWalkIn } from '../customers/walkins'
import { demandMultiplier } from '../economy/demand'
import { visibilityBonus } from '../economy/upgrades'
import { buyerRepFactor } from '../reputation'
import type { Rng } from '../rng'
import { displayed, type DisplayedItem } from '../shop/display'
import type { GameState, SlotArea } from '../state'
import type { ItemInstance, QueuedVisit, SaleResponse, SaleState, WalkIn } from '../types'

const S = tuning.sell

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const rub = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₽`

function unit(x: number): number {
  return x >= S.roundTo.bigFrom ? S.roundTo.big : S.roundTo.small
}

/** Largest tidy price ≤ x (never below the smallest step). */
function tidyDown(x: number): number {
  const u = unit(x)
  return Math.max(S.roundTo.small, Math.floor(x / u) * u)
}

/** How people say an item's name out loud: "Vostok Komandirskie, Defence Ministry dial" → "Vostok Komandirskie". */
export function shortName(name: string): string {
  return name.split(',')[0]!.replace(/\s*\(.*?\)\s*/g, ' ').trim()
}

/** Daily chance that a displayed item with tag `tag` in `area` draws a buyer. */
export function sellChance(state: GameState, item: ItemInstance, area: SlotArea, tag: number): number {
  if (tag <= 0) return 0
  const def = getItemDef(item.defId)
  const ratio = tag / Math.max(1, item.trueValue)
  const price = ratio <= 1 ? Math.min(S.maxUnderBoost, 1 + S.underBoost * (1 - ratio)) : Math.exp(-S.overDecay * (ratio - 1))
  const visibility = tuning.shop.visibility[area] * visibilityBonus(state, area)
  const demand = demandMultiplier(state, def.demandTags)
  const rep = clamp(1 + state.reputation.general * S.repPerPoint, S.repClamp[0], S.repClamp[1])
  return clamp(S.baseChance * price * visibility * demand * rep * buyerRepFactor(state), 0, S.maxChance)
}

export function planBuyers(state: GameState, rng: Rng, nextId: (prefix: string) => string): QueuedVisit[] {
  let hits: DisplayedItem[] = []
  for (const d of displayed(state)) {
    if (d.price === undefined || d.price <= 0) continue
    if (rng.chance(sellChance(state, d.item, d.area, d.price))) hits.push(d)
  }
  if (hits.length > S.maxBuyersPerDay) hits = rng.shuffle(hits).slice(0, S.maxBuyersPerDay)
  const [pMin, pMax] = S.patience
  return hits.map((d) => {
    const customer = generateWalkIn(rng, nextId('c'))
    const line = pickLine(`sale.open.${customer.temperament}`, rng, {
      item: shortName(getItemDef(d.item.defId).name),
      where: saleWhere[d.area],
      price: rub(d.price ?? 0),
    })
    return {
      visitId: nextId('v'),
      kind: 'buyer' as const,
      customer,
      item: { ...d.item, revealed: [...d.item.revealed] },
      patience: Math.round(rng.range(pMin, pMax)),
      line,
    }
  })
}

/** The most this buyer will pay for `item` tagged at `tag` (hidden from the player). */
export function buyerCeiling(state: GameState, item: ItemInstance, tag: number, customer: WalkIn, rng: Rng): number {
  const def = getItemDef(item.defId)
  const k = clamp(customer.knowledge, 0, 1)
  let seen = item.trueValue
  if (item.authenticity !== 'genuine') seen += Math.max(0, claimedValue(def, item) - item.trueValue) * S.fakeFooled * (1 - k)
  const spread = S.perceptionNoise * (1 - k)
  const perceived = Math.max(1, seen * demandMultiplier(state, def.demandTags) * (1 + rng.range(-spread, spread)))
  const want = perceived * (rng.range(S.valuation[0], S.valuation[1]) + S.premium[customer.temperament])
  const pull = 1 + S.tagAnchor * (1 - k) * Math.max(0, tag / perceived - 1)
  const max = want * pull
  return max >= tag ? tag : Math.min(tag, tidyDown(max))
}

export function startSale(state: GameState, item: ItemInstance, tag: number, customer: WalkIn, rng: Rng): SaleState {
  const t = customer.temperament
  const ceiling = buyerCeiling(state, item, tag, customer, rng)
  const offer = Math.min(ceiling, tidyDown(Math.min(ceiling * S.openShare[t], tag * S.openTagCap)))
  const maxRounds = Math.max(1, Math.min(S.maxRounds, S.roundsByTemperament[t]))
  return { itemId: item.id, tag, offer, ceiling, round: 0, maxRounds, status: 'open', history: [] }
}

export function saleRound(sale: SaleState, counter: number, customer: WalkIn, rng: Rng): { sale: SaleState; response: SaleResponse } {
  const t = customer.temperament
  if (sale.status !== 'open') {
    const last = sale.history[sale.history.length - 1]?.response
    return { sale, response: last ?? { kind: 'walk', price: sale.offer, lineKey: `sale.walk.${t}` } }
  }
  const c = Math.min(Math.round(counter), sale.tag)
  const played = sale.round
  const isFinal = played + 1 >= sale.maxRounds
  const prev = sale.history[sale.history.length - 1]?.counter
  const firm = prev !== undefined ? c >= prev : c >= sale.tag * S.firmTagShare

  const finish = (kind: SaleResponse['kind'], price: number, lineKey: string, offer: number) => {
    const response: SaleResponse = { kind, price, lineKey }
    const next: SaleState = {
      ...sale,
      offer,
      round: played + 1,
      status: kind === 'accept' ? 'sold' : kind === 'walk' ? 'walked' : 'open',
      history: [...sale.history, { counter: c, response }],
    }
    return { sale: next, response }
  }

  // Asking for less than they offered: they pay what they said.
  if (c <= sale.offer) return finish('accept', sale.offer, 'sale.accept.under', sale.offer)

  if (c <= sale.ceiling) {
    if (isFinal) return finish('accept', c, firm ? 'sale.accept.firm' : `sale.accept.${t}`, sale.offer)
    const room = sale.ceiling > sale.offer ? (sale.ceiling - c) / (sale.ceiling - sale.offer) : 0
    const p = S.acceptBase[t] + S.acceptPerRound * played + S.acceptRoom * room + (firm ? S.firmAccept[t] : 0)
    if (rng.chance(p)) return finish('accept', c, firm ? 'sale.accept.firm' : `sale.accept.${t}`, sale.offer)
  } else {
    if (isFinal) return finish('walk', sale.offer, firm ? 'sale.walk.firm' : `sale.walk.${t}`, sale.offer)
    const pWalk = S.overshootWalk * (c / sale.ceiling - 1) + (firm ? S.firmWalk[t] : 0)
    if (rng.chance(pWalk)) return finish('walk', sale.offer, firm ? 'sale.walk.firm' : `sale.walk.${t}`, sale.offer)
  }

  // They raise toward your number, never past their ceiling.
  const share = Math.min(1, (S.raise[t] + S.raisePerRound * played) * (firm ? S.firmRaise[t] : 1))
  const raw = sale.offer + (c - sale.offer) * share
  const offer = Math.max(sale.offer, Math.min(sale.ceiling, tidyDown(Math.min(raw, sale.ceiling))))
  if (offer >= c) return finish('accept', c, `sale.accept.${t}`, sale.offer)

  let lineKey: string
  if (offer === sale.offer) lineKey = 'sale.counter.stuck'
  else if (offer >= sale.ceiling) lineKey = 'sale.counter.limit'
  else if (played + 2 >= sale.maxRounds) lineKey = 'sale.counter.last'
  else if (firm) lineKey = 'sale.counter.firm'
  else lineKey = `sale.counter.${t}`
  return finish('counter', offer, lineKey, offer)
}
