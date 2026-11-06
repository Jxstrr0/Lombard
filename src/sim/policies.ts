/**
 * Scripted players for the simulator. A policy looks at the state and returns
 * the next action (or null when the day is over). It may keep private notes in
 * its context (e.g. what it thinks each item is worth).
 *
 * The policies "know" a customer's claimed value the way a player reads the
 * customer and the reference book; they never peek at trueValue or authenticity.
 */
import { getItemDef } from '../data/items'
import type { Action } from '../game/actions'
import { claimedValue } from '../game/appraise/value'
import { BRICK, caseBroken } from '../game/crime/vandalism'
import { fenceAsk, isFence } from '../game/crime/fence'
import { upcomingBills } from '../game/economy/expenses'
import { matchesBulletin } from '../game/crime/bulletin'
import { NO_PASSPORT_TELL, passportAsked } from '../game/crime/ledger'
import { availableTools } from '../game/inspect/available'
import type { ToolId } from '../game/schema/item'
import { upgradeStatus } from '../game/economy/upgrades'
import { hireStatus, SECOND_COUNTER } from '../game/staff/appraiser'
import type { GameState, StaffMode } from '../game/state'
import { tuning } from '../data/tuning'
import type { Finding, ItemVisit } from '../game/types'

export interface PolicyContext {
  /** Policy's own value estimate per item id it bought or holds. */
  estimate: Record<string, number>
  /** Day each item was acquired. */
  acquired: Record<string, number>
  /** Haggle rounds so far on the current visit. */
  rounds: number
  /** M5 (heedsThreats): what it took out of the counter case before a brick, to put back after the glazier. */
  evacuated?: string[]
}

export interface Policy {
  name: string
  start(state: GameState): PolicyContext
  next(state: GameState, ctx: PolicyContext): Action | null
  /** The last action had no effect: return a way out, or null to fail loudly. */
  stuck(state: GameState, action: Action): Action | null
  after?(state: GameState, action: Action, ctx: PolicyContext): void
}

export interface PolicyParams {
  name: string
  /** Tools to use, in order, on every seller's item (skipped if unusable). */
  tools: ToolId[]
  /** Walk away when a finding says the item may not be genuine. */
  passOnRedFlags: boolean
  /** First offer and the most it will offer, as shares of its estimate. */
  openAt: number
  maxAt: number
  /** Raise per round, as a share of the estimate. */
  step: number
  /** Accept the seller's ask outright when it is at or under this share of the estimate (0 = never). */
  acceptAskAt: number
  /** Loan amounts as a share of its estimate. */
  loanOpenAt: number
  loanMaxAt: number
  /** Tag price as a multiple of its estimate. */
  markup: number
  /** Accept a buyer's offer at or over this share of the tag; otherwise counter once at `holdAt` × tag. */
  takeOfferAt: number
  holdAt: number
  /** Sell to the dealer after holding an item this many days (Infinity = never). */
  dumpAfterDays: number
  /** How far the estimate is off the claimed value (0 = takes the claim at face value). */
  skepticism: number
  /** Keep cash for bills due within this many days (0 = spend everything). */
  reserveDays: number
  /** Story choices (by id) to take when a scene offers one of them; otherwise the first choice. */
  prefer?: readonly string[]
  /** M5: ask every seller for a passport first (the passport book, crime/ledger.ts). */
  passport?: boolean
  /** M5: walk away when the passport answer is a worry (no passport, a long search, the wrong name). */
  passOnShadySellers?: boolean | 'refusals'
  /** M5: walk away from anything the stolen-goods bulletin has listed lately (it reads the paper). */
  readsBulletin?: boolean
  /**
   * M5: takes "lock up carefully tonight" seriously: with a brick coming, the counter case goes
   * into the safe at closing, and nothing goes back in it until the glazier has been.
   */
  heedsThreats?: boolean
  /**
   * M5 the fence's calls and drop-ins: refuse every one, or deal (pay his price for what he brings
   * unless a check says it's not genuine, take his offer for your problem pieces). Unset: treat him
   * like anyone else at the counter.
   */
  fence?: 'refuse' | 'deal'
  /**
   * M6: buys the second counter once it's offered and the till can spare it (its cost and a month of
   * wages over the bills reserve), then hires the appraiser with this rule.
   */
  hire?: { mode: StaffMode; categories?: string[] }
}

