/** Evaluate story conditions (src/game/schema/story.ts) against the state. Pure. */
import { repOf } from '../reputation'
import type { Condition } from '../schema/story'
import type { GameState } from '../state'
import { getItemDef } from '../../data/items'
import { pledgeOf } from './pledges'
import { beatRecord } from './progress'
import { monthsRetained } from './specialists'

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
    // --- M4 specialists' small arcs ---
    case 'retainedMonths':
      return monthsRetained(state, c.id) >= c.gte
    case 'specialistEvent':
      return (state.specialists[c.id]?.events[c.event] ?? 0) >= c.gte
    // --- M5 police ---
    case 'heat':
      return within(state.crime.heat, c)
    case 'volkova': {
      const v = state.crime.volkova
      if (c.met !== undefined && v.met !== c.met) return false
      return (!c.trust || within(v.trust, c.trust)) && (!c.lies || within(v.lies, c.lies)) && (!c.caught || within(v.caught, c.caught)) && (!c.bribes || within(v.bribes, c.bribes))
    }
    case 'arc': {
      const a = state.story.arcs[c.arc]
      const started = !!a && Object.keys(a.beats).length > 0
      const is = c.is === 'started' ? started : c.is === 'ended' ? !!a?.ended : started && !a.ended
      return is !== (c.not ?? false)
    }
    case 'stock':
      return state.inventory.some((i) => getItemDef(i.defId).category === c.category && (!c.genuine || i.authenticity === 'genuine'))
    case 'date': {
      const md = state.calendar.date.slice(5)
      return c.from <= c.to ? md >= c.from && md <= c.to : md >= c.from || md <= c.to
    }
    // --- M5 ---
    case 'pressure':
      return within(state.crime.pressure, c)
    // --- M5 the fence ---
    case 'fence': {
      const f = state.crime.fence
      if (c.met !== undefined && f.met !== c.met) return false
      return (!c.deals || within(f.deals, c.deals)) && (!c.refusals || within(f.refusals, c.refusals)) && (!c.trust || within(state.crime.fenceTrust, c.trust))
    }
    case 'any':
      return c.of.some((x) => holds(x, state))
  }
}

export function allHold(cs: readonly Condition[], state: GameState): boolean {
  return cs.every((c) => holds(c, state))
}
