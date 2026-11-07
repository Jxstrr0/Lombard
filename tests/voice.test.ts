import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { speakerOf, voiceFor } from '../src/audio/voice'
import { VOICE_DIR, VOICE_RULES, WALKIN_BARKS, WALKIN_GREETING, voiceFile } from '../src/data/voice'
import { reducer } from '../src/game/actions'
import type { GameState } from '../src/game/state'
import type { VisitState } from '../src/game/types'
import { startedState } from './helpers'

const onDisk = (file: string) => existsSync(new URL(`../public/${VOICE_DIR}${file}`, import.meta.url))

function atCounter(): GameState {
  let s = startedState(7, 'career-voice')
  s = reducer(s, { type: 'day/open' })
  s = reducer(s, { type: 'news/dismiss' })
  const i = s.queue.findIndex((v) => v.kind === 'seller' && !v.customer.regularId)
  return { ...s, queue: [s.queue[i]!, ...s.queue.filter((_, j) => j !== i)] }
}

describe('voice lines', () => {
  it('has a file for every line the game can ask for', () => {
    const files = new Set<string>()
    for (const n of WALKIN_GREETING) for (const g of ['walkin_m', 'walkin_f']) files.add(voiceFile(g, n))
    for (const t of Object.values(WALKIN_BARKS))
      for (const pair of Object.values(t)) for (const n of pair) for (const g of ['walkin_m', 'walkin_f']) files.add(voiceFile(g, n))
    for (const r of VOICE_RULES) files.add(voiceFile(r.who, r.n))
    expect(files.size).toBe(67)
    for (const f of files) expect(onDisk(f), f).toBe(true)
  })

  it('gives walk-ins a voice by gender and keeps unvoiced regulars silent', () => {
    const base = reducer(atCounter(), { type: 'counter/next' }).current as VisitState
    expect(speakerOf(base)).toMatch(/^walkin_[mf]$/)
    expect(speakerOf({ ...base, customer: { ...base.customer, regularId: 'klava' } })).toBeNull()
    expect(speakerOf({ ...base, customer: { ...base.customer, regularId: 'zinaida' } })).toBe('zinaida')
    expect(speakerOf({ ...base, customer: { ...base.customer, id: 'fence' } })).toBe('venya')
  })

  it('plays a story line for its beat, and the same take every time', () => {
    const s = atCounter()
    const next = reducer(s, { type: 'counter/next' })
    const c = next.current as VisitState
    const eduard: GameState = { ...next, current: { ...c, beatId: 'protection.offer', customer: { ...c.customer, regularId: 'eduard' } } }
    const cue = voiceFor(s, eduard, { type: 'counter/next' })
    expect(cue?.file).toBe(voiceFile('eduard', 1))
    expect(voiceFor(s, eduard, { type: 'counter/next' })).toEqual(cue)
  })

  it('barks a walk-in answer in a haggle and says nothing on load', () => {
    let s = reducer(atCounter(), { type: 'counter/next' })
    const c = s.current as VisitState
    const t = c.customer.temperament
    expect(voiceFor(atCounter(), s, { type: 'store/replace' })).toBeNull()
    s = { ...s, haggle: { ask: 1000, floor: 800, round: 0, maxRounds: 5, irritation: 0, status: 'open', history: [] } }
    const answered: GameState = {
      ...s,
      haggle: { ...s.haggle!, round: 1, history: [{ offer: 500, approach: 'straight', response: { kind: 'counter', price: 900, mood: 'neutral', lineKey: `counter.${t}` } }] },
    }
    const cue = voiceFor(s, answered, { type: 'time/tick', seconds: 1 })
    const n = Number(cue?.file.match(/(\d{4})\.mp3$/)?.[1])
    expect(WALKIN_BARKS[t].counter).toContain(n)
    expect(voiceFor(answered, { ...answered }, { type: 'time/tick', seconds: 1 })).toBeNull()
  })
})