/** M5: a brick is due tonight, or the case has no glass yet. */
function caseUnsafe(state: GameState): boolean {
  return state.crime.events.some((e) => e.kind === BRICK) || caseBroken(state)
}

/** Cash the policy is willing to spend right now. */
function spendable(state: GameState, p: PolicyParams): number {
  if (p.reserveDays <= 0) return state.cash
  const due = upcomingBills(state).filter((b) => b.inDays <= p.reserveDays).reduce((a, b) => a + b.amount, 0)
  return state.cash - due
}

const isRedFlag = (f: Finding) => f.polarity === 'negative' && f.reveals === 'authenticity'
const isShady = (f: Finding) => f.polarity === 'negative' && f.reveals === 'provenance'

export function makePolicy(p: PolicyParams): Policy {
  return {
    name: p.name,
    start: () => ({ estimate: {}, acquired: {}, rounds: 0 }),
    stuck(state, action) {
      const c = state.current
      if (action.type === 'inspect/useTool') return { type: 'inspect/done' }
      if (c && c.phase !== 'resolved' && c.kind !== 'redeem') return { type: 'counter/pass' }
      if (c && c.phase === 'resolved') return { type: 'counter/dismiss' }
      if (action.type === 'ledger/sell' || action.type === 'shop/place' || action.type === 'shop/price') return { type: 'day/open' }
      return null
    },
    after(state, action, ctx) {
      if (action.type === 'counter/next' || action.type === 'counter/dismiss') ctx.rounds = 0
      // Remember what we paid attention to when an item lands in inventory.
      for (const it of state.inventory) {
        if (ctx.acquired[it.id] === undefined) ctx.acquired[it.id] = state.calendar.day
        if (ctx.estimate[it.id] === undefined) ctx.estimate[it.id] = estimateOf(state, it.id, p)
      }
    },
    next(state, ctx) {
      if (state.meta.intro) return { type: 'career/begin', shopName: '' }
      if (state.day.phase === 'closed') return closedStep(state, ctx, p)
      if (!state.day.newsRead) return { type: 'news/dismiss' }
      const c = state.current
      if (!c) {
        const arrange = arrangeStep(state, ctx, p)
        if (arrange) return arrange
        return state.queue.length > 0 ? { type: 'counter/next' } : { type: 'day/close' }
      }
      if (c.phase === 'resolved') return { type: 'counter/dismiss' }
      // Story scenes: read on, and take a preferred choice or else the first one (the sim judges prices, not people).
      if (c.phase === 'scene') {
        const sc = c.scene
        if (sc && !sc.chosen && sc.step >= sc.lines.length - 1 && sc.choices.length > 0) {
          const pick = sc.choices.find((x) => p.prefer?.includes(x.id)) ?? sc.choices[0]!
          return { type: 'scene/choose', choiceId: pick.id }
        }
        return { type: 'scene/next' }
      }
      if (c.kind === 'scene') return { type: 'scene/next' }
      if (c.kind === 'redeem') return { type: 'loan/return' }
      if (p.fence && isFence(c.customer)) {
        if (p.fence === 'refuse') return { type: 'counter/pass' }
        if (c.kind === 'buyer') return { type: 'sale/accept' }
        if (c.phase === 'offer') {
          const ask = fenceAsk(state, c.item)
          const red = p.passOnRedFlags && (state.inspect?.findings ?? []).some(isRedFlag)
          return red || ask > spendable(state, p) ? { type: 'counter/pass' } : { type: 'offer/make', amount: ask, approach: 'straight' }
        }
      }
      if (c.kind === 'buyer') {
        const sale = c.sale
        if (!sale || sale.status !== 'open') return { type: 'counter/pass' }
        if (sale.offer >= sale.tag * p.takeOfferAt || ctx.rounds >= 1) return { type: 'sale/accept' }
        ctx.rounds++
        return { type: 'sale/counter', amount: Math.max(sale.offer, Math.round(sale.tag * p.holdAt)) }
      }
      // seller
      // A player remembers the last week's bulletin (the pieces turn up within days) and checks the wear it printed.
      if (c.phase === 'present') return p.readsBulletin && matchesBulletin(state, c.item, 7) ? { type: 'counter/pass' } : { type: 'counter/inspect' }
      if (c.phase === 'inspect') {
        const asked = state.inspect?.findings ?? []
        if (p.passport && !passportAsked(asked)) return { type: 'inspect/useTool', tool: 'passport' }
        if (p.passOnShadySellers === 'refusals' && asked.some((f) => f.tellId === NO_PASSPORT_TELL)) return { type: 'counter/pass' }
        // Walk the tool plan in order, skipping tools that are locked for this item.
        const usable = new Set(availableTools(state, getItemDef(c.item.defId)).filter((t) => t.usable).map((t) => t.tool))
        const plan = p.tools.filter((t) => usable.has(t))
        const uses = Object.entries(state.inspect?.toolUses ?? {}).reduce((a, [t, n]) => a + (t === 'passport' ? 0 : (n ?? 0)), 0)
        const tool = plan[uses]
        return tool ? { type: 'inspect/useTool', tool } : { type: 'inspect/done' }
      }
      // offer phase
      const findings = state.inspect?.findings ?? []
      if (p.passOnRedFlags && findings.some(isRedFlag)) return { type: 'counter/pass' }
      if (p.passOnShadySellers === true && findings.some(isShady)) return { type: 'counter/pass' }
      const est = sellerEstimate(state, p)
      const pawn = c.wants === 'pawn'
      const open = pawn ? p.loanOpenAt : p.openAt
      const max = pawn ? p.loanMaxAt : p.maxAt
      const h = state.haggle
      const budget = spendable(state, p)
      if (h && h.status === 'open' && p.acceptAskAt > 0 && h.ask <= est * p.acceptAskAt && h.ask <= budget) return { type: 'offer/acceptAsk' }
      const offer = Math.round(est * (open + p.step * ctx.rounds))
      if (offer > est * max || offer > budget || offer <= 0) return { type: 'counter/pass' }
      ctx.rounds++
      const evidence = findings.find((f) => f.polarity === 'negative' && f.reveals !== 'provenance')
      return { type: 'offer/make', amount: offer, approach: evidence && ctx.rounds === 1 ? 'evidence' : 'straight', evidenceId: evidence?.id }
    },
  }
}

