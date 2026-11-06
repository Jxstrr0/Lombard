/** Apply story effects (src/game/schema/story.ts) to the state. Pure. */
import { addHeat, addPressure } from '../crime/dials'
import { scheduleVandalism } from '../crime/vandalism'
import { flagAxis, nudgeAxis } from '../endings/axes'
import { endCareer } from '../endings/end'
import { tuning } from '../../data/tuning'
import { adjustRep } from '../reputation'
import type { Effect } from '../schema/story'
import type { GameState } from '../state'
import { renewPledge } from './pledges'
import { adjustTrust, endArc } from './progress'
import { applyChange, sellToSpecialist, startBoost, walkoutOne } from './specialists'

export function applyEffect(state: GameState, e: Effect, arc: string): GameState {
  switch (e.do) {
    case 'flag': {
      if (state.story.flags.includes(e.flag)) return state
      const next = { ...state, story: { ...state.story, flags: [...state.story.flags, e.flag] } }
      // M5: heart.* and dirty.* choices count on the ending axes, once.
      const move = flagAxis(e.flag)
      return move ? nudgeAxis(next, move.axis, move.delta, `story:${arc}`) : next
    }
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
      return addPressure(state, e.delta, `story:${arc}`)
    case 'heat':
      return addHeat(state, e.delta, `story:${arc}`)
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
    // --- M5 ---
    case 'axis':
      return nudgeAxis(state, e.axis, tuning.axes[e.weight], `story:${arc}`)
    case 'vandalism':
      return scheduleVandalism(state, e.kind)
    case 'endCareer':
      return endCareer(state, e.kind)
  }
}

export function applyEffects(state: GameState, effects: readonly Effect[], arc: string): GameState {
  return effects.reduce((s, e) => applyEffect(s, e, arc), state)
}
