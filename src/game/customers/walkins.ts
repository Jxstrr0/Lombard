/** Walk-in generation: archetype + name + temperament + item. */
import { archetypes, firstNames } from '../../data/customers/walkins'
import { ITEM_DEFS } from '../../data/items'
import { tuning } from '../../data/tuning'
import { generateItem, pickItemDef } from '../items/generate'
import { pawnChance, pawnOpeningLine } from '../loans/loans'
import type { Rng } from '../rng'
import type { QueuedVisit, Temperament, WalkIn } from '../types'

const TEMPERAMENTS: readonly Temperament[] = ['stubborn', 'flexible', 'desperate', 'proud']

export function generateWalkIn(rng: Rng, id: string): WalkIn {
  const arch = rng.weighted(archetypes.map((a) => ({ item: a, weight: a.weight })))
  const w = tuning.customers.temperamentWeights
  let temperament = rng.weighted(TEMPERAMENTS.map((t) => ({ item: t, weight: w[t] })))
  const desperation = round2(rng.range(arch.desperation[0], arch.desperation[1]))
  if (desperation > 0.85 && rng.chance(0.5)) temperament = 'desperate'
  return {
    id,
    name: rng.pick(firstNames),
    archetype: arch.id,
    temperament,
    knowledge: round2(rng.range(arch.knowledge[0], arch.knowledge[1])),
    desperation,
    portraitKey: arch.id,
  }
}

/** Build the day's queue. `nextId` returns fresh unique ids. */
export function generateDayQueue(rng: Rng, count: number, nextId: (prefix: string) => string): QueuedVisit[] {
  const queue: QueuedVisit[] = []
  const [pMin, pMax] = tuning.day.queuePatience
  for (let i = 0; i < count; i++) {
    const customer = generateWalkIn(rng, nextId('c'))
    const def = pickItemDef(ITEM_DEFS, rng)
    const item = generateItem(def, rng, nextId('i'))
    // People further back in the line have waited less when you reach them; give them more patience.
    const patience = Math.round(rng.range(pMin, pMax) + i * 25)
    const visitId = nextId('v')
    // Sell or pawn from a forked stream, so loans don't reshuffle the rest of the day.
    const pawnRng = rng.fork(`pawn:${visitId}`)
    if (pawnRng.chance(pawnChance(customer, item))) {
      queue.push({ visitId, kind: 'seller', wants: 'pawn', customer, item, patience, line: pawnOpeningLine(customer, item, pawnRng) })
    } else {
      queue.push({ visitId, kind: 'seller', wants: 'sell', customer, item, patience })
    }
  }
  return queue
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}
