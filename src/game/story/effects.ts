/** Apply story effects (src/game/schema/story.ts) to the state. Pure. */
import { adjustRep } from '../reputation'
import type { Effect } from '../schema/story'
import type { GameState } from '../state'
import { adjustTrust, endArc } from './progress'

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
  }
}

export function applyEffects(state: GameState, effects: readonly Effect[], arc: string): GameState {
  return effects.reduce((s, e) => applyEffect(s, e, arc), state)
}
