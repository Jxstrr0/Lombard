/**
 * The stolen-goods bulletin (M5, GDD § 8, § 10). Pure.
 *
 * Some mornings the paper prints a short police bulletin (templates in
 * src/data/news.ts BULLETIN): a piece, how worn it is, where and when it went.
 * Each line is a real, stolen piece (provenance `stolen`, generated from the
 * career seed and the entry id, so it is the same piece whenever it is made),
 * and with tuning.police.bulletin.bringChance it walks into your shop a few days
 * later: with a flagged regular who's in that day (Margarita), in place of what
 * she meant to sell (her item keeps its id), or else with a walk-in seller of its
 * own, on top of the day's walk-ins (so turning it away costs a clean shop a little
 * time, not a deal). The entry then records that item's id, so buying it reads as a bulletin hit
 * (heat at once, Volkova soon). The line is a tell the player can use: the same
 * kind of thing, as worn as printed, a few days after the paper.
 *
 * Every draw forks from the career seed, the day and a label (story/plan.ts's
 * rule), never the game Rng or the shared id counter.
 */
import { ITEM_DEFS, getItemDef } from '../../data/items'
import { BULLETIN } from '../../data/news'
import { bulletinCarriers, WEEKDAY_NAMES } from '../../data/police'
import { getRegular } from '../../data/regulars'
import { tuning } from '../../data/tuning'
import { Rng } from '../rng'
import type { BulletinEntry, GameState } from '../state'
import { generateWalkIn } from '../customers/walkins'
import { storyRng, type StoryIds } from '../story/plan'
import { scriptedItem } from '../story/scripted'
import type { ItemInstance, QueuedVisit } from '../types'
import { shortName } from '../sell/buyer'
import { BRING, addEvent, dropEvents, eventsToday } from './events'

const B = tuning.police.bulletin

/** Is this exact piece on the bulletin? */
export function onBulletin(state: GameState, itemId: string): boolean {
  return state.crime.bulletin.some((e) => e.itemId === itemId)
}

/** Bulletin lines printed today (the paper's box). */
export function bulletinToday(state: GameState): BulletinEntry[] {
  return state.crime.bulletin.filter((e) => e.day === state.calendar.day)
}

/** The piece a bulletin entry describes, with the given id (same piece every time). */
export function bulletinPiece(state: GameState, entry: Pick<BulletinEntry, 'id' | 'defId'>, id: string, story?: string): ItemInstance {
  const def = getItemDef(entry.defId)
  const rng = new Rng(state.meta.seed).fork(`police:piece:${entry.id}`)
  const claim = rng.pick(def.claims)
  return scriptedItem(def, { authenticity: 'genuine', provenance: 'stolen', story: story ?? claim }, rng, id)
}

/** The bulletin's words for how worn a piece is. */
export function wearOf(condition: number): string {
  return BULLETIN.wear.find(([at]) => condition >= at)?.[1] ?? BULLETIN.wear[BULLETIN.wear.length - 1]![1]
}

/** Does a bulletin line (printed within `days`) describe a piece like this: the same thing, as worn? What a player can check. */
export function matchesBulletin(state: GameState, item: Pick<ItemInstance, 'defId' | 'condition'>, days: number): boolean {
  const wear = `, ${wearOf(item.condition)}.`
  return state.crime.bulletin.some((e) => e.defId === item.defId && state.calendar.day - e.day <= days && e.text.includes(wear))
}