function sellerEstimate(state: GameState, p: PolicyParams): number {
  const c = state.current as ItemVisit
  return Math.round(claimedValue(getItemDef(c.item.defId), c.item) * (1 - p.skepticism))
}

function estimateOf(state: GameState, itemId: string, p: PolicyParams): number {
  const it = state.inventory.find((i) => i.id === itemId)!
  return Math.round(claimedValue(getItemDef(it.defId), it) * (1 - p.skepticism))
}

/** Put stock on display and tag it (between customers and while closed). */
function arrangeStep(state: GameState, ctx: PolicyContext, p: PolicyParams): Action | null {
  const avoidCase = p.heedsThreats === true && caseUnsafe(state)
  if (avoidCase) {
    const inCase = state.shop.slots.find((s) => s.area === 'counter' && s.itemId)
    if (inCase) {
      ctx.evacuated = [...(ctx.evacuated ?? []), inCase.itemId!]
      return { type: 'shop/place', itemId: inCase.itemId!, slotId: null }
    }
  } else if (ctx.evacuated?.length) {
    // New glass: what came out goes back in, while there's room.
    const free = state.shop.slots.find((s) => s.area === 'counter' && s.itemId === null)
    const back = ctx.evacuated.find((id) => state.inventory.some((i) => i.id === id))
    if (!free || !back) ctx.evacuated = []
    else {
      ctx.evacuated = ctx.evacuated.filter((id) => id !== back)
      return { type: 'shop/place', itemId: back, slotId: free.id }
    }
  }
  const placed = new Set(state.shop.slots.filter((s) => s.itemId).map((s) => s.itemId!))
  for (const it of state.inventory) {
    const est = ctx.estimate[it.id] ?? estimateOf(state, it.id, p)
    if (state.shop.prices[it.id] === undefined) return { type: 'shop/price', itemId: it.id, price: Math.round(est * p.markup) }
    if (!placed.has(it.id)) {
      // Best slots for the most valuable stock: counter, then wall, then back.
      const free = state.shop.slots.find((s) => s.itemId === null && !(avoidCase && s.area === 'counter'))
      if (free) return { type: 'shop/place', itemId: it.id, slotId: free.id }
    }
  }
  return null
}

