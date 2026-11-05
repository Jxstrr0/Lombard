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
 *   → counter/dismiss → … → day/close (expenses, ledger) → ledger/sell… / shop/* / upgrade/* → day/open
 *
 * Between customers (and while closed) the player can arrange the display: shop/place, shop/price.
 */
import { getItemDef } from '../data/items'
import { pickLine, visitLines } from '../data/lines'
import { tuning } from '../data/tuning'
import { claimedValue, dealerPrice } from './appraise/value'
import { leftoverStock } from './career/start'
import { generateDayQueue } from './customers/walkins'
import { updateMarket } from './economy/demand'
import { chargeExpenses } from './economy/expenses'
import { releaseSpecialist, retainSpecialist } from './economy/specialists'
import { buyUpgrade, restockAcid } from './economy/upgrades'
import { haggleRound, startHaggle, type HaggleContext } from './haggle/machine'
import { payForTool, toolExtras } from './inspect/available'
import { useTool } from './inspect/tools'
import { amountDue, createLoan, forfeitOverdue, pawnClaim, planRedemptions } from './loans/loans'
import { Rng } from './rng'
import type { ToolId } from './schema/item'
import { planBuyers, saleRound, startSale } from './sell/buyer'
import { clearItem, placeItem, setPrice } from './shop/display'
import { addDays, createInitialState, seasonOf, weekdayOf, type GameState, type Settings } from './state'
import type { Approach, DaySummary, LedgerEntry, QueuedVisit, VisitOutcome } from './types'

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
])

