/**
 * Actions are plain objects (loggable, replayable). The reducer is pure:
 * same state + same action = same result, including RNG draws, because the
 * RNG state lives in GameState.meta.rng.
 *
 * Day loop:
 *   [career/begin once] → day/open → [news/dismiss] → counter/next →
 *     seller: counter/inspect → inspect/useTool… → inspect/done → offer/estimate
 *             → offer/make… (haggle; buy or pawn) → [bought | pawned | walked] or counter/pass
 *     buyer:  sale/counter… or sale/accept → [sold | walked] or counter/pass
 *     redeem: loan/return → redeemed
 *   → counter/dismiss → … → day/close (shoplifting, expenses, ledger) → ledger/sell… / shop/* / upgrade/* → day/open
 *
 * Between customers (and while closed) the player can arrange the display: shop/place, shop/price.
 */
import { getItemDef } from '../data/items'
import { getBeat } from '../data/stories'
import { pickLine, visitLines } from '../data/lines'
import { tuning } from '../data/tuning'
import { claimedValue, dealerPrice, tidyPrice } from './appraise/value'
import { leftoverStock } from './career/start'
import { generateDayQueue } from './customers/walkins'
import { planStory, storyRng } from './story/plan'
import { afterVisit, playPaperBeats, sceneChoose, sceneFor, sceneNext } from './story/visit'
import { boostSellers, noteBought, noteCall, pruneBoosts, referralBuyers } from './story/specialists'
import { noteForfeits, pledgeRedeemLines } from './story/pledges'
import { updateMarket } from './economy/demand'
import { floodHit, floodMorningLine, floodSellers, floodWalkIns } from './city/flood'
import { chargeExpenses } from './economy/expenses'
import { runCrimeEvents } from './crime/vandalism'
import { endCareer } from './endings/end'
import { checkEviction } from './endings/eviction'
import { releaseSpecialist, retainSpecialist } from './economy/specialists'
import { buyUpgrade, restockAcid } from './economy/upgrades'
import { haggleRound, startHaggle, type HaggleContext } from './haggle/machine'
import { payForTool, toolExtras } from './inspect/available'
import { SPECIALIST_TELL, useTool } from './inspect/tools'
import { amountDue, createLoan, forfeitOverdue, pawnClaim, planRedemptions } from './loans/loans'
import { axesAfterDeal } from './endings/axes'
import { bringBulletin, printBulletin, pruneBulletin } from './crime/bulletin'
import { heatAfterDeal, heatNight, matureTrails } from './crime/heat'
import { passportCheck } from './crime/ledger'
import { isPoliceVisit, planPolice, policeChoose, policeScene, rollRaid } from './crime/volkova'
import { fenceAsk, fenceHaggle, isFence, planFence } from './crime/fence'
import { FENCE_LINES } from '../data/fence'
import { VOLKOVA, volkovaLines } from '../data/police'
import { patienceRepFactor, repAfterDeal, repAfterInsult, repAfterRedeem, repAfterSale, repAfterWalkout, syncSpecialistsRep } from './reputation'
import { Rng } from './rng'
import type { ToolId } from './schema/item'
import { planBuyers, saleRound, startSale } from './sell/buyer'
import { placeItem, setPrice } from './shop/display'
import { removeSold } from './shop/sold'
import { rollShoplifting } from './shop/theft'
import { chargeWages, finishShift, fire as fireStaff, hire as hireStaff, setRule as setStaffRule, staffWork } from './staff/appraiser'
import type { StaffMode } from './state'
import { addDays, createInitialState, seasonOf, weekdayOf, type GameState, type Settings } from './state'
import type { Approach, DaySummary, ItemVisit, LedgerEntry, QueuedVisit, VisitOutcome, VisitState } from './types'

