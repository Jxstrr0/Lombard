/**
 * Vandalism (M5, GDD § 8; the Protection arc's ladder for refusers). Pure.
 *
 * A story effect schedules it for tonight (`scheduleVandalism`), as a crime event; the next
 * morning's openDay plays it (`runCrimeEvents`), so the player finds the aftermath, never
 * the night. The brick through the counter case:
 *   - maybe one piece from the case is gone (tuning.protection.brick.stolen), and each
 *     piece left may have taken glass (`damaged`: condition down by `damage`, value with it);
 *   - the case has no glass until the glazier comes (`repairDays`, his bill then), and while
 *     it's out the case is as exposed to shoplifters as the wall (src/game/shop/theft.ts).
 * Draws come from a stream seeded by the career and the night (`crime:brick:<day>`), never
 * the game Rng, so a brick shifts nothing else.
 */
import { getItemDef } from '../../data/items'
import { tuning } from '../../data/tuning'
import { vandalismLines } from '../../data/vandalismLines'
import { conditionFactor, tidyPrice } from '../appraise/value'
import { Rng } from '../rng'
import { shortName } from '../sell/buyer'
import { clearItem, displayed } from '../shop/display'
import type { CrimeEvent, GameState } from '../state'
import type { ItemInstance, LedgerEntry } from '../types'

export const BRICK = 'protection.brick'
export const GLAZIER = 'protection.glazier'

const B = tuning.protection.brick
const L = vandalismLines.brick

/** Vandalism tonight. One of a kind at a time: a second brick the same night is the same brick. */
export function scheduleVandalism(state: GameState, kind: 'brick'): GameState {
  if (kind !== 'brick' || state.crime.events.some((e) => e.kind === BRICK)) return state
  const event: CrimeEvent = { day: state.calendar.day, kind: BRICK }
  return { ...state, crime: { ...state.crime, events: [...state.crime.events, event] } }
}

/** The counter case has no glass (between a brick and the glazier). */
export function caseBroken(state: GameState): boolean {
  return state.crime.events.some((e) => e.kind === GLAZIER)
}

const fill = (line: string, item: ItemInstance) => line.replaceAll('{item}', shortName(getItemDef(item.defId).name))

/** The piece after it took glass: condition down, value with it. */
function damaged(item: ItemInstance): ItemInstance {
  const def = getItemDef(item.defId)
  const condition = Math.max(B.minCondition, item.condition - B.damage)
  const factor = conditionFactor(def.valueCurve, condition) / conditionFactor(def.valueCurve, item.condition)
  return { ...item, condition, trueValue: tidyPrice(item.trueValue * factor) }
}

function brick(state: GameState, night: number): GameState {
  const rng = new Rng(state.meta.seed).fork(`crime:brick:${night}`)
  const entries: LedgerEntry[] = [{ kind: 'story', amount: 0, text: L.found }]
  const gone = new Set<string>()
  const hurt = new Map<string, ItemInstance>()
  const inCase = displayed(state).filter((d) => d.area === 'counter')
  // Someone reaches through the hole for one piece (or the noise sends them off), then the glass.
  const taken = inCase.length > 0 && rng.chance(B.stolen) ? rng.pick(inCase) : undefined
  if (taken) {
    gone.add(taken.item.id)
    entries.push({ kind: 'theft', amount: 0, text: fill(rng.pick(L.gone), taken.item), itemId: taken.item.id, defId: taken.item.defId })
  }
  for (const d of inCase) {
    if (d === taken || !rng.chance(B.damaged)) continue
    hurt.set(d.item.id, damaged(d.item))
    entries.push({ kind: 'story', amount: 0, text: fill(rng.pick(L.damaged), d.item), itemId: d.item.id, defId: d.item.defId })
  }
  let shop = state.shop
  for (const id of gone) shop = clearItem(shop, id)
  const inventory = state.inventory.filter((i) => !gone.has(i.id)).map((i) => hurt.get(i.id) ?? i)
  const glazier: CrimeEvent = { day: state.calendar.day + B.repairDays, kind: GLAZIER }
  return {
    ...state,
    inventory,
    shop,
    paid: Object.fromEntries(Object.entries(state.paid).filter(([id]) => !gone.has(id))),
    stats: { ...state.stats, itemsStolen: (state.stats.itemsStolen ?? 0) + gone.size },
    crime: { ...state.crime, events: [...state.crime.events.filter((e) => e.kind !== GLAZIER), glazier] },
    day: { ...state.day, log: [...state.day.log, ...entries] },
  }
}

function glazier(state: GameState): GameState {
  const entry: LedgerEntry = { kind: 'expense', amount: -B.glazier, text: L.glazier }
  return { ...state, cash: state.cash - B.glazier, day: { ...state.day, log: [...state.day.log, entry] } }
}

/**
 * This morning (openDay, today's log started): last night's vandalism, and the glazier when
 * he's due. Other systems' event kinds are left alone. `morning` is what the shop says
 * about it when it opens.
 */
export function runCrimeEvents(state: GameState): { state: GameState; morning?: string } {
  const today = state.calendar.day
  let s = state
  let morning: string | undefined
  for (const e of state.crime.events) {
    if (!s.crime.events.includes(e)) continue
    const rest = { ...s, crime: { ...s.crime, events: s.crime.events.filter((x) => x !== e) } }
    if (e.kind === BRICK && e.day < today) {
      s = brick(rest, e.day)
      morning = L.morning
    } else if (e.kind === GLAZIER && e.day <= today) {
      s = glazier(rest)
    }
  }
  if (!morning && caseBroken(s)) morning = L.open
  return { state: s, ...(morning ? { morning } : {}) }
}
