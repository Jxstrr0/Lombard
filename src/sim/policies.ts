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
import { upcomingBills } from '../game/economy/expenses'
import { availableTools } from '../game/inspect/available'
import type { ToolId } from '../game/schema/item'
import type { GameState } from '../game/state'
import type { Finding, ItemVisit } from '../game/types'

export interface PolicyContext {
  /** Policy's own value estimate per item id it bought or holds. */
  estimate: Record<string, number>
  /** Day each item was acquired. */
  acquired: Record<string, number>
  /** Haggle rounds so far on the current visit. */
  rounds: number
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
}

/** Cash the policy is willing to spend right now. */
function spendable(state: GameState, p: PolicyParams): number {
  if (p.reserveDays <= 0) return state.cash
  const due = upcomingBills(state).filter((b) => b.inDays <= p.reserveDays).reduce((a, b) => a + b.amount, 0)
  return state.cash - due
}

const isRedFlag = (f: Finding) => f.polarity === 'negative' && f.reveals === 'authenticity'

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
      if (c.kind === 'buyer') {
        const sale = c.sale
        if (!sale || sale.status !== 'open') return { type: 'counter/pass' }
        if (sale.offer >= sale.tag * p.takeOfferAt || ctx.rounds >= 1) return { type: 'sale/accept' }
        ctx.rounds++
        return { type: 'sale/counter', amount: Math.max(sale.offer, Math.round(sale.tag * p.holdAt)) }
      }
      // seller
      if (c.phase === 'present') return { type: 'counter/inspect' }
      if (c.phase === 'inspect') {
        // Walk the tool plan in order, skipping tools that are locked for this item.
        const usable = new Set(availableTools(state, getItemDef(c.item.defId)).filter((t) => t.usable).map((t) => t.tool))
        const plan = p.tools.filter((t) => usable.has(t))
        const uses = Object.values(state.inspect?.toolUses ?? {}).reduce((a, n) => a + (n ?? 0), 0)
        const tool = plan[uses]
        return tool ? { type: 'inspect/useTool', tool } : { type: 'inspect/done' }
      }
      // offer phase
      const findings = state.inspect?.findings ?? []
      if (p.passOnRedFlags && findings.some(isRedFlag)) return { type: 'counter/pass' }
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
      const evidence = findings.find((f) => f.polarity === 'negative')
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
  const placed = new Set(state.shop.slots.filter((s) => s.itemId).map((s) => s.itemId!))
  for (const it of state.inventory) {
    const est = ctx.estimate[it.id] ?? estimateOf(state, it.id, p)
    if (state.shop.prices[it.id] === undefined) return { type: 'shop/price', itemId: it.id, price: Math.round(est * p.markup) }
    if (!placed.has(it.id)) {
      // Best slots for the most valuable stock: counter, then wall, then back.
      const free = state.shop.slots.find((s) => s.itemId === null)
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
  return { type: 'day/open' }
}

export const careful = makePolicy({
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
  // Runs a clean shop: turns down the crew's "insurance" (Protection arc). Paying costs a careful
  // shop about 2 points of monthly growth (docs/05, Nov 6); the bands measure the trade, not that choice.
  prefer: ['refuse'],
})

export const careless = makePolicy({
  name: 'careless',
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
