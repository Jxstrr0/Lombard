/**
 * Morning planning for regulars and story beats (M4). Called from openDay.
 *
 * 1. Story beats: every beat of an unfinished arc that hasn't played, whose
 *    conditions hold this morning, rolls its chance; at most
 *    tuning.story.maxBeatsPerDay play, one per arc. The beat's person walks in
 *    with a scripted item and/or a scene. A beat that doesn't get played
 *    (the day closed first) isn't recorded, so it can come up again.
 * 2. Ordinary regular visits: regulars whose next scheduled day has come
 *    (and who aren't already in for a beat), most overdue first, up to
 *    tuning.regulars.maxPerDay. They bring one of their own items.
 * Seller visits from both take walk-in places (the day keeps its length);
 * scene visits come on top. All draws come from a stream forked off the
 * game Rng without advancing it.
 */
import { getItemDef } from '../../data/items'
import { REGULARS } from '../../data/regulars'
import { ARCS } from '../../data/stories'
import { tuning } from '../../data/tuning'
import { generateItem } from '../items/generate'
import { pawnOpeningLine } from '../loans/loans'
import { Rng } from '../rng'
import type { Arc, Beat, RegularDef } from '../schema/story'
import type { CustomerState, GameState } from '../state'
import type { QueuedVisit, WalkIn } from '../types'
import { allHold } from './conditions'
import { beatRecord, memoryOf, warmthOf } from './progress'
import { scriptedItem } from './scripted'
import { specialistCustomer } from './specialists'

export interface StoryPlan {
  /** Visits to merge into today's queue; `first` ones go to the front. */
  visits: { visit: QueuedVisit; first: boolean }[]
  /** Walk-in seller places these visits take. */
  sellerPlaces: number
  /** Regulars' memory with next scheduled days updated. */
  customers: Record<string, CustomerState>
  /** M4: beats that land in this morning's paper (story/visit.ts playPaperBeats). */
  paper: Beat[]
}

export function storyRng(state: GameState, label: string): Rng {
  return Rng.from(state.meta.rng).fork(`story:${state.calendar.day}:${label}`)
}

/** The regular as a customer at the counter. */
export function regularCustomer(def: RegularDef): WalkIn {
  return {
    id: `reg_${def.id}`,
    name: def.name,
    archetype: def.archetype,
    temperament: def.temperament,
    knowledge: def.knowledge,
    desperation: def.desperation,
    portraitKey: def.look,
    regularId: def.id,
  }
}

/**
 * M4 (GDD § 2b): a specialist's arc waits while they're off retainer or retired, and once they were
 * let go while it was under way (a beat had played by then), its final beat never plays.
 */
function specialistAllows(state: GameState, arc: Arc, beat: Beat): boolean {
  if (!arc.specialist) return true
  const sp = state.specialists[arc.specialist]
  if (!sp?.retained || sp.retired) return false
  if (!beat.final || sp.releasedDay === undefined) return true
  return !Object.values(state.story.arcs[arc.id]?.beats ?? {}).some((r) => r.day <= sp.releasedDay!)
}

/** Beats that could play this morning (before the daily chance). Exported for tests. */
export function eligibleBeats(state: GameState): Beat[] {
  const out: Beat[] = []
  for (const arc of ARCS) {
    if (state.story.arcs[arc.id]?.ended) continue
    for (const beat of arc.beats) {
      if (beatRecord(state, beat.id)) continue
      if (!specialistAllows(state, arc, beat)) continue
      if (!allHold(beat.when, state)) continue
      out.push(beat)
    }
  }
  return out
}

/** Pick today's beats. Exported for tests. */
export function pickBeats(state: GameState): Beat[] {
  const picked: Beat[] = []
  const arcs = new Set<string>()
  const people = new Set<string>()
  for (const beat of eligibleBeats(state)) {
    if (picked.length >= tuning.story.maxBeatsPerDay) break
    const arc = beat.id.slice(0, beat.id.indexOf('.'))
    if (arcs.has(arc) || people.has(beat.visit.who)) continue
    if (!storyRng(state, `beat:${beat.id}`).chance(beat.chance)) continue
    picked.push(beat)
    arcs.add(arc)
    people.add(beat.visit.who)
  }
  return picked
}

/** Who plays a beat at the counter: a regular, a specialist (M4), or someone `who` sent (M4 `as`). */
function beatCustomer(beat: Beat): WalkIn | null {
  const v = beat.visit
  if (v.as) {
    return { id: `as_${beat.id.replace('.', '_')}`, name: v.as.name, archetype: v.as.archetype, temperament: v.as.temperament, knowledge: v.as.knowledge, desperation: v.as.desperation, portraitKey: v.as.look }
  }
  const regular = REGULARS.find((r) => r.id === v.who)
  return regular ? regularCustomer(regular) : specialistCustomer(v.who)
}

