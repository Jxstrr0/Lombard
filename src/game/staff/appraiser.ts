/**
 * The appraiser (M6, GDD § 7 Employee). Pure: no three, no DOM. Numbers in tuning.appraiser,
 * the person and his ledger lines in src/data/appraiser.ts, his arc in src/data/stories/appraiser.ts.
 *
 * Hiring: the second counter (an upgrade, from tuning.appraiser.counterDay) lets you hire one
 * appraiser, Lev Andreyevich Sablin, from the office while the shop is closed. He is paid
 * tuning.appraiser.salary a month, at month end with the rent (prorated by the days he was on
 * staff that month); firing him pays what's owed to the day and is final. While he's on staff the
 * story flag APPRAISER_FLAGS.onStaff is set (his arc's beats wait on it).
 *
 * Work (staffWork, called from the reducer whenever shop time passes): when he is free he takes
 * a walk-in seller off the line, by your rule:
 *   - 'next': the next walk-in seller after the first tuning.appraiser.leaveForYou people in line,
 *     while at least overflowAt people are waiting;
 *   - 'categories': the next walk-in seller (after leaveForYou) bringing something in one of your
 *     chosen categories, however short the line.
 * Only plain walk-ins: never a regular, a story beat, a specialist, the fence, a phone call, a
 * buyer or a pawner coming back. He serves them for serveSeconds at the second counter (the
 * render shows him there while `busy` is set); then the deal resolves (serve, below) and lands in
 * your books like one of yours: the cash, the stock, the loan, the neighbourhood's opinion, the
 * ending axes and the police's interest in a stolen piece.
 *
 * His eye (accuracyOf): he reads a piece for what it is with that chance. A fake or a mix of parts
 * he reads is sent away; one he misses, he buys as genuine: the ledger names it at closing ("his
 * mistake, your money", finishShift). A lowball slip ((1 − accuracy) × lowballChance) insults the
 * seller: they walk and the street hears (repAfterInsult). Every draw comes from a stream keyed
 * by the visit (never the game Rng), so hiring him never rerolls what anyone else brings.
 */
import { APPRAISER, APPRAISER_FLAGS, APPRAISER_LOG } from '../../data/appraiser'
import { getItemDef } from '../../data/items'
import { tuning } from '../../data/tuning'
import { claimedValue } from '../appraise/value'
import { matchesBulletin } from '../crime/bulletin'
import { isFence } from '../crime/fence'
import { heatAfterDeal } from '../crime/heat'
import { daysInMonth, isMonthEnd, monthName, upcomingBills } from '../economy/expenses'
import { chargeExpense } from '../economy/charge'
import { hasUpgrade } from '../economy/upgrades'
import { axesAfterDeal } from '../endings/axes'
import { startHaggle, tidyPrice } from '../haggle/machine'
import { createLoan, pawnClaim } from '../loans/loans'
import { repAfterDeal, repAfterInsult } from '../reputation'
import { Rng } from '../rng'
import type { GameState, StaffMode, StaffState } from '../state'
import { adjustTrust } from '../story/progress'
import type { LedgerEntry, QueuedVisit, WalkIn } from '../types'

const A = tuning.appraiser

export const APPRAISER_ID = APPRAISER.id
export const SECOND_COUNTER = 'second_counter'

export { APPRAISER_FLAGS }

export type StaffChange = 'vanish' | 'leave' | 'sharper'

/** Lev as the person at the counter (his arc's scenes). */
export function appraiserCustomer(): WalkIn {
  return { id: APPRAISER_ID, name: APPRAISER.name, archetype: APPRAISER.role, temperament: 'flexible', knowledge: 1, desperation: 0, portraitKey: APPRAISER.look }
}

export function isAppraiser(c: Pick<WalkIn, 'id'> | null | undefined): boolean {
  return c?.id === APPRAISER_ID
}

