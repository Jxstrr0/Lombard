/**
 * Detective Volkova (M5, GDD § 8): her visits, your three answers, and the raid. Pure.
 *
 * ## Visits
 * Once she is interested (crime/heat.ts volkovaInterested: enough heat, or a police
 * trail has reached you) she comes in within firstVisitDays, then about weekly
 * (everyDays) while she stays interested. `crime.volkova.nextDay` is her next day.
 * Her visit is a systemic scene (no arc file): planned in the morning with an id
 * keyed by day and role (`vs<day>_volkova`, `_recheck`, `_raid`), a queue place from
 * the story stream, and every draw forked from the career seed, the day and a label
 * (story/plan.ts's rule), so planning her never reshuffles the rest of the career.
 * Her lines and choices are built when she walks in (policeScene), from the trail
 * she picks: the piece you still hold first, then a bulletin piece, then the latest.
 * With no trail she reads your passport book instead (a routine visit).
 *
 * ## The courtesy call
 * Every career meets her once, hot or not: on a seeded day in tuning.police.volkova.introDays
 * (introDay) she drops in to introduce herself (`vs<day>_intro`), unless heat brought her in sooner
 * (then her first visit is the introduction). Tea or not; it sets crime.volkova.met, which opens her
 * own arc (src/data/stories/volkova.ts). Those beats are story visits (a `beatId`): isPoliceVisit
 * leaves them alone, and on a day one brings her in, her police visit waits (planPolice storyToday).
 *
 * ## Your answers (policeChoose)
 * - cooperate: you lose the piece (or tell what you know, if it's gone); her trust
 *   and the precinct's opinion rise, heat drops; more so with a passport noted or the
 *   camera's tape (she gets the seller too).
 * - lie: you keep it, unless she can check: the bulletin, the tape, your own book
 *   (and her trust in you makes her less inclined to). Caught: the piece goes, heat
 *   and her distrust jump. Not caught: she may come back to check (`police.recheck`).
 * - bribe: an envelope (more with more heat). It works until it doesn't: each earlier
 *   bribe makes refusal likelier. Refused: heat jumps, she takes the piece anyway.
 * A bribe nudges the clean axis down, a lie a little (tuning.axes); cooperating doesn't.
 * Each answer sets a story flag (police.cooperated / .lied / .caught / .bribed /
 * .bribe_refused; police.met, police.raided) so a later arc can sit on them.
 *
 * ## The raid
 * At closing, with heat at tuning.police.raid.at or more, a raid may be ordered for the
 * next morning. It seizes every stolen piece, and anything of unknown origin bought or
 * pawned with no passport in the book, and fines you; on a second raid, or at
 * shutdownHeat, the shop is shut: endCareer(state, 'raided').
 */
import { getItemDef } from '../../data/items'
import { VOLKOVA, volkovaLines, WEEKDAY_NAMES } from '../../data/police'
import { tuning } from '../../data/tuning'
import { chargeExpense } from '../economy/charge'
import { recordsEvidence } from '../economy/upgrades'
import { nudgeAxis } from '../endings/axes'
import { endCareer } from '../endings/end'
import { adjustRep } from '../reputation'
import { Rng } from '../rng'
import { clearItem } from '../shop/display'
import { shortName } from '../sell/buyer'
import type { CrimeEvent, GameState } from '../state'
import { storyRng, type StoryIds } from '../story/plan'
import type { QueuedVisit, SceneState, VisitState, WalkIn } from '../types'
import { addHeat } from './dials'
import { RAID, RAIDED, RECHECK, TRAIL, addEvent, dropEvents, eventsToday } from './events'
import { openTrails, volkovaInterested, type Trail } from './heat'
import { passportNoted } from './ledger'