const rub = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₽`

export function reducer(state: GameState, action: Action): GameState {
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
      const c = state.current
      if (!c || c.phase === 'resolved' || c.kind === 'redeem') return state
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
      return state.day.phase === 'closed' ? retainSpecialist(state, action.id) : state
    case 'specialist/release':
      return state.day.phase === 'closed' ? releaseSpecialist(state, action.id) : state
    case 'career/begin':
      return beginCareer(state, action.shopName)
    case 'counter/dismiss': {
      const c = state.current
      if (!c || c.phase !== 'resolved') return state
      const served = state.day.served + 1
      return {
        ...state,
        current: null,
        inspect: null,
        haggle: null,
        day: { ...state.day, served },
        narration: state.queue.length > 0 ? `${state.queue.length} waiting.` : 'That’s everyone for today. Time to close up.',
      }
    }
    case 'time/tick': {
      const c = state.current
      if (state.day.phase !== 'open' || !c || c.phase === 'resolved' || action.seconds <= 0) return state
      return advanceTime(state, action.seconds * tuning.day.realTimeScale)
    }
    case 'ledger/sell':
      return sellToDealer(state, action.itemId)
    case 'career/new':
      return { ...createInitialState(action.seed, action.careerId), settings: state.settings }
    case 'settings/set':
      return { ...state, settings: { ...state.settings, ...action.patch } }
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
  const claim = claimedValue(getItemDef(item.defId), item)
  return {
    customer: state.current.customer,
    item,
    claimedValue: state.current.wants === 'pawn' ? pawnClaim(claim, state.current.customer) : claim,
    findings: state.inspect.findings,
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
    s = forfeitOverdue(s)
    const market = updateMarket(s, rng)
    s = { ...s, market }
    const ids = idAllocator(s)
    const sellers = generateDayQueue(rng, tuning.day.customersPerDay, ids.next)
    const buyers = planBuyers(s, rng, ids.next)
    const redeemers = planRedemptions(s, ids.next)
    const queue = mergeQueue(sellers, [...buyers, ...redeemers], rng)
    return {
      ...s,
      meta: { ...s.meta, nextId: ids.nextId() },
      queue,
      current: null,
      inspect: null,
      haggle: null,
      day: { ...s.day, total: queue.length, newsRead: market.news.length === 0 },
      narration: `The shop is open. ${queue.length} people are waiting outside.`,
    }
  })
}

function closeDay(state0: GameState): GameState {
  if (state0.day.phase !== 'open' || state0.current || state0.queue.length > 0) return state0
  const state = chargeExpenses(state0)
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
  }
  const history = [...state.history, summary].slice(-tuning.save.historyDays)
  const date = addDays(state.calendar.date, 1)
  return {
    ...state,
    history,
    calendar: { day: state.calendar.day + 1, date, weekday: weekdayOf(date), season: seasonOf(date) },
    day: { ...state.day, phase: 'closed' },
    narration: 'Closed for the night. Rain on the canal.',
  }
}

// --- counter ------------------------------------------------------------------

function nextCustomer(state: GameState): GameState {
  if (state.day.phase !== 'open' || state.current || state.queue.length === 0) return state
  const [visit, ...rest] = state.queue
  if (!visit) return state
  const base: GameState = {
    ...state,
    queue: rest,
    current: {
      visitId: visit.visitId,
      kind: visit.kind,
      wants: visit.wants,
      loanId: visit.loanId,
      sale: null,
      customer: visit.customer,
      item: visit.item,
      phase: 'present',
      line: visit.line ?? visit.item.story,
      elapsed: 0,
    },
    inspect: visit.kind === 'seller' ? { findings: [], toolUses: {}, estimate: null } : null,
    haggle: null,
    stats: { ...state.stats, customersSeen: state.stats.customersSeen + 1 },
  }
  if (visit.kind !== 'buyer') return base
  // Buyer: the item must still be on display with a tag.
  return withRng(base, (s, rng) => {
    const c = s.current!
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

function applyTool(state: GameState, tool: ToolId, hotspot?: string): GameState {
  const c = state.current
  const insp = state.inspect
  if (!c || !insp || c.phase !== 'inspect') return state
  const def = getItemDef(c.item.defId)
  const paidFor = payForTool(state, tool, def)
  if (!paidFor) return state
  return withRng(paidFor, (s, rng) => {
    const uses = insp.toolUses[tool] ?? 0
    const result = useTool({ item: c.item, def, tool, hotspot, previous: insp.findings, uses, rng, extras: toolExtras(s, def) })
    const revealed = new Set(c.item.revealed)
    for (const f of result.findings) if (f.tellId) revealed.add(f.tellId)
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
  const c = state.current
  const ctx = haggleContext(state)
  if (!c || !ctx || c.phase !== 'offer') return state
  const offer = Math.round(amount)
  if (offer <= 0 || offer > state.cash) return state
  if (state.haggle && state.haggle.status !== 'open') return state
  return withRng(state, (s, rng) => {
    const h0 = s.haggle ?? startHaggle(ctx, rng)
    const { state: h, response } = haggleRound(h0, { offer, approach, evidenceId }, ctx, rng)
    const lineKey = c.wants === 'pawn' && response.kind === 'accept' ? `pawn.${response.lineKey}` : response.lineKey
    const line = pickLine(lineKey, rng, { price: rub(response.price), name: c.customer.name })
    let next: GameState = { ...s, haggle: h, current: { ...c, line } }
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
  const c = state.current
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
  return resolve(next, 'bought', line ?? visitLines.thanks[0], {
    kind: 'buy',
    amount: -price,
    text: `Bought ${def.name} from ${c.customer.name}`,
    itemId: c.item.id,
    defId: def.id,
  }, price)
}

/** Accept a pawn: lend `principal`, hold the item until it is redeemed or forfeited. */
function pawn(state: GameState, principal: number, line?: string): GameState {
  const c = state.current
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
    return resolve(next, 'pawned', line ?? pickLine('pawn.thanks', rng, { name: c.customer.name, item: def.name }), {
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
      { ...s, cash: s.cash + due, loans: s.loans.filter((l) => l.id !== loan.id) },
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
  const c = state.current
  if (!c || !c.sale) return state
  const def = getItemDef(c.item.defId)
  const next = removeSold(state, c.item.id, price)
  return withRng(next, (s, rng) =>
    resolve(
      { ...s, current: { ...s.current!, sale: { ...c.sale!, status: 'sold' } } },
      'sold',
      line ?? pickLine('sale.thanks.flexible', rng, { name: c.customer.name, item: def.name }),
      { kind: 'sell', amount: price, text: `Sold the ${def.name} to ${c.customer.name}`, itemId: c.item.id, defId: def.id },
      price,
    ),
  )
}

/** Cash in, item out of inventory/display/prices/paid, career stats updated. */
function removeSold(state: GameState, itemId: string, price: number): GameState {
  const paid = state.paid[itemId] ?? 0
  const profit = price - paid
  const { [itemId]: _drop, ...restPaid } = state.paid
  return {
    ...state,
    cash: state.cash + price,
    inventory: state.inventory.filter((i) => i.id !== itemId),
    paid: restPaid,
    shop: clearItem(state.shop, itemId),
    stats: {
      ...state.stats,
      itemsSold: state.stats.itemsSold + 1,
      totalEarned: state.stats.totalEarned + price,
      bestDeal: Math.max(state.stats.bestDeal, profit),
      worstDeal: Math.min(state.stats.worstDeal, profit),
    },
  }
}

function resolve(state: GameState, outcome: VisitOutcome, line: string, entry: LedgerEntry, price?: number): GameState {
  const c = state.current
  if (!c) return state
  return log({ ...state, current: { ...c, phase: 'resolved', outcome, line, price } }, entry)
}

/** Advance in-game time while a customer is at the counter; waiting customers lose patience. */
function advanceTime(state: GameState, seconds: number): GameState {
  if (seconds <= 0) return state
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
      defId: v.item.defId,
    })
    next = {
      ...next,
      reputation: { ...next.reputation, general: next.reputation.general - tuning.day.walkoutRepPenalty },
    }
  }
  return next
}

// --- ledger -------------------------------------------------------------------

function sellToDealer(state: GameState, itemId: string): GameState {
  if (state.day.phase !== 'closed') return state
  const item = state.inventory.find((i) => i.id === itemId)
  if (!item) return state
  return withRng(state, (s, rng) => {
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