/** Morning: maybe print a bulletin, and plan which pieces walk in and when. */
export function printBulletin(state: GameState): GameState {
  const day = state.calendar.day
  const rng = storyRng(state, 'police:bulletin')
  if (!rng.chance(B.chance)) return state
  const count = rng.weighted(B.lineWeights.map((w, i) => ({ item: i + 1, weight: w })))
  const defs = ITEM_DEFS.filter((d) => B.categories.includes(d.category) && d.baseValue.max <= B.maxValue)
  let s = state
  const used = new Set<string>()
  for (let i = 0; i < count && defs.length > 0; i++) {
    const pool = defs.filter((d) => !used.has(d.id))
    const def = rng.pick(pool.length > 0 ? pool : defs)
    used.add(def.id)
    const id = `b${day.toString(36)}_${i}`
    const piece = bulletinPiece(s, { id, defId: def.id }, id)
    const ago = rng.int(1, 3)
    const weekday = WEEKDAY_NAMES[(((state.calendar.weekday - ago) % 7) + 7) % 7]!
    const text = BULLETIN.line
      .replaceAll('{item}', shortName(def.name))
      .replaceAll('{wear}', wearOf(piece.condition))
      .replaceAll('{place}', rng.pick(BULLETIN.places))
      .replaceAll('{when}', rng.pick(BULLETIN.when).replaceAll('{day}', weekday))
    const entry: BulletinEntry = { id, day, defId: def.id, text }
    s = { ...s, crime: { ...s.crime, bulletin: [...s.crime.bulletin, entry] } }
    if (rng.chance(B.bringChance)) s = addEvent(s, { day: day + rng.int(B.bringDays[0], B.bringDays[1]), kind: BRING, data: { entry: id } })
  }
  return s
}

/** The greeting a regular's ordinary visit opened with (their line minus the item's story). */
function greetingOf(v: QueuedVisit): string {
  const def = v.customer.regularId ? getRegular(v.customer.regularId) : undefined
  if (!def || !v.line) return ''
  for (const set of Object.values(def.lines)) for (const l of set) if (v.line.startsWith(l)) return `${l} `
  return ''
}

/**
 * Morning: today's bulletin pieces walk in. Each replaces the item of a flagged regular's
 * ordinary visit (with regularChance), or else comes with a walk-in seller of its own, on top
 * of the day's walk-ins (ids from `nextId`, so nobody else's id or draw moves). Returns the
 * state (entries now name the item ids; the bring events are spent), the story visits, and
 * the extra walk-ins.
 */
export function bringBulletin(state: GameState, story: QueuedVisit[], nextId: StoryIds): { state: GameState; story: QueuedVisit[]; extra: QueuedVisit[] } {
  const brings = eventsToday(state, BRING)
  if (brings.length === 0) return { state, story, extra: [] }
  let s = dropEvents(state, (e) => e.kind === BRING && e.day === state.calendar.day)
  const outStory = story.slice()
  const extra: QueuedVisit[] = []
  const taken = new Set<string>()
  for (const ev of brings) {
    const entry = s.crime.bulletin.find((e) => e.id === String(ev.data?.entry ?? ''))
    if (!entry || entry.itemId) continue
    const rng = storyRng(s, `police:bring:${entry.id}`)
    const regularAt = outStory.findIndex(
      (v) => v.kind === 'seller' && v.wants === 'sell' && !v.beatId && !!v.customer.regularId && tuning.police.flagged.includes(v.customer.regularId) && !taken.has(v.visitId),
    )
    let itemId: string
    const v = regularAt >= 0 ? outStory[regularAt]! : null
    if (v && v.kind !== 'scene' && rng.chance(B.regularChance)) {
      const lines = bulletinCarriers[v.customer.regularId!]
      const piece = bulletinPiece(s, entry, v.item.id, lines?.length ? rng.pick(lines) : undefined)
      outStory[regularAt] = { ...v, item: piece, line: `${greetingOf(v)}${piece.story}` }
      taken.add(v.visitId)
      itemId = piece.id
    } else {
      const who = `bulletin_${entry.id}`
      const customer = generateWalkIn(rng, nextId('c', who))
      const piece = bulletinPiece(s, entry, nextId('i', who))
      const [pMin, pMax] = tuning.day.queuePatience
      extra.push({ visitId: nextId('v', who), kind: 'seller', wants: 'sell', customer, item: piece, patience: Math.round(rng.range(pMin, pMax)) })
      itemId = piece.id
    }
    s = { ...s, crime: { ...s.crime, bulletin: s.crime.bulletin.map((e) => (e.id === entry.id ? { ...e, itemId } : e)) } }
  }
  return { state: s, story: outStory, extra }
}

/** Night: lines older than keepDays come off the list. */
export function pruneBulletin(state: GameState): GameState {
  const keep = state.crime.bulletin.filter((e) => e.day + B.keepDays > state.calendar.day)
  return keep.length === state.crime.bulletin.length ? state : { ...state, crime: { ...state.crime, bulletin: keep } }
}