export type Action =
  | { type: 'day/open' }
  | { type: 'day/close' }
  | { type: 'counter/next' }
  | { type: 'counter/inspect' }
  | { type: 'inspect/useTool'; tool: ToolId; hotspot?: string }
  | { type: 'inspect/done' }
  | { type: 'inspect/back' }
  | { type: 'offer/estimate'; value: number }
  | { type: 'offer/make'; amount: number; approach: Approach; evidenceId?: string }
  | { type: 'offer/acceptAsk' }
  | { type: 'counter/pass' }
  | { type: 'counter/dismiss' }
  | { type: 'time/tick'; seconds: number }
  | { type: 'ledger/sell'; itemId: string }
  | { type: 'career/new'; seed: number; careerId: string }
  /** Finish the career-start intro: name the shop, receive the previous owner's leftovers. */
  | { type: 'career/begin'; shopName: string }
  | { type: 'news/dismiss' }
  /** slotId null = back to the safe. */
  | { type: 'shop/place'; itemId: string; slotId: string | null }
  | { type: 'shop/price'; itemId: string; price: number }
  | { type: 'sale/accept' }
  | { type: 'sale/counter'; amount: number }
  | { type: 'loan/return' }
  | { type: 'upgrade/buy'; id: string }
  | { type: 'acid/restock' }
  | { type: 'specialist/retain'; id: string }
  | { type: 'specialist/release'; id: string }
  | { type: 'settings/set'; patch: Partial<Settings> }
  /** M4 story scene: next line, or end the scene (an item visit moves on to the item). */
  | { type: 'scene/next' }
  /** M4 story scene: pick one of the choices offered on its last line. */
  | { type: 'scene/choose'; choiceId: string }
  /** M5: retire from the ledger (from tuning.endings.retireDay; the UI confirms first). Ends the career. */
  | { type: 'career/retire' }
  /** M6: hire the appraiser (needs the second counter; office, while closed). */
  | { type: 'staff/hire' }
  /** M6: let him go (office, while closed; the UI confirms first). Final. */
  | { type: 'staff/fire' }
  /** M6: which walk-ins he takes: the overflow, or only some categories. */
  | { type: 'staff/rule'; mode: StaffMode; categories?: string[] }

/** Action types after which the career is autosaved. */
export const AUTOSAVE_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'counter/dismiss',
  'day/close',
  'day/open',
  'ledger/sell',
  'career/new',
  'career/begin',
  'news/dismiss',
  'shop/place',
  'shop/price',
  'upgrade/buy',
  'acid/restock',
  'specialist/retain',
  'specialist/release',
  'career/retire',
  'staff/hire',
  'staff/fire',
  'staff/rule',
])

/** M5: the only actions an ended career still takes (it can't be played on; GDD § 12). */
const AFTER_END: ReadonlySet<Action['type']> = new Set(['settings/set', 'career/new'])

