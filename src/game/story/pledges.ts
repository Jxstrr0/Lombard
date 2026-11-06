/**
 * Story pledges (M4): following the loan a story beat made until it ends.
 *
 * A beat that ends in a pawn remembers its loan (BeatRecord.loan). If the
 * beat has a redeem plan, the pawner's return is replanned from it instead of
 * the usual hidden roll. When they redeem (afterVisit) or the item is
 * forfeited (each morning, after forfeitOverdue) the record says how and
 * when, so later beats can branch on it (the `pledge` condition). Pure.
 */
import { getItemDef } from '../../data/items'
import { getBeat } from '../../data/stories'
import { renewLoan } from '../loans/loans'
import { Rng } from '../rng'
import type { RedeemPlan } from '../schema/story'
import type { GameState, PledgeRecord } from '../state'
import type { Loan, QueuedVisit } from '../types'
import { beatRecord, recordBeat } from './progress'

export type PledgeStatus = NonNullable<PledgeRecord['end']> | 'open'

/** How the loan made at this beat stands, or undefined if the beat didn't end in a pawn. */
export function pledgeOf(state: GameState, beatId: string): { status: PledgeStatus; day?: number } | undefined {
  const loan = beatRecord(state, beatId)?.loan
  if (!loan) return undefined
  return loan.end ? { status: loan.end, day: loan.day } : { status: 'open' }
}

/** The beat whose loan this is, if a story beat made it. */
function beatOfLoan(state: GameState, loanId: string): string | undefined {
  for (const arc of Object.values(state.story.arcs)) {
    for (const [beatId, r] of Object.entries(arc.beats)) if (r.loan?.id === loanId) return beatId
  }
  return undefined
}

/** The pawner's hidden return day under a story plan (seeded; never past the due day). */
function plannedRedeemDay(state: GameState, loan: Loan, plan: RedeemPlan, label: string): number | null {
  const rng = Rng.from(state.meta.rng).fork(`story:${state.calendar.day}:redeem:${label}`)
  const comes = rng.chance(plan.chance)
  const when = loan.startDay + rng.int(plan.days[0], plan.days[1])
  return comes ? Math.min(when, loan.dueDay) : null
}

function replaceLoan(state: GameState, loan: Loan): GameState {
  return { ...state, loans: state.loans.map((l) => (l.id === loan.id ? loan : l)) }
}

/** A beat just ended in a pawn: link its loan to the beat's record and apply its redeem plan. */
export function notePawn(state: GameState, beatId: string, itemId: string): GameState {
  const loan = state.loans.find((l) => l.item.id === itemId)
  const record = beatRecord(state, beatId)
  if (!loan || !record) return state
  let s = recordBeat(state, beatId, { ...record, loan: { id: loan.id } })
  const plan = getBeat(beatId)?.visit.redeem
  if (plan) s = replaceLoan(s, { ...loan, redeemDay: plannedRedeemDay(s, loan, plan, beatId) })
  return s
}

function markEnded(state: GameState, loanId: string, end: 'redeemed' | 'forfeited'): GameState {
  const beatId = beatOfLoan(state, loanId)
  const record = beatId ? beatRecord(state, beatId) : undefined
  if (!beatId || !record?.loan) return state
  return recordBeat(state, beatId, { ...record, loan: { ...record.loan, end, day: state.calendar.day } })
}

/** A pawner just redeemed: if it was a story pledge, record it and say the beat's thank-you line. */
export function noteRedeemed(state: GameState, loanId: string): GameState {
  const beatId = beatOfLoan(state, loanId)
  if (!beatId) return state
  const s = markEnded(state, loanId, 'redeemed')
  const thanks = getBeat(beatId)?.visit.redeem?.thanks
  return thanks && s.current ? { ...s, current: { ...s.current, line: thanks } } : s
}

/** This morning's forfeits (loans in `before` that are gone now, unredeemed): record the story ones. */
export function noteForfeits(state: GameState, before: readonly Loan[]): GameState {
  let s = state
  for (const l of before) if (!state.loans.some((x) => x.id === l.id)) s = markEnded(s, l.id, 'forfeited')
  return s
}

/** Story pawners coming back to redeem say the beat's line, if it has one. */
export function pledgeRedeemLines(state: GameState, visits: QueuedVisit[]): QueuedVisit[] {
  return visits.map((v) => {
    const beatId = v.kind === 'redeem' && v.loanId ? beatOfLoan(state, v.loanId) : undefined
    const line = beatId ? getBeat(beatId)?.visit.redeem?.line : undefined
    return line ? { ...v, line } : v
  })
}

/**
 * The `renew` effect: this regular's open loan starts a fresh term today. They
 * pay the interest owed so far (logged), unless it's waived; `plan` replans
 * their return.
 */
export function renewPledge(state: GameState, who: string, charge: boolean, plan: RedeemPlan | undefined): GameState {
  const loan = state.loans.find((l) => l.customer.regularId === who)
  if (!loan) return state
  const day = state.calendar.day
  const { loan: renewed, interest } = renewLoan(loan, day)
  const next = plan ? { ...renewed, redeemDay: plannedRedeemDay(state, renewed, plan, `renew:${loan.id}`) } : renewed
  const name = itemName(loan.item.defId)
  const entry = charge
    ? { kind: 'story' as const, amount: interest, text: `${loan.customer.name} paid ${rub(interest)} interest on the ${name}; the loan starts again`, itemId: loan.item.id, defId: loan.item.defId }
    : { kind: 'story' as const, amount: 0, text: `Waived ${rub(interest)} interest on ${loan.customer.name}’s ${name}; the loan starts again`, itemId: loan.item.id, defId: loan.item.defId }
  const s = replaceLoan(state, next)
  return { ...s, cash: s.cash + entry.amount, day: { ...s.day, log: [...s.day.log, entry] } }
}

const rub = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₽`

function itemName(defId: string): string {
  try {
    return getItemDef(defId).name
  } catch {
    return 'item'
  }
}
