/** Apply story effects (src/game/schema/story.ts) to the state. Pure. */
import { adjustRep } from '../reputation'
import type { Effect } from '../schema/story'
import type { GameState } from '../state'
import { renewPledge } from './pledges'
import { adjustTrust, endArc } from './progress'
import { applyChange, sellToSpecialist, startBoost, walkoutOne } from './specialists'

export function applyEffect(state: GameState, e: Effect, arc: string): GameState {
  switch (e.do) {
    case 'flag':
      return state.story.flags.includes(e.flag) ? state : { ...state, story: { ...state.story, flags: [...state.story.flags, e.flag] } }
    case 'unflag':
      return { ...state, story: { ...state.story, flags: state.story.flags.filter((f) => f !== e.flag) } }
    case 'trust':
      return adjustTrust(state, e.who, e.delta)
    case 'rep':
      // Through the reputation module: clamped to −1…1 and counted in today's change (ledger trend lines).
      return adjustRep(state, e.group, e.delta, `story:${arc}`)
    case 'cash':
      return {
        ...state,
        cash: state.cash + e.amount,
        day: { ...state.day, log: [...state.day.log, { kind: 'story', amount: e.amount, text: e.text }] },
      }
    case 'pressure':
      return { ...state, crime: { ...state.crime, pressure: state.crime.pressure + e.delta } }
    case 'heat':
      return { ...state, crime: { ...state.crime, heat: state.crime.heat + e.delta } }
    case 'endArc':
      return endArc(state, arc)
    // --- M4 specialists' small arcs ---
    case 'specialist':
      return applyChange(state, e.id, e.change, e.text)
    case 'boost':
      return startBoost(state, e.boost)
    case 'walkout':
      return walkoutOne(state)
    case 'sellTo':
      return sellToSpecialist(state, e.id, e.offer)
    // --- M4 story pledges (The Student's Laptop) ---
    case 'renew':
      return renewPledge(state, e.who, e.charge, e.redeem)
  }
}

export function applyEffects(state: GameState, effects: readonly Effect[], arc: string): GameState {
  return effects.reduce((s, e) => applyEffect(s, e, arc), state)
}