const rub = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₽`

export function reducer(state: GameState, action: Action): GameState {
  if (state.career.end && !AFTER_END.has(action.type)) return state
  switch (action.type) {
    case 'day/open':
      return openDay(state)
    case 'day/close':
      return closeDay(state)
    case 'counter/next':
      return nextCustomer(state)
    case 'counter/inspect': {
      const c = state.current
      if (!c || c.phase !== 'present' || c.kind !== 'seller') return state
      return { ...state, current: { ...c, phase: 'inspect' } }
    }
    case 'inspect/useTool':
      return applyTool(state, action.tool, action.hotspot)
    case 'inspect/done': {
      const c = state.current
      if (!c || c.phase !== 'inspect') return state
      return { ...state, current: { ...c, phase: 'offer' } }
    }
    case 'inspect/back': {
      const c = state.current
      if (!c || c.phase !== 'offer') return state
      return { ...state, current: { ...c, phase: 'inspect' } }
    }
    case 'offer/estimate': {
      if (!state.current || !state.inspect || state.current.phase === 'resolved') return state
      const value = Math.max(0, Math.round(action.value))
      return { ...state, inspect: { ...state.inspect, estimate: value } }
    }
    case 'offer/make':
      return makeOffer(state, action.amount, action.approach, action.evidenceId)
    case 'offer/acceptAsk': {
      const h = state.haggle
      if (!state.current || state.current.phase !== 'offer' || !h || h.status !== 'open') return state
      if (h.ask > state.cash) return state
      const accepted = { ...state, haggle: { ...h, status: 'accepted' as const } }
      return state.current.wants === 'pawn' ? pawn(accepted, h.ask) : buy(accepted, h.ask)
    }
    case 'counter/pass': {
      const c = itemVisit(state)
      if (!c || c.phase === 'resolved' || c.phase === 'scene' || c.kind === 'redeem') return state
      const name = getItemDef(c.item.defId).name
      return withRng(state, (s, rng) =>
        resolve(s, 'passed', c.kind === 'buyer' ? pickLine('sale.refused.flexible', rng, {}) : rng.pick(visitLines.pass), {
          kind: 'pass',
          amount: 0,
          text: c.kind === 'buyer' ? `Wouldn’t sell the ${name} to ${c.customer.name}` : `Passed on ${name} from ${c.customer.name}`,
          defId: c.item.defId,
        }),
      )
    }
    case 'sale/accept': {
      const c = state.current
      if (!c || c.kind !== 'buyer' || c.phase !== 'present' || !c.sale || c.sale.status !== 'open') return state
      return sellToBuyer(state, c.sale.offer)
    }
    case 'sale/counter':
      return counterSale(state, action.amount)
    case 'loan/return':
      return redeemLoan(state)
    case 'news/dismiss':
      return state.day.newsRead ? state : { ...state, day: { ...state.day, newsRead: true } }
    case 'shop/place':
      return canArrange(state) ? placeItem(state, action.itemId, action.slotId) : state
    case 'shop/price':
      return canArrange(state) ? setPrice(state, action.itemId, action.price) : state
    case 'upgrade/buy':
      return state.day.phase === 'closed' ? buyUpgrade(state, action.id) : state
    case 'acid/restock':
      return state.day.phase === 'closed' ? restockAcid(state) : state
    case 'specialist/retain':
      return state.day.phase === 'closed' ? syncSpecialistsRep(retainSpecialist(state, action.id)) : state
    case 'specialist/release':
      return state.day.phase === 'closed' ? syncSpecialistsRep(releaseSpecialist(state, action.id)) : state
    case 'career/begin':
      return beginCareer(state, action.shopName)
    case 'staff/hire':
      return state.day.phase === 'closed' ? hireStaff(state) : state
    case 'staff/fire':
      return state.day.phase === 'closed' ? fireStaff(state) : state
    case 'staff/rule':
      return setStaffRule(state, action.mode, action.categories)
    case 'counter/dismiss': {
      const c = state.current
      if (!c || c.phase !== 'resolved') return state
      const served = state.day.served + 1
      const rng = lullRng(state, c.visitId)
      return {
        ...state,
        current: null,
        inspect: null,
        haggle: null,
        day: { ...state.day, served, nextArrival: state.day.clock + rng.range(...tuning.day.lullSeconds) },
        narration: state.queue.length > 0 ? rng.pick(visitLines.lull) : 'That’s everyone for today. Time to close up.',
      }
    }
    case 'time/tick': {
      const c = state.current
      if (state.day.phase !== 'open' || action.seconds <= 0) return state
      if (!c) return lullTick(state, action.seconds * tuning.day.realTimeScale)
      if (c.phase === 'resolved') return state
      return advanceTime(state, action.seconds * tuning.day.realTimeScale)
    }
    case 'ledger/sell':
      return sellToDealer(state, action.itemId)
    case 'career/new':
      return { ...createInitialState(action.seed, action.careerId), settings: state.settings }
    case 'settings/set':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'scene/next':
      return endOrStepScene(state)
    case 'scene/choose':
      // M5: Volkova's question is a systemic scene (crime/volkova.ts), not an arc beat.
      return isPoliceVisit(state.current) ? policeChoose(state, action.choiceId) : sceneChoose(state, action.choiceId)
    case 'career/retire':
      // Between days only: the ledger is where the Retire button lives.
      return state.day.phase === 'closed' && !state.meta.intro ? endCareer(state, 'retired') : state
    default: {
      const unknown: never = action
      return unknown
    }
  }
}

// --- helpers ------------------------------------------------------------------

/** Run `fn` with an Rng restored from state and write its state back. */
function withRng(state: GameState, fn: (s: GameState, rng: Rng) => GameState): GameState {
  const rng = Rng.from(state.meta.rng)
  const next = fn(state, rng)
  return { ...next, meta: { ...next.meta, rng: rng.state } }
}

/** The customer at the counter if they brought an item (not a story scene visitor). */
function itemVisit(state: GameState): ItemVisit | null {
  const c = state.current
  return c && c.kind !== 'scene' ? c : null
}

/** Allocates ids from meta.nextId; returns the updated meta via the closure's counter. */
function idAllocator(state: GameState): { next: (prefix: string) => string; nextId: () => number } {
  let n = state.meta.nextId
  return { next: (prefix) => `${prefix}${(n++).toString(36)}`, nextId: () => n }
}

function log(state: GameState, entry: LedgerEntry): GameState {
  return { ...state, day: { ...state.day, log: [...state.day.log, entry] } }
}

function haggleContext(state: GameState): HaggleContext | null {
  if (!state.current || !state.inspect || state.current.kind !== 'seller') return null
  const item = state.current.item
  // M5: the fence names his price; offers are judged against it (an insult is far under it).
  const full = isFence(state.current.customer) ? fenceAsk(state, item) : claimedValue(getItemDef(item.defId), item)
  // M5: a story seller may open cheap on purpose (the crew's deliveries: visit.anchor).
  const anchor = state.current.beatId ? (getBeat(state.current.beatId)?.visit.anchor ?? 1) : 1
  const claim = anchor === 1 ? full : tidyPrice(full * anchor)
  return {
    customer: state.current.customer,
    item,
    claimedValue: state.current.wants === 'pawn' ? pawnClaim(claim, state.current.customer) : claim,
    findings: state.inspect.findings,
    ...(state.current.customer.regularId ? { trust: state.customers[state.current.customer.regularId]?.trust ?? 0 } : {}),
  }
}

/** The display can be rearranged while closed or when nobody is at the counter. */
function canArrange(state: GameState): boolean {
  return state.day.phase === 'closed' || state.current === null
}

/** Insert `others` at seeded random positions among `sellers` (order within each list is kept). */
function mergeQueue(sellers: QueuedVisit[], others: QueuedVisit[], rng: Rng): QueuedVisit[] {
  const out = sellers.slice()
  for (const v of others) out.splice(rng.int(0, out.length), 0, v)
  return out
}

function beginCareer(state: GameState, shopName: string): GameState {
  if (!state.meta.intro) return state
  const name = shopName.trim().slice(0, tuning.career.shopNameMaxLength) || tuning.career.defaultShopName
  return withRng(state, (s, rng) => {
    const ids = idAllocator(s)
    const stock = leftoverStock(rng, ids.next)
    const paid = { ...s.paid }
    for (const it of stock) paid[it.id] = 0
    return {
      ...s,
      meta: { ...s.meta, intro: false, nextId: ids.nextId() },
      shop: { ...s.shop, name },
      inventory: [...s.inventory, ...stock],
      paid,
    }
  })
}

// --- day ----------------------------------------------------------------------

function openDay(state: GameState): GameState {
  if (state.day.phase !== 'closed' || state.meta.intro) return state
  return withRng(state, (s0, rng) => {
    // Start today's log first so forfeits land in it.
    let s: GameState = { ...s0, day: { phase: 'open', clock: 0, served: 0, total: 0, openingCash: s0.cash, log: [], newsRead: true } }
    const pledged = s.loans
    // Story beats hear about their pledges forfeited this morning.
    s = pruneBoosts(noteForfeits(forfeitOverdue(s), pledged))
    // M5: last night's vandalism (the brick) and the glazier, from their own streams.
    const crimeNight = runCrimeEvents(s)
    s = crimeNight.state
    s = { ...s, market: updateMarket(s, rng) }
    // M6 the Flood: the flood morning soaks what the water can reach and bills the clean-up (own stream).
    const flooded = floodHit(s)
    s = flooded.state
    const floodMorning = flooded.morning ?? floodMorningLine(s)
    // M5 police: trails reaching you today land their heat; maybe a stolen-goods bulletin in the paper.
    s = printBulletin(matureTrails(s))
    const ids = idAllocator(s)
    // Regulars and story beats first: their sellers take walk-in places. Their ids are keyed by
    // day and person (each person comes at most once a day) and their queue places come from a
    // forked stream, so planning a story visit shifts neither the walk-ins' ids (which label their
    // pawn and look draws, and later their loans' redemption draws), nor another story visitor's
    // ids, nor the game Rng.
    const storyId = (prefix: string, who: string) => `${prefix}s${s.calendar.day.toString(36)}_${who}`
    const story = planStory(s, storyId)
    // M5: the fence's call or drop-in, once you've met him (on top of the walk-ins; own streams and ids).
    const fence = planFence(s, storyId, story.visits.some((v) => isFence(v.visit.customer)))
    if (fence.visit) story.visits.push({ visit: fence.visit, first: false })
    // M4 specialist warnings: while one runs, some walk-in sellers bring that piece (own streams; no boost, no change).
    // M6 the Flood: fewer walk-ins while the street is under water, many of them flooded out (own streams).
    const walkInCount = floodWalkIns(s, tuning.day.customersPerDay - story.sellerPlaces)
    const sellers = floodSellers(s, boostSellers(s, generateDayQueue(rng, walkInCount, ids.next)))
    const buyers = planBuyers(s, rng, ids.next)
    const redeemers = pledgeRedeemLines(s, planRedemptions(s, ids.next))
    // M4: the buyer a specialist sends once a month (Faina), and beats that land in the morning paper.
    const referred = referralBuyers(s, ids.next)
    s = playPaperBeats(referred.state, story.paper)
    buyers.push(...referred.visits)
    // M5 police: a raid ordered last night happens now, or Volkova comes in (ids by day and role, the
    // story stream's draws); bulletin pieces walk in with a flagged regular or a walk-in of their own.
    // Her own arc's beat (her, or someone she sends) brings her in today: her police visit waits (ids by day and person).
    const police = planPolice(s, storyId, story.visits.some((v) => v.visit.visitId === storyId('v', VOLKOVA.id)))
    const brought = bringBulletin(police.state, story.visits.map((v) => v.visit), storyId)
    s = brought.state
    const storyVisits = story.visits.map((v, i) => ({ ...v, visit: brought.story[i]! }))
    const market = s.market
    const later = storyVisits.filter((v) => !v.first).map((v) => v.visit)
    const first = storyVisits.filter((v) => v.first).map((v) => v.visit)
    later.push(...brought.extra)
    if (police.visit && police.first) first.unshift(police.visit)
    else if (police.visit) later.push(police.visit)
    // Neighbourhood standing stretches (or shortens) how long people wait. No draws.
    const patience = patienceRepFactor(s)
    const walkIns = mergeQueue(sellers, [...buyers, ...redeemers], rng)
    const queue = [...first, ...mergeQueue(walkIns, later, storyRng(s, 'queue'))].map((v) =>
      patience === 1 ? v : { ...v, patience: Math.round(v.patience * patience) },
    )
    return {
      ...s,
      meta: { ...s.meta, nextId: ids.nextId() },
      crime: { ...s.crime, fence: fence.fence },
      customers: story.customers,
      queue,
      current: null,
      inspect: null,
      haggle: null,
      day: { ...s.day, total: queue.length, newsRead: market.news.length === 0, nextArrival: lullRng(s, 'open').range(...tuning.day.firstArrivalSeconds) },
      narration: `${crimeNight.morning ? `${crimeNight.morning} ` : ''}${floodMorning ? `${floodMorning} ` : ''}The shop is open. ${queue.length} people are waiting outside.`,
    }
  })
}

function closeDay(state0: GameState): GameState {
  if (state0.day.phase !== 'open' || state0.current || state0.queue.length > 0) return state0
  // M6: the appraiser finishes the seller in front of him; the ledger names his mistakes.
  const theft = rollShoplifting(finishShift(state0))
  // M5 police: heat fades, old police events go, maybe a raid tomorrow; old bulletin lines come off.
  // M5: rent night after the bills: the landlord's notice, or eviction (src/game/endings/eviction.ts).
  const eviction = checkEviction(pruneBulletin(rollRaid(heatNight(syncSpecialistsRep(chargeWages(chargeExpenses(theft.state)))))))
  const state = eviction.state
  const log = state.day.log
  const sum = (kind: LedgerEntry['kind']) => log.filter((e) => e.kind === kind).reduce((a, e) => a + e.amount, 0)
  const summary: DaySummary = {
    day: state.calendar.day,
    openingCash: state.day.openingCash,
    closingCash: state.cash,
    bought: log.filter((e) => e.kind === 'buy').length,
    spent: -sum('buy') || 0,
    sold: log.filter((e) => e.kind === 'sell').length,
    earned: sum('sell'),
    walkouts: log.filter((e) => e.kind === 'walkout').length,
    expenses: -sum('expense') || 0,
    loaned: -sum('loan') || 0,
    redeemed: sum('redeem'),
    stolen: theft.stolen.length,
  }
  const history = [...state.history, summary].slice(-tuning.save.historyDays)
  const date = addDays(state.calendar.date, 1)
  const closed: GameState = {
    ...state,
    history,
    calendar: { day: state.calendar.day + 1, date, weekday: weekdayOf(date), season: seasonOf(date) },
    day: { ...state.day, phase: 'closed' },
    narration: theft.stolen.length > 0 ? `Closed for the night. ${log.find((e) => e.kind === 'theft')?.text ?? ''}`.trim() : 'Closed for the night. Rain on the canal.',
  }
  return eviction.evicted ? endCareer(closed, 'evicted') : closed
}

// --- counter ------------------------------------------------------------------

/**
 * A side stream for the lulls between visitors, forked from the game Rng
 * without advancing it, so pacing never shifts what customers bring or say.
 */
function lullRng(state: GameState, label: string): Rng {
  return Rng.from(state.meta.rng).fork(`lull:${state.calendar.day}:${label}`)
}

/**
 * Time passing with nobody at the counter: the clock runs, but nobody is
 * standing in line (the queue's patience doesn't drain), and the next person
 * walks in once the lull is over. Nothing happens before the paper is read.
 */
function lullTick(state0: GameState, seconds: number): GameState {
  if (!state0.day.newsRead) return state0
  // M6: the appraiser works through the lull too (and runs the clock while he finishes the last seller).
  const state = staffWork(state0, seconds)
  if (state.queue.length === 0) return state.staff.busy || state !== state0 ? { ...state, day: { ...state.day, clock: state.day.clock + seconds } } : state
  const clock = state.day.clock + seconds
  const next: GameState = { ...state, day: { ...state.day, clock } }
  return clock >= (state.day.nextArrival ?? 0) ? nextCustomer(next) : next
}

function nextCustomer(state: GameState): GameState {
  if (state.day.phase !== 'open' || state.current || state.queue.length === 0) return state
  const [visit, ...rest] = state.queue
  if (!visit) return state
  // M5: Volkova's visits build their scene as she walks in (and what happens on arrival applies).
  const police = visit.kind === 'scene' && isPoliceVisit(visit) ? policeScene(state, visit.visitId) : null
  const scene = sceneFor(visit) ?? police?.scene
  const common = {
    visitId: visit.visitId,
    wants: visit.wants,
    loanId: visit.loanId,
    sale: null,
    customer: visit.customer,
    elapsed: 0,
    phase: scene ? ('scene' as const) : ('present' as const),
    ...(visit.beatId ? { beatId: visit.beatId } : {}),
    ...(scene ? { scene } : {}),
    ...(visit.via ? { via: visit.via } : {}),
  }
  const current: VisitState =
    visit.kind === 'scene'
      ? { ...common, kind: 'scene', line: scene?.lines[0] ?? visit.line ?? '' }
      : { ...common, kind: visit.kind, item: visit.item, line: scene?.lines[0] ?? visit.line ?? visit.item.story }
  const base: GameState = {
    ...(police?.state ?? state),
    queue: rest,
    current,
    inspect: visit.kind === 'seller' ? { findings: [], toolUses: {}, estimate: null } : null,
    haggle: null,
    stats: { ...state.stats, customersSeen: state.stats.customersSeen + 1 },
  }
  // M5 police: the pledge they came for was seized (a raid, or handed to Volkova) after they set out.
  if (visit.kind === 'redeem' && !base.loans.some((l) => l.id === visit.loanId)) {
    const line = storyRng(base, `police:pledge:${visit.visitId}`).pick(volkovaLines.pledgeSeized).replaceAll('{item}', getItemDef(visit.item.defId).name)
    return repAfterWalkout({ ...base, current: { ...base.current!, phase: 'resolved', outcome: 'left', line } as VisitState }, visit.customer)
  }
  if (visit.kind !== 'buyer') return base
  if (visit.offer !== undefined) return offerCall(base, visit.offer)
  // Buyer: the item must still be on display with a tag.
  return withRng(base, (s, rng) => {
    const c = itemVisit(s)!
    const live = s.inventory.find((i) => i.id === visit.item.id)
    const onDisplay = s.shop.slots.some((sl) => sl.itemId === visit.item.id)
    const tag = s.shop.prices[visit.item.id]
    if (!live || !onDisplay || tag === undefined || tag <= 0) {
      return { ...s, current: { ...c, phase: 'resolved', outcome: 'left', line: rng.pick(visitLines.buyerGone) } }
    }
    const sale = startSale(s, live, tag, c.customer, rng)
    return { ...s, current: { ...c, item: live, sale } }
  })
}

/**
 * M4: a specialist's take-it-or-leave-it phone offer for a piece in stock (Gennady's first refusal).
 * One round: their offer is their ceiling. Gone from stock (sold, stolen): they ring off.
 */
function offerCall(state: GameState, offer: number): GameState {
  const c = itemVisit(state)!
  const live = state.inventory.find((i) => i.id === c.item.id)
  if (!live) return { ...state, current: { ...c, phase: 'resolved', outcome: 'left', line: isFence(c.customer) ? FENCE_LINES.gone : 'Sold it already? Never mind. Next time.' } }
  const tag = Math.max(offer, state.shop.prices[live.id] ?? 0)
  return { ...state, current: { ...c, item: live, sale: { itemId: live.id, tag, offer, ceiling: offer, round: 0, maxRounds: 1, status: 'open', history: [] } } }
}

function applyTool(state: GameState, tool: ToolId, hotspot?: string): GameState {
  const c = itemVisit(state)
  const insp = state.inspect
  if (!c || !insp || c.phase !== 'inspect') return state
  const def = getItemDef(c.item.defId)
  const paidFor = payForTool(state, tool, def)
  if (!paidFor) return state
  return withRng(paidFor, (s0, rng) => {
    const uses = insp.toolUses[tool] ?? 0
    const extras = toolExtras(s0, def)
    // M5: the passport book is an inspect step about the seller, not the item (crime/ledger.ts). The
    // seller's reaction is theirs, drawn from a stream keyed by the piece, so asking never shifts the game Rng.
    const result =
      tool === 'passport'
        ? passportCheck({ item: c.item, customer: c.customer, previous: insp.findings, rng: new Rng(s0.meta.seed).fork(`police:passport:${c.item.id}`) })
        : useTool({ item: c.item, def, tool, hotspot, previous: insp.findings, uses, rng, extras })
    const revealed = new Set(c.item.revealed)
    for (const f of result.findings) if (f.tellId) revealed.add(f.tellId)
    // M4 specialist arcs: count what the call turned out to be.
    const called = tool === 'specialist' ? result.findings.find((f) => f.tellId === SPECIALIST_TELL && f.verdict)?.verdict : undefined
    const s = called && extras.specialist ? noteCall(s0, extras.specialist.id, c.item, called) : s0
    const next: GameState = {
      ...s,
      current: { ...c, item: { ...c.item, revealed: [...revealed] } },
      inspect: {
        ...insp,
        findings: [...insp.findings, ...result.findings],
        toolUses: { ...insp.toolUses, [tool]: uses + 1 },
      },
    }
    return advanceTime(next, result.seconds)
  })
}

function makeOffer(state: GameState, amount: number, approach: Approach, evidenceId?: string): GameState {
  const c = itemVisit(state)
  const ctx = haggleContext(state)
  if (!c || !ctx || c.phase !== 'offer') return state
  const offer = Math.round(amount)
  if (offer <= 0 || offer > state.cash) return state
  if (state.haggle && state.haggle.status !== 'open') return state
  return withRng(state, (s, rng) => {
    const h0 = s.haggle ?? (isFence(c.customer) ? fenceHaggle(s, c.item) : startHaggle(ctx, rng))
    const { state: h, response } = haggleRound(h0, { offer, approach, evidenceId }, ctx, rng)
    const lineKey = c.wants === 'pawn' && response.kind === 'accept' ? `pawn.${response.lineKey}` : response.lineKey
    const line = pickLine(lineKey, rng, { price: rub(response.price), name: c.customer.name })
    let next: GameState = { ...s, haggle: h, current: { ...c, line } }
    // The neighbourhood doesn't hear how you spoke to the fence.
    if (response.mood === 'insulted' && !isFence(c.customer)) next = repAfterInsult(next, c.customer)
    next = advanceTime(next, tuning.day.haggleRoundSeconds)
    if (!next.current) return next // they gave up during the round (cannot happen at the counter, but stay safe)
    if (response.kind === 'accept') return c.wants === 'pawn' ? pawn(next, response.price, line) : buy(next, response.price, line)
    if (response.kind === 'walk') {
      return resolve(next, 'walked', line, {
        kind: 'pass',
        amount: 0,
        text: `${c.customer.name} walked out with the ${getItemDef(c.item.defId).name}`,
        defId: c.item.defId,
      })
    }
    return next
  })
}

function buy(state: GameState, price: number, line?: string): GameState {
  const c = itemVisit(state)
  if (!c) return state
  const def = getItemDef(c.item.defId)
  const fake = c.item.authenticity !== 'genuine'
  const next: GameState = {
    ...state,
    cash: state.cash - price,
    inventory: [...state.inventory, c.item],
    paid: { ...state.paid, [c.item.id]: price },
    stats: {
      ...state.stats,
      itemsBought: state.stats.itemsBought + 1,
      totalSpent: state.stats.totalSpent + price,
      fakesBought: state.stats.fakesBought + (fake ? 1 : 0),
    },
  }
  // M4 specialist arcs: a missed call, a lowball, or Gennady's first refusal on what you just bought.
  const judged = heatAfterDeal(axesAfterDeal(repAfterDeal(next, c.customer, c.item, price, 'buy'), c.customer, c.item, price, 'buy'), c.customer, c.item)
  return resolve(noteBought(judged, c.item), 'bought', line ?? visitLines.thanks[0], {
    kind: 'buy',
    amount: -price,
    text: `Bought ${def.name} from ${c.customer.name}`,
    itemId: c.item.id,
    defId: def.id,
  }, price)
}

/** Accept a pawn: lend `principal`, hold the item until it is redeemed or forfeited. */
function pawn(state: GameState, principal: number, line?: string): GameState {
  const c = itemVisit(state)
  if (!c) return state
  const def = getItemDef(c.item.defId)
  return withRng(state, (s, rng) => {
    const ids = idAllocator(s)
    const loan = createLoan({ id: ids.next('l'), item: c.item, customer: c.customer, principal, day: s.calendar.day, rng })
    const next: GameState = {
      ...s,
      meta: { ...s.meta, nextId: ids.nextId() },
      cash: s.cash - principal,
      loans: [...s.loans, loan],
    }
    const judged = heatAfterDeal(axesAfterDeal(repAfterDeal(next, c.customer, c.item, principal, 'pawn'), c.customer, c.item, principal, 'pawn'), c.customer, c.item)
    return resolve(judged, 'pawned', line ?? pickLine('pawn.thanks', rng, { name: c.customer.name, item: def.name }), {
      kind: 'loan',
      amount: -principal,
      text: `Lent ${rub(principal)} on ${def.name} to ${c.customer.name}`,
      itemId: c.item.id,
      defId: def.id,
    }, principal)
  })
}

function redeemLoan(state: GameState): GameState {
  const c = state.current
  if (!c || c.kind !== 'redeem' || c.phase !== 'present') return state
  const loan = state.loans.find((l) => l.id === c.loanId)
  if (!loan) return state
  const due = amountDue(loan, state.calendar.day)
  const def = getItemDef(loan.item.defId)
  return withRng(state, (s, rng) =>
    resolve(
      repAfterRedeem({ ...s, cash: s.cash + due, loans: s.loans.filter((l) => l.id !== loan.id) }),
      'redeemed',
      pickLine('redeem.thanks', rng, { name: c.customer.name, item: def.name, price: rub(due) }),
      { kind: 'redeem', amount: due, text: `${c.customer.name} redeemed the ${def.name}`, itemId: loan.item.id, defId: def.id },
      due,
    ),
  )
}

function counterSale(state: GameState, amount: number): GameState {
  const c = state.current
  if (!c || c.kind !== 'buyer' || c.phase !== 'present' || !c.sale || c.sale.status !== 'open') return state
  const counter = Math.round(amount)
  if (counter <= 0) return state
  return withRng(state, (s, rng) => {
    const { sale, response } = saleRound(c.sale!, counter, c.customer, rng)
    const def = getItemDef(c.item.defId)
    const line = pickLine(response.lineKey, rng, { price: rub(response.price), name: c.customer.name, item: def.name })
    let next: GameState = { ...s, current: { ...s.current!, sale, line } }
    next = advanceTime(next, tuning.day.haggleRoundSeconds)
    if (response.kind === 'accept') return sellToBuyer(next, response.price, line)
    if (response.kind === 'walk') {
      return resolve(next, 'walked', line, { kind: 'pass', amount: 0, text: `${c.customer.name} didn’t buy the ${def.name}`, defId: def.id })
    }
    return next
  })
}

function sellToBuyer(state: GameState, price: number, line?: string): GameState {
  const c = itemVisit(state)
  if (!c || !c.sale) return state
  const def = getItemDef(c.item.defId)
  const next = removeSold(state, c.item.id, price)
  return withRng(next, (s, rng) =>
    resolve(
      repAfterSale({ ...s, current: { ...s.current!, sale: { ...c.sale!, status: 'sold' } } }, c.customer),
      'sold',
      line ?? pickLine('sale.thanks.flexible', rng, { name: c.customer.name, item: def.name }),
      { kind: 'sell', amount: price, text: `Sold the ${def.name} to ${c.customer.name}`, itemId: c.item.id, defId: def.id },
      price,
    ),
  )
}

function resolve(state: GameState, outcome: VisitOutcome, line: string, entry: LedgerEntry | null, price?: number): GameState {
  const c = state.current
  if (!c) return state
  const next: GameState = { ...state, current: { ...c, phase: 'resolved', outcome, line, price } }
  // Regulars remember; story beats record how they went (and may change the line).
  return afterVisit(entry ? log(next, entry) : next)
}

/** "Go on" in a story scene: the next line; at the end, the item (or the visit ends). */
function endOrStepScene(state: GameState): GameState {
  const step = sceneNext(state)
  if (!step) return state
  if (step.kind === 'line') return step.state
  const s = step.state
  const c = s.current!
  if (step.outcome) return resolve(s, step.outcome, c.line, null)
  if (c.kind === 'scene') return s
  return { ...s, current: { ...c, phase: 'present', line: sceneItemLine(c) } }
}

/** The line once the scene is done and the item is on the mat. */
function sceneItemLine(c: ItemVisit): string {
  const beat = c.beatId ? getBeat(c.beatId) : undefined
  return beat?.visit.line ?? c.item.story
}

/** Advance in-game time while a customer is at the counter; waiting customers lose patience. */
function advanceTime(state0: GameState, seconds: number): GameState {
  if (seconds <= 0) return state0
  // M6: the appraiser at the second counter works while time passes (he may take someone off the line).
  const state = staffWork(state0, seconds)
  const stay: typeof state.queue = []
  const gone: typeof state.queue = []
  for (const v of state.queue) {
    const patience = v.patience - seconds
    if (patience <= 0) gone.push(v)
    else stay.push({ ...v, patience })
  }
  let next: GameState = {
    ...state,
    queue: stay,
    current: state.current ? { ...state.current, elapsed: state.current.elapsed + seconds } : null,
    day: { ...state.day, clock: state.day.clock + seconds, served: state.day.served + gone.length },
  }
  for (const v of gone) {
    next = log(next, {
      kind: 'walkout',
      amount: 0,
      text: `${v.customer.name} got tired of waiting and left`,
      ...(v.item ? { defId: v.item.defId } : {}),
    })
    next = { ...next, reputation: { ...next.reputation, general: next.reputation.general - tuning.day.walkoutRepPenalty } }
    // Group reputation follows shop business only: a regular who came to talk (scene) doesn't move it.
    if (v.kind !== 'scene') next = repAfterWalkout(next, v.customer)
  }
  return next
}

// --- ledger -------------------------------------------------------------------

function sellToDealer(state: GameState, itemId: string): GameState {
  if (state.day.phase !== 'closed') return state
  const item = state.inventory.find((i) => i.id === itemId)
  if (!item) return state
  return withRng(state, (s, rng) => {
    // Pays the quote the ledger showed (dealerQuote peeks this same draw).
    const price = dealerPrice(item, rng)
    const history = s.history.slice()
    const last = history[history.length - 1]
    if (last) history[history.length - 1] = { ...last, sold: last.sold + 1, earned: last.earned + price, closingCash: s.cash + price }
    return log(
      { ...removeSold(s, itemId, price), history },
      { kind: 'sell', amount: price, text: `Sold ${getItemDef(item.defId).name} to the dealer`, itemId, defId: item.defId },
    )
  })
}
