/** The Dubai Rolex Guy (src/data/stories/rolex.ts): beats in order, and both ways the real watch can go. */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { atDay, beatAtCounter, choose, eligible, offer, pass, readScene, run } from './storyHelpers'
import { getItemDef } from '../src/data/items'
import { getRegular } from '../src/data/regulars'
import { getBeat } from '../src/data/stories'
import { claimedValue } from '../src/game/appraise/value'
import { pickBeats } from '../src/game/story/plan'
import { beatRecord, memoryOf } from '../src/game/story/progress'
import type { GameState } from '../src/game/state'

const base = (seed = 11): GameState => ({ ...startedState(seed, 'rolex'), cash: 1_000_000 })
const rolexBeats = (s: GameState) => pickBeats(s).filter((b) => b.id.startsWith('rolex.'))
const trust = (s: GameState) => memoryOf(s, 'edik').trust

/** Offer what it would be worth if genuine: always at or over a pawner's ask, so the loan is taken at once. */
const pawnIt = (s: GameState) => offer(s, claimedValue(getItemDef(s.current!.item!.defId), s.current!.item!))

/** The three fakes, played the polite way: pass on each; humour him on the second, ask about Ramil on the third. */
function politeFakes(s: GameState): GameState {
  s = pass(readScene(beatAtCounter(s, 'rolex.dubai', 4)))
  expect(beatRecord(s, 'rolex.dubai')?.outcome).toBe('passed')
  s = pass(choose(beatAtCounter(s, 'rolex.omeca', 10), 'humour'))
  s = pass(choose(beatAtCounter(s, 'rolex.ramil', 16), 'money'))
  return s
}

/** Calling him a liar on the second and third visits (each ends the visit before the watch comes out). */
function liarFakes(s: GameState): GameState {
  s = pass(readScene(beatAtCounter(s, 'rolex.dubai', 4)))
  s = choose(beatAtCounter(s, 'rolex.omeca', 10), 'liar')
  expect(s.current?.outcome).toBe('left')
  s = choose(beatAtCounter(s, 'rolex.ramil', 16), 'liar')
  expect(s.current?.outcome).toBe('left')
  return s
}

describe('The Dubai Rolex Guy: content', () => {
  it('Edik is the sharp dresser, and the arc brings three fakes then a genuine Rolland he wants to pawn', () => {
    expect(getRegular('edik')?.look).toBe('business_male_05')
    for (const id of ['rolex.dubai', 'rolex.omeca', 'rolex.ramil']) {
      const v = getBeat(id)!.visit
      expect(v.item?.authenticity, id).toBe('fake')
      expect(v.wants, id).toBe('sell')
    }
    for (const id of ['rolex.real', 'rolex.real_cold']) {
      const v = getBeat(id)!.visit
      expect(v.item).toMatchObject({ defId: 'watch_rolland_abyssal', authenticity: 'genuine' })
      expect(v.wants, id).toBe('pawn')
    }
  })

  it('the patter is all Dubai, until he names Ramil', () => {
    const said = ['rolex.dubai', 'rolex.omeca', 'rolex.ramil'].flatMap((id) => getBeat(id)!.visit.scene!.lines).join(' ')
    expect(said).toMatch(/Dubai/)
    expect(said).toMatch(/Ramil/)
  })
})

describe('The Dubai Rolex Guy: pacing', () => {
  it('the first fake can come from day 3, and the brought item is a fake Rolland', () => {
    expect(eligible(atDay(base(), 2), 'rolex.dubai')).toBe(false)
    expect(eligible(atDay(base(), 3), 'rolex.dubai')).toBe(true)
    let seen = 0
    for (let seed = 1; seed <= 30; seed++) if (rolexBeats(atDay(base(seed), 3)).some((b) => b.id === 'rolex.dubai')) seen++
    // chance 0.4 per morning
    expect(seen).toBeGreaterThan(4)
    expect(seen).toBeLessThan(22)
    const s = beatAtCounter(base(), 'rolex.dubai', 4)
    expect(s.current?.customer.regularId).toBe('edik')
    expect(s.current?.phase).toBe('scene')
    expect(s.current?.item).toMatchObject({ defId: 'watch_rolland_abyssal', authenticity: 'fake', fakeProfileId: 'cheap_copy' })
  })

  it('each beat waits for the one before it, by days', () => {
    let s = pass(readScene(beatAtCounter(base(), 'rolex.dubai', 4)))
    expect(eligible(atDay(s, 9), 'rolex.omeca')).toBe(false)
    expect(eligible(atDay(s, 10), 'rolex.omeca')).toBe(true)
    expect(eligible(atDay(s, 30), 'rolex.ramil')).toBe(false)
    s = pass(choose(beatAtCounter(s, 'rolex.omeca', 10), 'dubai'))
    expect(eligible(atDay(s, 15), 'rolex.ramil')).toBe(false)
    expect(eligible(atDay(s, 16), 'rolex.ramil')).toBe(true)
    s = pass(choose(beatAtCounter(s, 'rolex.ramil', 16), 'real'))
    expect(eligible(atDay(s, 22), 'rolex.real')).toBe(false)
    expect(eligible(atDay(s, 23), 'rolex.real')).toBe(true)
  })
})

