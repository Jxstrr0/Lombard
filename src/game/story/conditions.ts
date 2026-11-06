/** Evaluate story conditions (src/game/schema/story.ts) against the state. Pure. */
import { repOf } from '../reputation'
import type { Condition } from '../schema/story'
import type { GameState } from '../state'
import { pledgeOf } from './pledges'
import { beatRecord } from './progress'

function within(x: number, c: { gte?: number; lte?: number }): boolean {
  return (c.gte === undefined || x >= c.gte) && (c.lte === undefined || x <= c.lte)
}

export function holds(c: Condition, state: GameState): boolean {
  switch (c.if) {
    case 'day':
      return within(state.calendar.day, c)
    case 'weekday':
      return c.in.includes(state.calendar.weekday)
    case 'flag':
      return state.story.flags.includes(c.flag) !== (c.not ?? false)
    case 'beat': {
      const r = beatRecord(state, c.beat)
      let ok = r !== undefined
      if (ok && c.outcome) ok = c.outcome.includes(r!.outcome ?? '') || c.outcome.includes(r!.choice ?? '')
      if (ok && c.ratio) ok = r!.ratio !== undefined && within(r!.ratio, c.ratio)
      if (ok && c.daysAgo) ok = within(state.calendar.day - r!.day, c.daysAgo)
      return ok !== (c.not ?? false)
    }
    case 'trust':
      return within(state.customers[c.who]?.trust ?? 0, c)
    case 'visits':
      return within(state.customers[c.who]?.visits ?? 0, c)
    case 'loan': {
      const open = state.loans.some((l) => l.customer.regularId === c.who)
      return open !== (c.not ?? false)
    }
    case 'pledge': {
      const p = pledgeOf(state, c.beat)
      let ok = p !== undefined && c.is.includes(p.status)
      if (ok && c.daysAgo) ok = p!.day !== undefined && within(state.calendar.day - p!.day, c.daysAgo)
      return ok !== (c.not ?? false)
    }
    case 'specialist': {
      const s = state.specialists[c.id]
      const retained = s?.retained ?? false
      if (retained !== c.retained) return false
      return !c.relationship || within(s?.relationship ?? 0, c.relationship)
    }
    case 'cash':
      return within(state.cash, c)
    case 'rep':
      return within(repOf(state, c.group), c)
  }
}

export function allHold(cs: readonly Condition[], state: GameState): boolean {
  return cs.every((c) => holds(c, state))
}