function beatVisit(state: GameState, beat: Beat, nextId: (prefix: string) => string): QueuedVisit | null {
  const customer = beatCustomer(beat)
  if (!customer) return null
  const visitId = nextId('v')
  const v = beat.visit
  const patience = tuning.story.patience
  if (v.kind === 'scene' || !v.item) {
    return { visitId, kind: 'scene', customer, patience, beatId: beat.id, line: v.scene?.lines[0], ...(v.via === 'phone' ? { via: 'phone' as const } : {}) }
  }
  const def = getItemDef(v.item.defId)
  const item = scriptedItem(def, v.item, storyRng(state, `item:${beat.id}`), nextId('i'))
  return { visitId, kind: 'seller', wants: v.wants, customer, item, patience, beatId: beat.id, line: v.line }
}

function scheduleOk(def: RegularDef, day: number, weekday: number): boolean {
  const s = def.schedule
  if (!s || def.items.length === 0) return false
  if (day < s.from || (s.until !== undefined && day > s.until)) return false
  return !s.weekdays || s.weekdays.includes(weekday)
}

/** First scheduled day for someone we haven't planned yet. */
function firstDay(state: GameState, def: RegularDef): number {
  const [a, b] = tuning.regulars.firstVisitJitter
  return (def.schedule?.from ?? 1) + storyRng(state, `first:${def.id}`).int(a, b)
}

function nextVisitDay(state: GameState, def: RegularDef, m: CustomerState): number {
  const [a, b] = def.schedule?.every ?? [7, 14]
  const scale = m.trust <= tuning.regulars.coldAt ? tuning.regulars.coldEveryScale : 1
  return state.calendar.day + Math.round(storyRng(state, `next:${def.id}`).int(a, b) * scale)
}

function regularVisit(state: GameState, def: RegularDef, nextId: (prefix: string) => string): QueuedVisit {
  const rng = storyRng(state, `visit:${def.id}`)
  const m = memoryOf(state, def.id)
  const entry = rng.weighted(def.items.map((e) => ({ item: e, weight: e.weight })))
  const itemDef = getItemDef(entry.defId)
  const id = nextId('i')
  const story = entry.story ? rng.pick(entry.story) : undefined
  let item = entry.authenticity
    ? scriptedItem(itemDef, { authenticity: entry.authenticity, provenance: entry.provenance ?? 'unknown', story: story ?? rng.pick(itemDef.claims) }, rng, id)
    : generateItem(itemDef, rng, id)
  if (!entry.authenticity && (story || entry.provenance)) item = { ...item, story: story ?? item.story, provenance: entry.provenance ?? item.provenance }
  const customer = regularCustomer(def)
  const hello = rng.pick(def.lines[warmthOf(m)])
  const visitId = nextId('v')
  const [pMin, pMax] = tuning.day.queuePatience
  const patience = Math.round(rng.range(pMin, pMax) + 60)
  if (rng.chance(def.pawn)) {
    return { visitId, kind: 'seller', wants: 'pawn', customer, item, patience, line: `${hello} ${pawnOpeningLine(customer, item, rng)}` }
  }
  return { visitId, kind: 'seller', wants: 'sell', customer, item, patience, line: `${hello} ${item.story}` }
}

export function planStory(state: GameState, nextId: (prefix: string) => string): StoryPlan {
  const day = state.calendar.day
  const customers = { ...state.customers }
  const visits: StoryPlan['visits'] = []
  const paper: Beat[] = []
  let sellerPlaces = 0
  const busy = new Set<string>()

  for (const beat of pickBeats(state)) {
    if (beat.visit.via === 'paper') {
      paper.push(beat)
      continue
    }
    const visit = beatVisit(state, beat, nextId)
    if (!visit) continue
    visits.push({ visit, first: beat.visit.first })
    if (visit.kind === 'seller') sellerPlaces++
    busy.add(beat.visit.who)
  }

  // Someone already holding a pledge with you comes in to redeem it, not to sell; skip them today.
  for (const l of state.loans) if (l.customer.regularId) busy.add(l.customer.regularId)

  const due: { def: RegularDef; nextDay: number }[] = []
  for (const def of REGULARS) {
    if (!def.schedule) continue
    const m = customers[def.id] ?? { ...memoryOf(state, def.id), nextDay: firstDay(state, def) }
    if (!customers[def.id]) customers[def.id] = m
    if (busy.has(def.id) || m.nextDay > day || !scheduleOk(def, day, state.calendar.weekday)) continue
    due.push({ def, nextDay: m.nextDay })
  }
  due.sort((a, b) => a.nextDay - b.nextDay || a.def.id.localeCompare(b.def.id))
  const room = Math.max(0, tuning.day.customersPerDay - tuning.story.minWalkIns - sellerPlaces)
  for (const { def } of due.slice(0, Math.min(tuning.regulars.maxPerDay, room))) {
    visits.push({ visit: regularVisit(state, def, nextId), first: false })
    sellerPlaces++
    customers[def.id] = { ...customers[def.id]!, nextDay: nextVisitDay(state, def, customers[def.id]!) }
  }
  return { visits, sellerPlaces, customers, paper }
}