describe('The Dubai Rolex Guy: branches', () => {
  it('humoured (and passed politely), he drops the act; pawning the real watch ends with baklava', () => {
    let s = politeFakes(base())
    expect(trust(s)).toBeGreaterThanOrEqual(-0.15)
    s = atDay(s, 23)
    expect(eligible(s, 'rolex.real')).toBe(true)
    expect(eligible(s, 'rolex.real_cold')).toBe(false)

    s = readScene(beatAtCounter(s, 'rolex.real', 23))
    expect(s.current?.phase).toBe('present')
    expect(s.current?.wants).toBe('pawn')
    expect(s.current?.line).toBe(getBeat('rolex.real')!.visit.line)
    s = pawnIt(s)
    expect(s.current?.outcome).toBe('pawned')
    expect(s.current?.line).toBe(getBeat('rolex.real')!.visit.after.pawned!.line)
    expect(s.story.flags).toContain('rolex_real_taken')
    expect(s.loans.some((l) => l.customer.regularId === 'edik' && l.item.authenticity === 'genuine')).toBe(true)

    // The cold version never comes once the real watch has been seen.
    expect(eligible(atDay(s, 40), 'rolex.real_cold')).toBe(false)
    expect(eligible(atDay(s, 27), 'rolex.baklava')).toBe(false)
    expect(eligible(atDay(s, 28), 'rolex.baklava')).toBe(true)
    expect(eligible(atDay(s, 40), 'rolex.across')).toBe(false)
    const before = trust(s)
    s = readScene(beatAtCounter(s, 'rolex.baklava', 28))
    expect(s.current?.outcome).toBe('talked')
    expect(trust(s)).toBeGreaterThan(before)
    expect(s.story.arcs.rolex?.ended).toBe(true)
    expect(rolexBeats(atDay(s, 60))).toEqual([])
  })

  it('passing on the real watch after a proper look sends it across the river', () => {
    let s = politeFakes(base())
    s = pass(readScene(beatAtCounter(s, 'rolex.real', 23)))
    expect(s.current?.line).toBe(getBeat('rolex.real')!.visit.after.passed!.line)
    expect(s.story.flags).toContain('rolex_real_missed')
    expect(eligible(atDay(s, 29), 'rolex.across')).toBe(false)
    expect(eligible(atDay(s, 30), 'rolex.across')).toBe(true)
    expect(eligible(atDay(s, 30), 'rolex.baklava')).toBe(false)
    s = readScene(beatAtCounter(s, 'rolex.across', 30))
    expect(s.current?.outcome).toBe('talked')
    expect(s.story.arcs.rolex?.ended).toBe(true)
  })

  it('called a liar every time, he opens with Dubai again, and waving him off misses the real one', () => {
    let s = liarFakes(base())
    expect(s.story.flags).toContain('rolex_called_liar')
    expect(trust(s)).toBeLessThanOrEqual(-0.151)
    s = atDay(s, 23)
    expect(eligible(s, 'rolex.real')).toBe(false)
    expect(eligible(s, 'rolex.real_cold')).toBe(true)

    s = beatAtCounter(s, 'rolex.real_cold', 23)
    expect(s.current?.line).toMatch(/Dubai/)
    s = choose(s, 'wave')
    expect(s.current?.phase).toBe('resolved')
    expect(s.current?.outcome).toBe('left')
    expect(s.loans).toHaveLength(0)
    expect(s.story.flags).toContain('rolex_real_missed')
    expect(eligible(atDay(s, 40), 'rolex.real')).toBe(false)
    s = readScene(beatAtCounter(s, 'rolex.across', 30))
    expect(s.story.arcs.rolex?.ended).toBe(true)
  })

  it('called a liar but willing to look once more, you can still take the real watch', () => {
    let s = liarFakes(base())
    s = choose(beatAtCounter(s, 'rolex.real_cold', 23), 'look')
    expect(s.current?.phase).toBe('present')
    expect(s.current?.item?.authenticity).toBe('genuine')
    const before = trust(s)
    s = pawnIt(s)
    expect(s.current?.outcome).toBe('pawned')
    expect(s.story.flags).toContain('rolex_real_taken')
    expect(trust(s)).toBeGreaterThan(before)
    s = readScene(beatAtCounter(s, 'rolex.baklava', 28))
    expect(s.story.arcs.rolex?.ended).toBe(true)
  })

  it('buying one of his fakes is remembered', () => {
    let s = readScene(beatAtCounter(base(), 'rolex.dubai', 4))
    s = offer(s, claimedValue(getItemDef('watch_rolland_abyssal'), s.current!.item!) * 1.3)
    expect(s.current?.outcome).toBe('bought')
    expect(s.story.flags).toContain('rolex_bought_fake')
    expect(run(s, { type: 'counter/dismiss' }).inventory.some((i) => i.defId === 'watch_rolland_abyssal' && i.authenticity === 'fake')).toBe(true)
  })
})