export function accuracyOf(state: GameState): number {
  return Math.min(0.97, Math.max(0.3, A.accuracy + state.staff.accuracyMod))
}

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
const rub = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₽`

function log(state: GameState, entry: LedgerEntry): GameState {
  return { ...state, day: { ...state.day, log: [...state.day.log, entry] } }
}

function withStaff(state: GameState, patch: Partial<StaffState>): GameState {
  return { ...state, staff: { ...state.staff, ...patch } }
}

function flag(state: GameState, f: string, on: boolean): GameState {
  const has = state.story.flags.includes(f)
  if (has === on) return state
  const flags = on ? [...state.story.flags, f] : state.story.flags.filter((x) => x !== f)
  return { ...state, story: { ...state.story, flags } }
}

// --- hiring --------------------------------------------------------------------

export type HireStatus = 'hired' | 'gone' | 'noCounter' | 'available'

export function hireStatus(state: GameState): HireStatus {
  if (state.staff.hired) return 'hired'
  if (state.staff.gone) return 'gone'
  if (!hasUpgrade(state, SECOND_COUNTER)) return 'noCounter'
  return 'available'
}

/** Hire him (from the office, while closed; the reducer checks the phase). He starts the next open day. */
export function hire(state: GameState): GameState {
  if (hireStatus(state) !== 'available') return state
  const s = withStaff(state, { hired: true, sinceDay: state.calendar.day, busy: null, pending: [] })
  return adjustTrust(flag(flag(s, APPRAISER_FLAGS.onStaff, true), APPRAISER_FLAGS.hired, true), APPRAISER_ID, A.trust.hired)
}

/** Which walk-ins he takes. Categories are kept even while the rule is 'next', for next time. */
export function setRule(state: GameState, mode: StaffMode, categories?: readonly string[]): GameState {
  const cats = categories ? [...new Set(categories)].sort() : state.staff.categories
  return withStaff(state, { mode, categories: cats })
}

/** Days on staff in the calendar month so far (today included), for the month-end wage or a final one. */
export function daysThisMonth(state: GameState): number {
  if (!state.staff.hired) return 0
  const dom = Number(state.calendar.date.slice(8, 10))
  const monthStart = state.calendar.day - (dom - 1)
  return Math.max(0, state.calendar.day - Math.max(monthStart, state.staff.sinceDay) + 1)
}

/** What he is owed for this month so far (the office's bills; a full month = salary). */
export function wagesDue(state: GameState): number {
  const days = daysThisMonth(state)
  if (days <= 0) return 0
  const full = daysInMonth(state.calendar.date)
  return Math.round((A.salary * Math.min(days, full)) / full / 100) * 100
}

/** Paid on the way out (fired, or let go when he told you): what's owed to the day. */
function payOff(state: GameState): GameState {
  const owed = wagesDue(state)
  if (owed <= 0) return state
  const s = chargeExpense(state, owed, fill(APPRAISER_LOG.wagesFinal, { lev: APPRAISER.short, days: String(daysThisMonth(state)) }))
  return withStaff(s, { record: { ...s.staff.record, wages: s.staff.record.wages + owed } })
}

function leave(state: GameState, how: NonNullable<StaffState['gone']>, pay: boolean): GameState {
  if (!state.staff.hired) return state
  // Whoever he was serving goes home unserved (only possible mid-day, from a story effect).
  const paid = pay ? payOff(state) : state
  const s = withStaff(paid, { hired: false, gone: how, goneDay: state.calendar.day, busy: null })
  return flag(s, APPRAISER_FLAGS.onStaff, false)
}

/** Let him go from the office (while closed). Final; his arc ends where it is. */
export function fire(state: GameState): GameState {
  if (!state.staff.hired) return state
  return adjustTrust(flag(leave(state, 'fired', true), APPRAISER_FLAGS.letGo, true), APPRAISER_ID, -0.3)
}

/** A story effect ({ do: 'staff' }): he goes in the night, he's let go when he tells you, or his eye sharpens. */
export function applyStaffChange(state: GameState, change: StaffChange): GameState {
  switch (change) {
    case 'vanish':
      return leave(state, 'vanished', false)
    case 'leave':
      return leave(state, 'left', true)
    case 'sharper':
      return withStaff(state, { accuracyMod: Math.round((state.staff.accuracyMod + A.arc.sharper) * 1000) / 1000 })
  }
}

// --- month end -----------------------------------------------------------------

/**
 * Month end (closing, after the rent): his wage for the days he was on staff this month. Paid in
 * full (the till covered it) his trust in you grows; short, it drops (and the till goes under, like
 * a retainer).
 */
export function chargeWages(state: GameState): GameState {
  if (!state.staff.hired || !isMonthEnd(state.calendar.date)) return state
  const owed = wagesDue(state)
  if (owed <= 0) return state
  const days = daysThisMonth(state)
  const full = daysInMonth(state.calendar.date)
  const text = fill(days >= full ? APPRAISER_LOG.wages : APPRAISER_LOG.wagesPart, { lev: APPRAISER.short, month: monthName(state.calendar.date), days: String(days) })
  const short = state.cash < owed
  const entry: LedgerEntry = { kind: 'expense', amount: -owed, text }
  const s = withStaff(log({ ...state, cash: state.cash - owed }, entry), { record: { ...state.staff.record, wages: state.staff.record.wages + owed } })
  return adjustTrust(s, APPRAISER_ID, short ? A.trust.short : A.trust.paid)
}

// --- the day's work ------------------------------------------------------------

/** A plain walk-in seller he may serve. */
export function servable(v: QueuedVisit): v is QueuedVisit & { kind: 'seller' } {
  return v.kind === 'seller' && !v.beatId && !v.via && v.offer === undefined && !v.customer.regularId && !v.customer.specialistId && !isFence(v.customer) && !isAppraiser(v.customer)
}

/**
 * Index in the queue of the seller he'd take under his rule, or −1: for the overflow, the one
 * closest to giving up (least patience left); for categories, the first in line.
 */
export function nextForStaff(state: GameState): number {
  const q = state.queue
  const { mode, categories } = state.staff
  if (mode === 'next' && q.length < A.overflowAt) return -1
  let best = -1
  for (let i = A.leaveForYou; i < q.length; i++) {
    const v = q[i]!
    if (!servable(v)) continue
    if (mode === 'categories') {
      if (categories.includes(getItemDef(v.item.defId).category)) return i
      continue
    }
    if (best < 0 || v.patience < q[best]!.patience) best = i
  }
  return best
}

/** What he may spend: the till over his floor and the bills due within tuning.appraiser.billsDays. */
function staffBudget(state: GameState): number {
  const bills = upcomingBills(state).filter((b) => b.inDays <= A.billsDays).reduce((a, b) => a + b.amount, 0)
  return state.cash - A.cashFloor - bills
}

/**
 * Shop time passing (the reducer calls this before the line's patience drains): he finishes the
 * seller he's serving once the clock reaches the end of the serve, and takes the next one by your
 * rule. Several serves can happen in one long stretch. No-op while he isn't on staff, the day isn't
 * open or the paper is unread.
 */
export function staffWork(state: GameState, seconds: number): GameState {
  if (!state.staff.hired || state.day.phase !== 'open' || !state.day.newsRead || state.staff.sinceDay > state.calendar.day) return state
  let s = state
  let now = s.day.clock
  const end = s.day.clock + Math.max(0, seconds)
  for (let guard = 0; guard < 20; guard++) {
    const busy = s.staff.busy
    if (busy) {
      if (busy.until > end) break
      now = Math.max(now, busy.until)
      s = serve(withStaff(s, { busy: null }), busy.visit)
      continue
    }
    const i = nextForStaff(s)
    if (i < 0) break
    const visit = s.queue[i]!
    const [lo, hi] = A.serveSeconds
    const length = Math.round(lo + staffRng(s, visit.visitId, 'serve').next() * (hi - lo))
    s = { ...withStaff(s, { busy: { visit, until: now + length } }), queue: s.queue.filter((_, k) => k !== i) }
  }
  return s
}

/** Closing: he finishes the seller in front of him, and the ledger names today's mistakes. */
export function finishShift(state: GameState): GameState {
  let s = state.staff.busy ? serve(withStaff(state, { busy: null }), state.staff.busy.visit) : state
  for (const m of s.staff.pending) {
    s = log(s, { kind: 'staff', amount: 0, text: fill(APPRAISER_LOG.mistake, { lev: APPRAISER.short, item: getItemDef(m.defId).name, name: m.from, price: rub(m.price) }), itemId: m.itemId, defId: m.defId })
  }
  return s.staff.pending.length ? withStaff(s, { pending: [] }) : s
}

function staffRng(state: GameState, visitId: string, label: string): Rng {
  return new Rng(state.meta.seed).fork(`staff:${visitId}:${label}`)
}

/** One seller at the second counter, start to finish. Exported for tests. */
export function serve(state: GameState, visit: QueuedVisit): GameState {
  if (visit.kind !== 'seller') return state
  const rng = staffRng(state, visit.visitId, 'deal')
  const { item, customer } = visit
  const def = getItemDef(item.defId)
  const acc = accuracyOf(state)
  const vars = { lev: APPRAISER.short, item: def.name, name: customer.name }
  const record = { ...state.staff.record, served: state.staff.record.served + 1 }
  let s: GameState = {
    ...withStaff(state, { record }),
    day: { ...state.day, served: state.day.served + 1 },
    stats: { ...state.stats, customersSeen: state.stats.customersSeen + 1 },
  }
  const pass = (text: string) => log(s, { kind: 'pass', amount: 0, text: fill(text, vars), defId: def.id })
  // He reads the paper: a piece the bulletin listed this week goes back out the door (if he spots it).
  const onBulletin = matchesBulletin(s, item, 7)
  const sees = rng.chance(acc)
  if (onBulletin && sees) return pass(APPRAISER_LOG.passedBulletin)
  const notGenuine = item.authenticity === 'fake' || item.authenticity === 'frankenstein'
  if (notGenuine && sees) return pass(APPRAISER_LOG.passedFake)
  // His valuation: what it really is, if he read it right (a refinish included); else what it claims to be.
  const claim = claimedValue(def, item)
  const read = item.authenticity === 'restored' && sees ? item.trueValue : notGenuine ? claim : item.authenticity === 'restored' ? claim : item.trueValue
  const estimate = Math.max(100, read * (1 + rng.range(-1, 1) * (1 - acc) * A.valueNoise))
  const pawn = visit.wants === 'pawn'
  // A slip: an opening so low it insults them.
  if (rng.chance((1 - acc) * A.lowballChance)) {
    const insult = tidyPrice(estimate * A.lowballShare)
    s = repAfterInsult(s, customer)
    s = { ...s, reputation: { ...s.reputation, general: s.reputation.general - tuning.day.walkoutRepPenalty } }
    s = withStaff(s, { record: { ...s.staff.record, insults: s.staff.record.insults + 1 } })
    return log(s, { kind: 'staff', amount: 0, text: fill(APPRAISER_LOG.insult, { ...vars, price: rub(insult) }), defId: def.id })
  }
  const h0 = startHaggle({ customer, item, claimedValue: pawn ? pawnClaim(claim, customer) : claim, findings: [] }, rng)
  const h = { ...h0, floor: Math.round(h0.floor * (1 - A.talkDown * acc)) }
  const target = estimate * (pawn ? A.loanShare : A.offerShare)
  const max = estimate * (pawn ? A.loanMaxShare : A.maxShare)
  if (h.floor > max) return pass(APPRAISER_LOG.noDeal)
  const top = Math.min(h.ask, Math.max(target, h.floor))
  const price = Math.max(100, tidyPrice(h.floor + (top - h.floor) * A.haggleKeep))
  if (price > staffBudget(s)) return pass(APPRAISER_LOG.noCash)
  const judged = (x: GameState, kind: 'buy' | 'pawn') => heatAfterDeal(axesAfterDeal(repAfterDeal(x, customer, item, price, kind), customer, item, price, kind), customer, item)
  const missed = item.authenticity !== 'genuine' && !(item.authenticity === 'restored' && sees)
  if (pawn) {
    const loan = createLoan({ id: `l${visit.visitId}`, item, customer, principal: price, day: s.calendar.day, rng })
    s = judged({ ...s, cash: s.cash - price, loans: [...s.loans, loan] }, 'pawn')
    s = withStaff(s, { record: { ...s.staff.record, lent: s.staff.record.lent + 1, spent: s.staff.record.spent + price } })
    return log(s, { kind: 'loan', amount: -price, text: fill(APPRAISER_LOG.lent, { ...vars, price: rub(price) }), itemId: item.id, defId: def.id })
  }
  const fake = item.authenticity !== 'genuine'
  s = {
    ...s,
    cash: s.cash - price,
    inventory: [...s.inventory, item],
    paid: { ...s.paid, [item.id]: price },
    stats: { ...s.stats, itemsBought: s.stats.itemsBought + 1, totalSpent: s.stats.totalSpent + price, fakesBought: s.stats.fakesBought + (fake ? 1 : 0) },
  }
  s = judged(s, 'buy')
  const pending = missed && notGenuine ? [...s.staff.pending, { itemId: item.id, defId: def.id, price, from: customer.name }] : s.staff.pending
  s = withStaff(s, {
    pending,
    record: { ...s.staff.record, bought: s.staff.record.bought + 1, spent: s.staff.record.spent + price, fakes: s.staff.record.fakes + (missed && notGenuine ? 1 : 0) },
  })
  return log(s, { kind: 'buy', amount: -price, text: fill(APPRAISER_LOG.bought, vars), itemId: item.id, defId: def.id })
}
