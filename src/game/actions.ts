/**
 * Actions are plain objects (loggable, replayable). The reducer is pure:
 * same state + same action = same result, including RNG draws, because the
 * RNG state lives in GameState.meta.rng.
 *
 * M1 day loop:
 *   day/open → counter/next → counter/inspect → inspect/useTool… → inspect/done
 *   → offer/estimate → offer/make… (haggle) → [bought | walked] or counter/pass
 *   → counter/dismiss → … → day/close (ledger) → ledger/sell… → day/open
 */
import { getItemDef } from '../data/items'
import { pickLine, visitLines } from '../data/lines'
import { tuning } from '../data/tuning'
import { dealerPrice } from './appraise/value'
import { generateDayQueue } from './customers/walkins'
import { haggleRound, startHaggle, type HaggleContext } from './haggle/machine'
import { useTool } from './inspect/tools'
import { Rng } from './rng'
import type { ToolId } from './schema/item'
import { addDays, createInitialState, seasonOf, weekdayOf, type GameState, type Settings } from './state'
import type { Approach, DaySummary, LedgerEntry, VisitOutcome } from './types'

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
  | { type: 'settings/set'; patch: Partial<Settings> }

/** Action types after which the career is autosaved. */
export const AUTOSAVE_ACTIONS: ReadonlySet<Action['type']> = new Set([
  'counter/dismiss',
  'day/close',
  'day/open',
  'ledger/sell',
  'career/new',
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
      if (!c || c.phase !== 'present') return state
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
      return buy({ ...state, haggle: { ...h, status: 'accepted' } }, h.ask)
    }
    case 'counter/pass': {
      const c = state.current
      if (!c || c.phase === 'resolved') return state
      return withRng(state, (s, rng) =>
        resolve(s, 'passed', rng.pick(visitLines.pass), {
          kind: 'pass',
          amount: 0,
          text: `Passed on ${getItemDef(c.item.defId).name} from ${c.customer.name}`,
          defId: c.item.defId,
        }),
      )
    }
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
  if (!state.current || !state.inspect) return null
  return { customer: state.current.customer, item: state.current.item, findings: state.inspect.findings }
}

// --- day ----------------------------------------------------------------------

function openDay(state: GameState): GameState {
  if (state.day.phase !== 'closed') return state
  return withRng(state, (s, rng) => {
    const ids = idAllocator(s)
    const total = tuning.day.customersPerDay
    const queue = generateDayQueue(rng, total, ids.next)
    return {
      ...s,
      meta: { ...s.meta, nextId: ids.nextId() },
      queue,
      current: null,
      inspect: null,
      haggle: null,
      day: { phase: 'open', clock: 0, served: 0, total, openingCash: s.cash, log: [] },
      narration: `The shop is open. ${queue.length} people are waiting outside.`,
    }
  })
}

function closeDay(state: GameState): GameState {
  if (state.day.phase !== 'open' || state.current || state.queue.length > 0) return state
  const log = state.day.log
  const summary: DaySummary = {
    day: state.calendar.day,
    openingCash: state.day.openingCash,
    closingCash: state.cash,
    bought: log.filter((e) => e.kind === 'buy').length,
    spent: -log.filter((e) => e.kind === 'buy').reduce((a, e) => a + e.amount, 0),
    sold: 0,
    earned: 0,
    walkouts: log.filter((e) => e.kind === 'walkout').length,
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
  return {
    ...state,
    queue: rest,
    current: {
      visitId: visit.visitId,
      customer: visit.customer,
      item: visit.item,
      phase: 'present',
      line: visit.item.story,
      elapsed: 0,
    },
    inspect: { findings: [], toolUses: {}, estimate: null },
    haggle: null,
    stats: { ...state.stats, customersSeen: state.stats.customersSeen + 1 },
  }
}

function applyTool(state: GameState, tool: ToolId, hotspot?: string): GameState {
  const c = state.current
  const insp = state.inspect
  if (!c || !insp || c.phase !== 'inspect') return state
  return withRng(state, (s, rng) => {
    const uses = insp.toolUses[tool] ?? 0
    const result = useTool({ item: c.item, def: getItemDef(c.item.defId), tool, hotspot, previous: insp.findings, uses, rng })
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
    const line = pickLine(response.lineKey, rng, { price: rub(response.price), name: c.customer.name })
    let next: GameState = { ...s, haggle: h, current: { ...c, line } }
    next = advanceTime(next, tuning.day.haggleRoundSeconds)
    if (!next.current) return next // they gave up during the round (cannot happen at the counter, but stay safe)
    if (response.kind === 'accept') return buy(next, response.price, line)
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
    const paid = s.paid[itemId] ?? 0
    const profit = price - paid
    const { [itemId]: _drop, ...restPaid } = s.paid
    const history = s.history.slice()
    const last = history[history.length - 1]
    if (last) history[history.length - 1] = { ...last, sold: last.sold + 1, earned: last.earned + price, closingCash: s.cash + price }
    return log(
      {
        ...s,
        cash: s.cash + price,
        inventory: s.inventory.filter((i) => i.id !== itemId),
        paid: restPaid,
        history,
        stats: {
          ...s.stats,
          itemsSold: s.stats.itemsSold + 1,
          totalEarned: s.stats.totalEarned + price,
          bestDeal: Math.max(s.stats.bestDeal, profit),
          worstDeal: Math.min(s.stats.worstDeal, profit),
        },
      },
      { kind: 'sell', amount: price, text: `Sold ${getItemDef(item.defId).name} to the dealer`, itemId, defId: item.defId },
    )
  })
}
