/**
 * Playing a story visit at the counter (M4): the scene and its choice, and
 * what is remembered when the visit ends (the beat's record and aftermath,
 * the regular's trust). Pure; called from the reducer in actions.ts.
 */
import { getRegular } from '../../data/regulars'
import { getBeat } from '../../data/stories'
import { tuning } from '../../data/tuning'
import type { Beat } from '../schema/story'
import type { GameState } from '../state'
import type { NewsItem, QueuedVisit, SceneState, VisitOutcome, VisitState } from '../types'
import { applyEffects } from './effects'
import { arcOf, clampTrust, memoryOf, recordBeat, setMemory } from './progress'

/**
 * M4: `{cash}` in a beat's lines, labels and replies reads the amount of the first specialist
 * change in its choices that moves cash (tuning.specialistArcs.changes), so a price is said once.
 */
function sceneText(beat: Beat, text: string): string {
  if (!text.includes('{cash}')) return text
  for (const ch of beat.visit.scene?.choices ?? []) {
    for (const e of ch.effects) {
      const cash = e.do === 'specialist' ? tuning.specialistArcs.changes[e.change]?.cash : undefined
      if (cash) return text.replaceAll('{cash}', `${Math.abs(cash).toLocaleString('en-US')} ₽`)
    }
  }
  return text
}

/** The scene a queued visit opens with, if its beat has one. */
export function sceneFor(visit: Pick<QueuedVisit, 'beatId'>): SceneState | undefined {
  const beat = visit.beatId ? getBeat(visit.beatId) : undefined
  const scene = beat?.visit.scene
  if (!beat || !scene) return undefined
  return { lines: scene.lines.map((l) => sceneText(beat, l)), step: 0, choices: scene.choices.map((c) => ({ id: c.id, label: sceneText(beat, c.label) })) }
}

export type SceneStep =
  | { kind: 'line'; state: GameState }
  /** The scene is over: a scene visit resolves (`outcome`), an item visit moves on to the item. */
  | { kind: 'done'; state: GameState; outcome?: VisitOutcome }

/** "Go on": the next line, or the end of the scene. Waits on the last line while a choice is pending. */
export function sceneNext(state: GameState): SceneStep | null {
  const c = state.current
  const scene = c?.scene
  if (!c || c.phase !== 'scene' || !scene) return null
  const last = scene.step >= scene.lines.length - 1
  if (!last && !scene.chosen) {
    const step = scene.step + 1
    return { kind: 'line', state: { ...state, current: { ...c, scene: { ...scene, step }, line: scene.lines[step]! } } }
  }
  if (!scene.chosen && scene.choices.length > 0) return null
  const choice = scene.chosen ? getBeat(c.beatId ?? '')?.visit.scene?.choices.find((x) => x.id === scene.chosen) : undefined
  if (c.kind === 'scene') return { kind: 'done', state, outcome: 'talked' }
  if (choice?.end) return { kind: 'done', state, outcome: 'left' }
  return { kind: 'done', state }
}

/** Pick a choice on the scene's last line: its effects apply now, its reply becomes the line. */
export function sceneChoose(state: GameState, choiceId: string): GameState {
  const c = state.current
  const scene = c?.scene
  if (!c || c.phase !== 'scene' || !scene || scene.chosen || scene.step < scene.lines.length - 1) return state
  const beat = getBeat(c.beatId ?? '')
  const choice = beat?.visit.scene?.choices.find((x) => x.id === choiceId)
  if (!beat || !choice) return state
  const next: GameState = { ...state, current: { ...c, scene: { ...scene, chosen: choice.id }, line: sceneText(beat, choice.reply) } }
  return applyEffects(next, choice.effects, arcOf(c.beatId!))
}

function trustDelta(outcome: VisitOutcome, ratio: number | undefined): number {
  const t = tuning.regulars.trust
  switch (outcome) {
    case 'bought': {
      const r = ratio ?? 0
      if (r >= t.bought.fair) return t.bought.fairDelta
      if (r >= t.bought.low) return t.bought.okDelta
      return r >= t.bought.insult ? t.bought.lowDelta : t.bought.insultDelta
    }
    case 'pawned': {
      const r = ratio ?? 0
      if (r >= t.pawned.fair) return t.pawned.fairDelta
      return r >= t.pawned.low ? t.pawned.okDelta : t.pawned.lowDelta
    }
    case 'redeemed':
      return t.redeemed
    case 'walked':
      return t.walked
    case 'passed':
      return t.passed
    default:
      return 0
  }
}

/** Price ÷ true value for a buy or a pawn (what was fair, whether or not the player knew it). */
function ratioOf(c: VisitState): number | undefined {
  if ((c.outcome !== 'bought' && c.outcome !== 'pawned') || c.price === undefined || !c.item || c.item.trueValue <= 0) return undefined
  return Math.round((c.price / c.item.trueValue) * 1000) / 1000
}

/**
 * The visit at the counter has just resolved: remember it. A regular's trust
 * moves with how it ended and their next ordinary visit is pushed out; a
 * beat is recorded and its aftermath (line and effects) plays.
 */
export function afterVisit(state: GameState): GameState {
  const c = state.current
  if (!c || c.phase !== 'resolved' || !c.outcome) return state
  const day = state.calendar.day
  const ratio = ratioOf(c)
  let s = state
  const regularId = c.customer.regularId
  if (regularId) {
    const m = memoryOf(s, regularId)
    const def = getRegular(regularId)
    const gap = def?.schedule?.every[0] ?? 7
    s = setMemory(s, regularId, {
      trust: clampTrust(m.trust + trustDelta(c.outcome, ratio)),
      visits: m.visits + 1,
      lastDay: day,
      lastOutcome: c.outcome,
      nextDay: Math.max(m.nextDay, day + gap),
    })
  }
  if (c.beatId) {
    const beat = getBeat(c.beatId)
    s = recordBeat(s, c.beatId, { day, outcome: c.outcome, ...(c.scene?.chosen ? { choice: c.scene.chosen } : {}), ...(ratio !== undefined ? { ratio } : {}) })
    const after = beat?.visit.after[c.outcome] ?? beat?.visit.after.any
    if (after) {
      if (after.line) s = { ...s, current: { ...s.current!, line: after.line } }
      s = applyEffects(s, after.effects, arcOf(c.beatId))
    }
  }
  return s
}

/**
 * M4: beats that land in the morning paper (via 'paper'). Each becomes a story in today's paper
 * (first scene line = headline, the rest = body), is recorded as 'talked', and its aftermath
 * (`talked`, else `any`) applies. Called from openDay after the market's own stories.
 */
export function playPaperBeats(state: GameState, beats: readonly Beat[]): GameState {
  let s = state
  for (const beat of beats) {
    const [headline = '', ...body] = beat.visit.scene?.lines ?? []
    const item: NewsItem = { id: `story-${beat.id}`, headline, body: body.join(' '), tags: [], direction: 'flat' }
    s = { ...s, market: { ...s.market, news: [...s.market.news, item] } }
    s = recordBeat(s, beat.id, { day: s.calendar.day, outcome: 'talked' })
    const after = beat.visit.after.talked ?? beat.visit.after.any
    if (after) s = applyEffects(s, after.effects, arcOf(beat.id))
  }
  return s
}
