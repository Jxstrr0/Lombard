/** Walk-in generation: archetype + name + temperament + item. */
import { archetypes, firstNames } from '../../data/customers/walkins'
import { SPAWN_DEFS } from '../../data/items'
import { tuning } from '../../data/tuning'
import { fitClaim } from '../items/claims'
import { generateItem, pickItemDef } from '../items/generate'
import { pawnChance, pawnOpeningLine } from '../loans/loans'
import { genderOf, pickLook } from './look'
import type { Rng } from '../rng'
import type { QueuedVisit, Temperament, WalkIn } from '../types'

const TEMPERAMENTS: readonly Temperament[] = ['stubborn', 'flexible', 'desperate', 'proud']

/** `avoidLook`: the previous customer's cast id, so the same person doesn't come in twice running. */
export function generateWalkIn(rng: Rng, id: string, avoidLook?: string): WalkIn {
  const arch = rng.weighted(archetypes.map((a) => ({ item: a, weight: a.weight })))
  const w = tuning.customers.temperamentWeights
  let temperament = rng.weighted(TEMPERAMENTS.map((t) => ({ item: t, weight: w[t] })))
  const desperation = round2(rng.range(arch.desperation[0], arch.desperation[1]))
  if (desperation > 0.85 && rng.chance(0.5)) temperament = 'desperate'
  const name = rng.pick(firstNames)
  return {
    id,
    name,
    archetype: arch.id,
    temperament,
    knowledge: round2(rng.range(arch.knowledge[0], arch.knowledge[1])),
    desperation,
    // A forked stream, so the 3D look doesn't shift any other draw.
    portraitKey: pickLook(rng.fork(`look:${id}`), { name, archetype: arch.id }, avoidLook),
  }
}

/** Build the day's queue. `nextId` returns fresh unique ids. */
export function generateDayQueue(rng: Rng, count: number, nextId: (prefix: string) => string): QueuedVisit[] {
  const queue: QueuedVisit[] = []
  const [pMin, pMax] = tuning.day.queuePatience
  for (let i = 0; i < count; i++) {
    const customer = generateWalkIn(rng, nextId('c'), queue[queue.length - 1]?.customer.portraitKey)
    const def = pickItemDef(SPAWN_DEFS, rng)
    const generated = generateItem(def, rng, nextId('i'))
    // A claim like "from my first husband" only fits some people; swap it from a fork so no other draw moves.
    const story = fitClaim(def, generated.story, genderOf(customer.name), rng.fork(`claim:${generated.id}`))
    const item = story === generated.story ? generated : { ...generated, story }
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