const V = tuning.police.volkova
const R = tuning.police.raid
const round = (v: number) => Math.round(v * 1000) / 1000
const rub = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₽`

export function volkovaCustomer(): WalkIn {
  return {
    id: VOLKOVA.id,
    name: VOLKOVA.name,
    archetype: VOLKOVA.archetype,
    temperament: VOLKOVA.temperament,
    knowledge: VOLKOVA.knowledge,
    desperation: VOLKOVA.desperation,
    portraitKey: VOLKOVA.look,
  }
}

/**
 * Is this visit (queued or at the counter) one of Volkova's systemic police visits? Her own
 * arc's beats (src/data/stories/volkova.ts, a `beatId`) play like any other story visit.
 */
export function isPoliceVisit(v: Pick<VisitState, 'customer' | 'beatId'> | null | undefined): boolean {
  return v?.customer.id === VOLKOVA.id && !v.beatId
}

/** Which kind of police visit, from its id (`vs<day>_<role>`). */
export function policeRole(visitId: string): 'raid' | 'recheck' | 'intro' | 'visit' {
  if (visitId.endsWith('_raid')) return 'raid'
  if (visitId.endsWith('_recheck')) return 'recheck'
  if (visitId.endsWith('_intro')) return 'intro'
  return 'visit'
}

/**
 * The day of her courtesy call (GDD § 9 Volkova): once in every career, in tuning.police.volkova.introDays,
 * whatever the heat. One draw per career (its own fork of the seed), so it never moves.
 */
export function introDay(state: GameState): number {
  const [a, b] = V.introDays
  return new Rng(state.meta.seed).fork('police:intro').int(a, b)
}

/** A fork of the career seed for one police draw today (never the game Rng). */
function policeRng(state: GameState, label: string): Rng {
  return storyRng(state, `police:${label}`)
}

function fill(text: string, vars: Record<string, string>): string {
  let out = text
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v)
  return out
}

function setVolkova(state: GameState, patch: Partial<GameState['crime']['volkova']>): GameState {
  return { ...state, crime: { ...state.crime, volkova: { ...state.crime.volkova, ...patch } } }
}

/** Her trust in you moves (clamped); also the story effect { do: 'volkova', trust }. */
export function adjustTrust(state: GameState, delta: number): GameState {
  const trust = round(Math.min(V.trustMax, Math.max(V.trustMin, state.crime.volkova.trust + delta)))
  return setVolkova(state, { trust })
}

function setFlag(state: GameState, flag: string): GameState {
  return state.story.flags.includes(flag) ? state : { ...state, story: { ...state.story, flags: [...state.story.flags, flag] } }
}

function log(state: GameState, text: string, amount = 0, extra: { itemId?: string; defId?: string } = {}): GameState {
  return { ...state, day: { ...state.day, log: [...state.day.log, { kind: 'story', amount, text, ...extra }] } }
}

/** Where a piece is now: in stock, held as a pledge, or gone. */
export function whereIs(state: GameState, itemId: string): 'stock' | 'loan' | null {
  if (state.inventory.some((i) => i.id === itemId)) return 'stock'
  if (state.loans.some((l) => l.item.id === itemId)) return 'loan'
  return null
}

/** The police take a piece: out of stock (display, tags, paid) or, if pledged, the loan is void. */
export function seize(state: GameState, itemId: string, text: string): GameState {
  const where = whereIs(state, itemId)
  if (!where) return state
  const defId = where === 'stock' ? state.inventory.find((i) => i.id === itemId)!.defId : state.loans.find((l) => l.item.id === itemId)!.item.defId
  let s: GameState
  if (where === 'stock') {
    const { [itemId]: _drop, ...paid } = state.paid
    s = { ...state, inventory: state.inventory.filter((i) => i.id !== itemId), paid, shop: clearItem(state.shop, itemId) }
  } else {
    s = { ...state, loans: state.loans.filter((l) => l.item.id !== itemId) }
  }
  s = dropEvents(s, (e) => e.kind === TRAIL && e.data?.item === itemId)
  return log(s, fill(text, { item: shortName(getItemDef(defId).name) }), 0, { itemId, defId })
}

// --- planning -----------------------------------------------------------------

/**
 * Morning: a raid ordered last night happens now (before anyone walks in), a recheck
 * comes due, her courtesy call, or Volkova's ordinary visit. At most one police visit a day.
 * Returns the visit (raids go first in line) and the state with her schedule updated.
 * `storyToday`: one of her own arc's beats brings her in today already, so a recheck or a visit
 * waits for tomorrow (the raid doesn't wait).
 */
export function planPolice(state: GameState, nextId: StoryIds, storyToday = false): { state: GameState; visit: QueuedVisit | null; first: boolean } {
  const day = state.calendar.day
  let s = state
  const patience = tuning.police.patience
  const make = (role: string): QueuedVisit => ({ visitId: nextId('v', role), kind: 'scene', customer: volkovaCustomer(), patience, line: '' })
  const every = () => day + policeRng(s, 'next').int(V.everyDays[0], V.everyDays[1])

  if (eventsToday(s, RAID).length > 0) {
    s = executeRaid(s)
    return { state: setVolkova(s, { nextDay: every() }), visit: make('raid'), first: true }
  }
  if (storyToday) {
    const due = eventsToday(s, RECHECK)
    if (due.length > 0) {
      s = dropEvents(s, (e) => e.kind === RECHECK && e.day === day)
      for (const e of due) s = addEvent(s, { ...e, day: day + 1 })
    }
    const v0 = s.crime.volkova
    return { state: v0.nextDay !== 0 && v0.nextDay <= day ? setVolkova(s, { nextDay: day + 1 }) : s, visit: null, first: false }
  }
  if (eventsToday(s, RECHECK).length > 0) {
    const nextDay = s.crime.volkova.nextDay
    return { state: nextDay !== 0 && nextDay <= day ? setVolkova(s, { nextDay: day + 1 }) : s, visit: make('recheck'), first: false }
  }
  const v = s.crime.volkova
  // Her courtesy call: the new owner meets the local detective, hot or not (unless heat brought her sooner).
  if (!v.met && !volkovaInterested(s) && day >= introDay(s)) return { state: s, visit: make('intro'), first: false }
  if (!volkovaInterested(s)) return { state: v.nextDay !== 0 && v.nextDay <= day ? setVolkova(s, { nextDay: 0 }) : s, visit: null, first: false }
  let nextDay = v.nextDay
  if (nextDay === 0) nextDay = day + policeRng(s, 'first').int(V.firstVisitDays[0], V.firstVisitDays[1])
  if (nextDay > day) return { state: setVolkova(s, { nextDay }), visit: null, first: false }
  return { state: setVolkova(s, { nextDay: every() }), visit: make('volkova'), first: false }
}

// --- at the counter -----------------------------------------------------------

/** The trail she asks about: a piece you still hold first, then a bulletin piece, then the latest. */
export function pickSubject(state: GameState): { event: CrimeEvent; trail: Trail; where: 'stock' | 'loan' | null } | null {
  const open = openTrails(state).map((t) => ({ ...t, where: whereIs(state, t.trail.item) }))
  open.sort((a, b) => Number(!!b.where) - Number(!!a.where) || b.trail.bulletin - a.trail.bulletin || b.trail.bought - a.trail.bought || a.trail.item.localeCompare(b.trail.item))
  return open[0] ?? null
}

/** "on Tuesday", "yesterday", "last week". */
function whenText(state: GameState, bought: number): string {
  const ago = state.calendar.day - bought
  if (ago <= 0) return 'today'
  if (ago === 1) return 'yesterday'
  if (ago < 7) return `on ${WEEKDAY_NAMES[(((state.calendar.weekday - ago) % 7) + 7) % 7]}`
  if (ago < 14) return 'last week'
  return 'a few weeks ago'
}

export function bribeAmount(state: GameState): number {
  const raw = V.bribe.base + V.bribe.perHeat * state.crime.heat
  return Math.round(raw / 500) * 500
}

/** Chance an envelope is refused, given how many she has taken before. */
export function bribeFailChance(bribesBefore: number): number {
  return Math.min(V.bribe.failMax, V.bribe.failBase + V.bribe.failPerBribe * bribesBefore)
}

/** Chance she catches a lie about this trail. */
export function lieCatchChance(state: GameState, trail: Trail): number {
  const L = V.lie
  let p = L.base + (trail.bulletin ? L.bulletin : 0) + (trail.tape ? L.tape : 0) + (trail.passport ? L.passport : 0)
  p -= Math.max(0, state.crime.volkova.trust) * L.trustEase
  return Math.min(L.max, Math.max(0, p))
}

/** Passport books she can read: the share of pieces bought in stock with no passport noted. */
function bookIsThin(state: GameState): boolean | null {
  const bought = state.inventory.filter((i) => (state.paid[i.id] ?? 0) > 0)
  if (bought.length === 0) return null
  const missing = bought.filter((i) => !passportNoted(i)).length
  return missing / bought.length >= V.routine.thinShare
}

/**
 * The scene for a police visit walking in (called from the reducer's nextCustomer).
 * Applies what happens on arrival (first meeting, a recheck's verdict, a routine look at
 * the book) and returns the scene to play, or null for any other visit.
 */
export function policeScene(state: GameState, visitId: string): { state: GameState; scene: SceneState } | null {
  const role = policeRole(visitId)
  const rng = policeRng(state, `lines:${role}`)
  if (role === 'raid') return raidScene(state)
  if (role === 'intro' && !state.crime.volkova.met) return introScene(state)
  let s = state
  const lines: string[] = []
  if (!s.crime.volkova.met) {
    s = meet(s, lines)
  } else if (role === 'visit') {
    lines.push(rng.pick(volkovaLines.again))
  }
  if (role === 'recheck') return recheckScene(s, lines)

  const subject = pickSubject(s)
  if (!subject) {
    lines.push(volkovaLines.routine.open)
    const thin = bookIsThin(s)
    const R0 = V.routine
    if (thin === null) lines.push(volkovaLines.routine.empty)
    else if (thin) {
      lines.push(volkovaLines.routine.thin)
      s = addHeat(adjustTrust(s, R0.thinTrust), R0.thinHeat, 'volkova:book')
    } else {
      lines.push(volkovaLines.routine.good)
      s = addHeat(adjustTrust(s, R0.goodTrust), R0.goodHeat, 'volkova:book')
    }
    return { state: s, scene: { lines, step: 0, choices: [] } }
  }
  const vars = { item: shortName(getItemDef(subject.trail.def).name), when: whenText(s, subject.trail.bought) }
  const ask = subject.where ? (subject.trail.bulletin ? volkovaLines.heldBulletin : volkovaLines.held) : volkovaLines.gone
  lines.push(fill(rng.pick(ask), vars))
  const choices = [
    { id: 'cooperate', label: subject.where ? volkovaLines.choices.cooperate : volkovaLines.choices.cooperateGone },
    { id: 'lie', label: volkovaLines.choices.lie },
  ]
  const envelope = bribeAmount(s)
  if (s.cash >= envelope) choices.push({ id: 'bribe', label: fill(volkovaLines.choices.bribe, { cash: rub(envelope) }) })
  return { state: s, scene: { lines, step: 0, choices } }
}

/** Meeting her: the introduction, without an errand. */
function meet(state: GameState, lines: string[]): GameState {
  lines.push(...volkovaLines.intro)
  let s = setFlag(setVolkova(state, { met: true }), 'police.met')
  // Protection hook: you went to the police about the glue in your lock, and she read the report.
  if (s.story.flags.includes('protection.told_police')) {
    lines.push(volkovaLines.introReported)
    s = adjustTrust(s, V.reportedTrust)
  }
  return s
}

/** Her courtesy call (role 'intro'): who she is, what she does, a cup of tea or not. */
function introScene(state: GameState): { state: GameState; scene: SceneState } {
  const lines: string[] = []
  const s = meet(state, lines)
  lines.push(...volkovaLines.courtesy.lines)
  const C = volkovaLines.courtesy
  return { state: s, scene: { lines, step: 0, choices: [{ id: 'tea', label: C.choices.tea }, { id: 'busy', label: C.choices.busy }] } }
}

/** Your answer at her courtesy call. */
function introChoose(state: GameState, choiceId: string): GameState {
  const cur = state.current!
  const scene = cur.scene!
  const C = volkovaLines.courtesy
  let s = state
  let reply: string
  if (choiceId === 'tea') {
    s = setFlag(adjustTrust(s, V.introTea), 'police.tea')
    reply = C.replies.tea
  } else if (choiceId === 'busy') {
    reply = C.replies.busy
  } else return state
  return { ...s, current: { ...s.current!, scene: { ...scene, chosen: choiceId }, line: reply } }
}

function recheckScene(state: GameState, lines: string[]): { state: GameState; scene: SceneState } {
  const ev = eventsToday(state, RECHECK)[0]
  let s = dropEvents(state, (e) => e.kind === RECHECK && e.day === state.calendar.day)
  const itemId = String(ev?.data?.item ?? '')
  const defId = String(ev?.data?.def ?? '')
  const item = defId ? shortName(getItemDef(defId).name) : 'piece'
  if (policeRng(state, 'recheck').chance(V.lie.recheckCatch)) {
    lines.push(fill(volkovaLines.recheck.caught, { item }))
    if (whereIs(s, itemId)) {
      lines.push(fill(volkovaLines.recheck.caughtTake, { item }))
      s = seize(s, itemId, volkovaLines.log.seized)
    }
    s = caught(s)
  } else {
    lines.push(fill(volkovaLines.recheck.clear, { item }))
    s = adjustTrust(s, V.lie.trust)
  }
  return { state: s, scene: { lines, step: 0, choices: [] } }
}

/** She caught you lying. */
function caught(state: GameState): GameState {
  const L = V.lie
  let s = addHeat(adjustTrust(state, L.caughtTrust), L.caughtHeat, 'volkova:caught')
  s = setVolkova(s, { caught: s.crime.volkova.caught + 1 })
  s = adjustRep(s, 'police', L.caughtRep, 'volkova:caught')
  return setFlag(s, 'police.caught')
}

/**
 * Your answer to her question (scene/choose on a police visit). Applies the outcome and
 * shows her reply; "Go on" then ends the visit as talk.
 */
export function policeChoose(state: GameState, choiceId: string): GameState {
  const c = state.current
  const scene = c?.scene
  if (!c || !isPoliceVisit(c) || c.phase !== 'scene' || !scene || scene.chosen || scene.step < scene.lines.length - 1) return state
  if (!scene.choices.some((x) => x.id === choiceId)) return state
  if (policeRole(c.visitId) === 'intro' && (choiceId === 'tea' || choiceId === 'busy')) return introChoose(state, choiceId)
  const subject = pickSubject(state)
  if (!subject) return state
  const { trail, where } = subject
  const item = shortName(getItemDef(trail.def).name)
  const evidence = trail.passport ? 'passport' : trail.tape || recordsEvidence(state) ? 'tape' : null
  let s = dropEvents(state, (e) => e === subject.event)
  let reply: string
  const take = (st: GameState) => (where ? seize(st, trail.item, volkovaLines.log.seized) : st)
  switch (choiceId) {
    case 'cooperate': {
      const C = V.cooperate
      s = take(s)
      s = adjustTrust(s, where ? C.trust : C.goneTrust)
      s = addHeat(s, where ? C.heat : C.goneHeat, 'volkova:cooperate')
      s = adjustRep(s, 'police', C.rep, 'volkova:cooperate')
      reply = where ? volkovaLines.replies.cooperate : volkovaLines.replies.cooperateGone
      if (evidence) {
        s = addHeat(adjustTrust(s, V.evidence.trust), V.evidence.heat, 'volkova:evidence')
        s = adjustRep(s, 'police', V.evidence.rep, 'volkova:evidence')
        reply = `${reply} ${evidence === 'passport' ? volkovaLines.replies.cooperatePassport : volkovaLines.replies.cooperateTape}`
      }
      s = setFlag(s, 'police.cooperated')
      break
    }
    case 'lie': {
      const L = V.lie
      s = setVolkova(s, { lies: s.crime.volkova.lies + 1 })
      s = nudgeAxis(s, 'clean', tuning.axes.lie, 'volkova:lie')
      s = setFlag(s, 'police.lied')
      const p = lieCatchChance(state, trail)
      const rng = policeRng(state, `lie:${trail.item}`)
      if (rng.chance(p)) {
        s = caught(take(s))
        const r = volkovaLines.replies
        reply = !where ? r.caughtGone : trail.bulletin ? r.caughtBulletin : trail.tape ? r.caughtTape : trail.passport ? r.caughtPassport : r.caught
      } else {
        s = addHeat(adjustTrust(s, L.trust), L.heat, 'volkova:lie')
        reply = volkovaLines.replies.lie
        if (rng.chance(L.recheckChance)) {
          const day = s.calendar.day + rng.int(L.recheckDays[0], L.recheckDays[1])
          s = addEvent(s, { day, kind: RECHECK, data: { item: trail.item, def: trail.def } })
        }
      }
      break
    }
    case 'bribe': {
      const B = V.bribe
      const amount = bribeAmount(state)
      const before = s.crime.volkova.bribes
      s = nudgeAxis(s, 'clean', tuning.axes.bribe, 'volkova:bribe')
      if (policeRng(state, `bribe:${trail.item}`).chance(bribeFailChance(before))) {
        s = take(s)
        s = addHeat(adjustTrust(s, B.failTrust), B.failHeat, 'volkova:bribe')
        s = adjustRep(s, 'police', B.failRep, 'volkova:bribe')
        s = setFlag(s, 'police.bribe_refused')
        reply = where ? volkovaLines.replies.bribeFailed : volkovaLines.replies.bribeFailedGone
      } else {
        s = log({ ...s, cash: s.cash - amount }, volkovaLines.log.bribe, -amount)
        s = setVolkova(s, { bribes: before + 1 })
        s = addHeat(adjustTrust(s, B.trust), B.heat, 'volkova:bribe')
        s = adjustRep(s, 'police', B.rep, 'volkova:bribe')
        s = setFlag(s, 'police.bribed')
        reply = volkovaLines.replies.bribe
      }
      break
    }
    default:
      return state
  }
  const cur = s.current!
  return { ...s, current: { ...cur, scene: { ...scene, chosen: choiceId }, line: fill(reply, { item }) } }
}

// --- the raid -----------------------------------------------------------------

/** Closing: with enough heat, maybe order a raid for tomorrow morning. */
export function rollRaid(state: GameState): GameState {
  const heat = state.crime.heat
  if (heat < R.at) return state
  const tomorrow = state.calendar.day + 1
  if (state.crime.events.some((e) => e.kind === RAID && e.day >= tomorrow)) return state
  let p = R.chance + (heat - R.at) * R.chancePerHeat
  if (state.crime.volkova.trust >= R.vouchTrust) p /= 2
  if (!policeRng(state, 'raid').chance(Math.min(1, p))) return state
  return addEvent(state, { day: tomorrow, kind: RAID })
}

/** What a raid takes: every stolen piece, and anything of unknown origin with no passport in the book (old stock excepted). */
export function raidTargets(state: GameState): string[] {
  const takes = (i: { provenance: string; revealed: string[] }) => i.provenance === 'stolen' || (i.provenance === 'unknown' && !passportNoted(i))
  const stock = state.inventory.filter((i) => (state.paid[i.id] ?? 0) > 0 && takes(i)).map((i) => i.id)
  const pledged = state.loans.filter((l) => takes(l.item)).map((l) => l.item.id)
  return [...stock, ...pledged]
}

/** The raid itself, at opening. */
export function executeRaid(state: GameState): GameState {
  const day = state.calendar.day
  let s = dropEvents(state, (e) => e.kind === RAID && e.day === day)
  const targets = raidTargets(s)
  for (const id of targets) s = seize(s, id, volkovaLines.log.raidSeized)
  const fine = R.fine.base + R.fine.perItem * targets.length
  s = chargeExpense(s, fine, volkovaLines.log.fine)
  const shut = state.crime.heat >= R.shutdownHeat || state.crime.flags.includes('police.raided')
  s = addHeat(s, round(s.crime.heat * R.heatKeep - s.crime.heat), 'raid')
  s = adjustRep(adjustTrust(s, R.trust), 'police', R.rep, 'raid')
  s = { ...s, crime: { ...s.crime, flags: s.crime.flags.includes('police.raided') ? s.crime.flags : [...s.crime.flags, 'police.raided'] } }
  s = setFlag(s, 'police.raided')
  s = addEvent(s, { day, kind: RAIDED, data: { seized: targets.length, fine, shut: shut ? 1 : 0 } })
  return shut ? endCareer(s, 'raided') : s
}

function raidScene(state: GameState): { state: GameState; scene: SceneState } {
  const ev = eventsToday(state, RAIDED)[0]
  const seized = Number(ev?.data?.seized ?? 0)
  const fine = Number(ev?.data?.fine ?? R.fine.base)
  const shut = Number(ev?.data?.shut ?? 0) === 1
  const L = volkovaLines.raid
  const lines = [L.open, L.search, seized > 0 ? fill(L.seized, { pieces: seized === 1 ? 'One piece goes' : `${seized} pieces go`, cash: rub(fine) }) : fill(L.seizedNone, { cash: rub(fine) }), shut ? L.shut : L.open_again]
  const s = state.crime.volkova.met ? state : setFlag(setVolkova(state, { met: true }), 'police.met')
  return { state: s, scene: { lines, step: 0, choices: [] } }
}