function closedStep(state: GameState, ctx: PolicyContext, p: PolicyParams): Action | null {
  const arrange = arrangeStep(state, ctx, p)
  if (arrange) return arrange
  // Dump old stock on the dealer.
  for (const it of state.inventory) {
    const since = ctx.acquired[it.id] ?? state.calendar.day
    if (state.calendar.day - since >= p.dumpAfterDays) {
      delete ctx.acquired[it.id]
      return { type: 'ledger/sell', itemId: it.id }
    }
  }
  const hire = hireStep(state, p)
  if (hire) return hire
  return { type: 'day/open' }
}

function hireStep(state: GameState, p: PolicyParams): Action | null {
  if (!p.hire) return null
  const status = hireStatus(state)
  if (status === 'noCounter') {
    const cost = tuning.upgrades.cost.second_counter
    if (upgradeStatus(state, SECOND_COUNTER) === 'available' && spendable(state, p) >= cost + tuning.appraiser.salary) return { type: 'upgrade/buy', id: SECOND_COUNTER }
    return null
  }
  if (status === 'available') return { type: 'staff/hire' }
  const want = p.hire
  if (status === 'hired' && (state.staff.mode !== want.mode || (want.categories && want.categories.join() !== state.staff.categories.join()))) {
    return { type: 'staff/rule', mode: want.mode, ...(want.categories ? { categories: [...want.categories].sort() } : {}) }
  }
  return null
}
/**
 * M6 the Flood (src/data/stories/flood.ts). A sensible decent shop: sandbags at the door, lends the
 * pump, stores Nina's things for nothing, turns Misha's loan down politely, and refunds the pump if
 * it ever gouged. The hero lends Misha the money as well; the vulture gouges, charges and says no.
 */
const FLOOD_GOOD = ['flood_sandbags', 'pump_lend', 'store_free', 'credit_no', 'gouge_refund']
const FLOOD_HERO = ['flood_sandbags', 'pump_lend', 'store_free', 'credit_lend', 'gouge_refund']
const FLOOD_VULTURE = ['flood_sandbags', 'pump_gouge', 'store_charge', 'credit_no', 'gouge_shrug']

const CAREFUL: PolicyParams = {
  name: 'careful',
  tools: ['scale', 'loupe', 'magnet', 'loupe', 'acid', 'reference'],
  passOnRedFlags: true,
  openAt: 0.4,
  maxAt: 0.6,
  step: 0.05,
  acceptAskAt: 0.55,
  loanOpenAt: 0.3,
  loanMaxAt: 0.45,
  markup: 1.05,
  takeOfferAt: 0.9,
  holdAt: 0.97,
  dumpAfterDays: 21,
  skepticism: 0.1,
  reserveDays: 10,
  // Runs a clean shop: turns down the crew's "insurance" and every rung after (Protection arc).
  // M5 makes refusing cost (the brick, the glazier); see docs/05 for the sim numbers.
  // M5: gives the Collector's icon back to its church, and stays out of Volkova's case against the crew
  // (informing is its own policy, below).
  prefer: ['refuse', 'cooperate', 'return', 'stay_out', ...FLOOD_GOOD],
  // And when Eduard Lvovich says "lock up carefully tonight", it empties the counter case.
  heedsThreats: true,
  // M5 police: keeps a passport book, reads the bulletin, and hands stolen pieces over when Volkova asks.
  passport: true,
  passOnShadySellers: 'refusals',
  readsBulletin: true,
  // A clean shop says no to the fence too (M5).
  fence: 'refuse',
}

export const careful = makePolicy(CAREFUL)

/**
 * M6: the careful shop with an appraiser at the second counter (the overflow), as soon as it can
 * afford him. It treats him well (welcomes him, asks him rather than Zhora, keeps him on) and pays
 * Yura's debt with the tin.
 */
export const appraiser = makePolicy({
  ...CAREFUL,
  name: 'appraiser',
  hire: { mode: 'next' },
  prefer: ['welcome', 'ask_lev', 'keep_on', 'tin_crew', 'pay_back', 'pay_some', ...(CAREFUL.prefer ?? [])],
})

/**
 * M6 the Flood: the careful shop, except that it lends Misha the money too (credit_lend, the one
 * hero choice that is a cash gamble): `npm run sim` only, to price being the neighbourhood's hero.
 */
export const neighbour = makePolicy({ ...CAREFUL, name: 'neighbour', prefer: ['refuse', 'cooperate', 'return', 'stay_out', ...FLOOD_HERO] })

/**
 * M5: the same careful trader, mob-friendly. Pays the crew whenever asked, keeps their box, and buys
 * their deliveries like any other good deal (the M5 "done when": a mob-friendly run plays differently).
 * The fence is a separate person: it still turns him down. It sells the Collector his icon.
 */
export const mobFriendly = makePolicy({ ...CAREFUL, name: 'mobFriendly', prefer: ['accept', 'pay', 'keep', 'sell', 'stay_out', 'source_no', ...FLOOD_GOOD] })

/**
 * M5 Volkova's arc: the careful refuser, except that when Volkova asks about Eduard Lvovich's crew it
 * tells her everything (volkova.inform): pressure jumps, and then the crew finds out or she gets them.
 */
export const informer = makePolicy({ ...CAREFUL, name: 'informer', prefer: ['refuse', 'cooperate', 'inform', ...FLOOD_GOOD] })

/**
 * M5 "done when": a fence-heavy run. The careful player, except that it keeps the fence's Tuesdays,
 * buys what he brings at his price (unless a check flags it) and sells him its problem pieces.
 * It sells the Collector his icon too.
 */
export const fenceFriend = makePolicy({ ...CAREFUL, name: 'fence', fence: 'deal', prefer: ['fence_yes', 'refuse', 'sell', 'stay_out', 'source_no', ...FLOOD_GOOD] })

export const careless = makePolicy({
  name: 'careless',
  // M6: ignores Kuzmich and his sandbags (and takes the first choice elsewhere).
  prefer: ['flood_ignore'],
  tools: ['loupe'],
  passOnRedFlags: false,
  openAt: 0.8,
  maxAt: 1.1,
  step: 0.1,
  acceptAskAt: 1.05,
  loanOpenAt: 0.7,
  loanMaxAt: 1.0,
  markup: 1.0,
  takeOfferAt: 0,
  holdAt: 1,
  dumpAfterDays: 3,
  skepticism: 0,
  reserveDays: 0,
})

/**
 * M5 endings calibration (not in the M2 bands, `npm run sim` only): checks like the careful shop
 * and keeps a rent reserve, but opens lower and stops sooner, pays the crew's "insurance" and
 * takes the harder story choices. Fewer fair deals and less love from the neighbourhood, and
 * thinner margins than you'd think (sellers walk), so some of these shops scrape by or lose the lease.
 */
export const trader = makePolicy({
  name: 'trader',
  tools: ['scale', 'loupe', 'magnet', 'loupe', 'acid', 'reference'],
  passOnRedFlags: true,
  openAt: 0.3,
  maxAt: 0.5,
  step: 0.05,
  acceptAskAt: 0.45,
  loanOpenAt: 0.2,
  loanMaxAt: 0.38,
  markup: 1.1,
  takeOfferAt: 0.92,
  holdAt: 1,
  dumpAfterDays: 21,
  skepticism: 0.1,
  reserveDays: 10,
  // Volkova's arc: keeps out of her case against the crew it pays, and isn't her source.
  prefer: ['accept', 'busy', 'refuse', 'market', 'wave', 'liar', 'keep', 'rules', 'stay_out', 'source_no', ...FLOOD_VULTURE],
})
