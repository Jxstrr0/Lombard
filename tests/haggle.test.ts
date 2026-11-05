import { describe, expect, it } from 'vitest'
import { haggleLines } from '../src/data/lines'
import { tuning } from '../src/data/tuning'
import { haggleRound, startHaggle, type HaggleContext, type HaggleMove } from '../src/game/haggle/machine'
import { Rng } from '../src/game/rng'
import type { Authenticity, Finding, HaggleResponse, HaggleState, ItemInstance, Temperament, WalkIn } from '../src/game/types'

const TEMPERAMENTS: readonly Temperament[] = ['stubborn', 'flexible', 'desperate', 'proud']
const CLAIMED = 10_000

function walkIn(temperament: Temperament, knowledge = 0.5, desperation = 0.5): WalkIn {
  return { id: 'c1', name: 'Gennady', archetype: 'pensioner', temperament, knowledge, desperation, portraitKey: 'p1' }
}

function item(authenticity: Authenticity = 'genuine', trueValue = CLAIMED): ItemInstance {
  return {
    id: 'i1',
    defId: 'test-watch',
    condition: 70,
    authenticity,
    provenance: 'clean',
    trueValue,
    revealed: [],
    story: 'My grandfather’s watch.',
  }
}

const negCondition: Finding = { id: 'f-scratch', tool: 'loupe', text: 'Deep scratch across the crystal.', reveals: 'condition', polarity: 'negative' }
const negAuth: Finding = { id: 'f-hallmark', tool: 'loupe', text: 'Hallmark is blurry and misaligned.', reveals: 'authenticity', polarity: 'negative' }
const negProv: Finding = { id: 'f-engraving', tool: 'loupe', text: 'An engraving has been filed off.', reveals: 'provenance', polarity: 'negative' }
const posAuth: Finding = { id: 'f-serial', tool: 'reference', text: 'Serial matches the catalogue.', reveals: 'authenticity', polarity: 'positive' }
const neutral: Finding = { id: 'f-weight', tool: 'scale', text: 'Weight is about right.', polarity: 'neutral' }

function ctxOf(customer: WalkIn, opts: { authenticity?: Authenticity; findings?: Finding[]; claimed?: number } = {}): HaggleContext {
  return {
    customer,
    item: item(opts.authenticity ?? 'genuine'),
    claimedValue: opts.claimed ?? CLAIMED,
    findings: opts.findings ?? [negCondition, negAuth, negProv, posAuth, neutral],
  }
}

/** A seeded random customer for simulations. */
function randomCustomer(rng: Rng): WalkIn {
  return walkIn(rng.pick(TEMPERAMENTS), rng.range(0.1, 0.9), rng.range(0.05, 0.95))
}

type Policy = (state: HaggleState, ctx: HaggleContext, round: number, last: HaggleResponse | null) => HaggleMove | 'acceptAsk'

interface Outcome {
  paid: number | null
  rounds: number
  keys: string[]
}

function play(ctx: HaggleContext, seed: number, policy: Policy): Outcome {
  const rng = new Rng(seed)
  let state = startHaggle(ctx, rng)
  let last: HaggleResponse | null = null
  const keys: string[] = []
  for (let i = 0; i < 20 && state.status === 'open'; i++) {
    const move = policy(state, ctx, i, last)
    if (move === 'acceptAsk') return { paid: state.ask, rounds: state.round, keys }
    const r = haggleRound(state, move, ctx, rng)
    state = r.state
    last = r.response
    keys.push(r.response.lineKey)
    if (r.response.kind === 'accept') return { paid: r.response.price, rounds: state.round, keys }
  }
  return { paid: null, rounds: state.round, keys }
}

/** Careful: open at 45%, cite each negative finding once, raise 10% per round. */
const careful: Policy = (_state, ctx, round) => {
  const offer = Math.round(ctx.claimedValue * 0.45 * 1.1 ** round)
  const evidence = ctx.findings.filter((f) => f.polarity === 'negative')[round]
  return evidence ? { offer, approach: 'evidence', evidenceId: evidence.id } : { offer, approach: 'straight' }
}

/** Careless: offer 90% straight, pay the ask if it comes to that. */
const careless: Policy = (state, ctx, _round, last) => {
  if (last?.kind === 'counter' && state.round >= 2) return 'acceptAsk'
  return { offer: Math.round(ctx.claimedValue * 0.9), approach: 'straight' }
}

function simCtx(seed: number): HaggleContext {
  const rng = new Rng(seed ^ 0x5eed)
  const customer = randomCustomer(rng)
  const fake = rng.chance(0.2)
  const findings: Finding[] = []
  if (rng.chance(0.5)) findings.push(negCondition)
  if (fake && rng.chance(0.6)) findings.push(negAuth)
  if (rng.chance(0.4)) findings.push(posAuth)
  return { customer, item: item(fake ? 'fake' : 'genuine', fake ? 1500 : CLAIMED), claimedValue: CLAIMED, findings }
}

function simulate(policy: Policy, n = 500) {
  let total = 0
  let bought = 0
  for (let s = 1; s <= n; s++) {
    const o = play(simCtx(s), s, policy)
    if (o.paid !== null) {
      total += o.paid / CLAIMED
      bought++
    }
  }
  return { avg: total / bought, buyRate: bought / n }
}

const ALL_FINDINGS = [negCondition, negAuth, negProv, posAuth, neutral]
const APPROACHES = ['straight', 'evidence', 'sympathy', 'walk'] as const

/** Random but seeded moves, including bad evidence ids and wild offers. */
function randomMove(rng: Rng, claimed: number): HaggleMove {
  const approach = rng.pick(APPROACHES)
  const offer = Math.max(10, Math.round(claimed * rng.range(0.05, 1.3)))
  if (approach !== 'evidence') return { offer, approach }
  const ids = [...ALL_FINDINGS.map((f) => f.id), 'no-such-finding', undefined]
  return { offer, approach, evidenceId: rng.pick(ids) }
}

/** Play a random haggle to the end, recording each step. */
function randomHaggle(seed: number) {
  const rng = new Rng(seed)
  const temperament = TEMPERAMENTS[seed % 4]!
  const ctx = ctxOf(walkIn(temperament, rng.range(0, 1), rng.range(0, 1)), {
    authenticity: rng.chance(0.3) ? 'fake' : 'genuine',
    claimed: rng.pick([900, 4_000, 10_000, 37_000]),
  })
  let state = startHaggle(ctx, rng)
  const steps: { before: HaggleState; move: HaggleMove; after: HaggleState; response: HaggleResponse }[] = []
  for (let i = 0; i < 10 && state.status === 'open'; i++) {
    const move = randomMove(rng, ctx.claimedValue)
    const { state: after, response } = haggleRound(state, move, ctx, rng)
    steps.push({ before: state, move, after, response })
    state = after
  }
  return { ctx, steps, final: state }
}

function opening(ctx: HaggleContext, seed: number) {
  const rng = new Rng(seed)
  return { rng, state: startHaggle(ctx, rng) }
}

describe('startHaggle', () => {
  it('opens with a tidy ask above a hidden floor, within 2–5 rounds', () => {
    for (let s = 1; s <= 200; s++) {
      for (const claimed of [800, 10_000]) {
        const ctx = ctxOf(walkIn(TEMPERAMENTS[s % 4]!, (s % 10) / 10, ((s * 3) % 10) / 10), { claimed })
        const { state } = opening(ctx, s)
        expect(state.ask % (state.ask >= 2000 ? 100 : 10)).toBe(0)
        expect(state.floor).toBeLessThanOrEqual(state.ask)
        expect(state.floor).toBeGreaterThan(0)
        expect(state.maxRounds).toBeGreaterThanOrEqual(2)
        expect(state.maxRounds).toBeLessThanOrEqual(tuning.haggle.maxRounds)
        expect(state).toMatchObject({ round: 0, irritation: 0, status: 'open', history: [] })
      }
    }
  })

  it('anchors opening asks around 70–120% of claimedValue', () => {
    let sum = 0
    const n = 400
    for (let s = 1; s <= n; s++) {
      const { state } = opening(ctxOf(randomCustomer(new Rng(s * 31))), s)
      sum += state.ask / CLAIMED
      expect(state.ask / CLAIMED).toBeGreaterThan(0.55)
      expect(state.ask / CLAIMED).toBeLessThan(1.5)
    }
    expect(sum / n).toBeGreaterThan(0.85)
    expect(sum / n).toBeLessThan(1.1)
  })

  it('knowledgeable sellers ask closer to claimedValue than clueless ones', () => {
    const spread = (knowledge: number) => {
      let dev = 0
      for (let s = 1; s <= 300; s++) dev += Math.abs(opening(ctxOf(walkIn('flexible', knowledge)), s).state.ask / CLAIMED - 1)
      return dev / 300
    }
    expect(spread(0.95)).toBeLessThan(spread(0.05))
  })
})

describe('haggleRound', () => {
  it('accepts an offer at or above the ask, at the offer', () => {
    for (let s = 1; s <= 100; s++) {
      for (const t of TEMPERAMENTS) {
        const ctx = ctxOf(walkIn(t))
        const { rng, state } = opening(ctx, s)
        for (const offer of [state.ask, state.ask + 700]) {
          const { state: next, response } = haggleRound(state, { offer, approach: 'straight' }, ctx, rng)
          expect(response.kind).toBe('accept')
          expect(response.price).toBe(offer)
          expect(next.status).toBe('accepted')
        }
      }
    }
  })

  it('an insulting lowball raises irritation, and proud sellers can walk on it', () => {
    let proudWalks = 0
    for (let s = 1; s <= 100; s++) {
      for (const t of TEMPERAMENTS) {
        const ctx = ctxOf(walkIn(t))
        const { state } = opening(ctx, s)
        const insult = haggleRound(state, { offer: 1_000, approach: 'straight' }, ctx, new Rng(s + 1))
        const lowball = haggleRound(state, { offer: 4_000, approach: 'straight' }, ctx, new Rng(s + 1))
        expect(insult.response.mood).toBe('insulted')
        expect(insult.response.lineKey).toMatch(/insulted/)
        expect(insult.state.irritation).toBeGreaterThan(state.irritation)
        if (insult.response.kind !== 'walk') expect(insult.state.irritation).toBeGreaterThan(lowball.state.irritation)
        if (t === 'proud' && insult.response.kind === 'walk') proudWalks++
        if (t === 'flexible') expect(insult.response.kind).toBe('counter')
      }
    }
    expect(proudWalks).toBeGreaterThan(20)
  })

  it('negative evidence gets a lower counter than the same offer straight', () => {
    const avg = (approach: 'straight' | 'evidence', finding: Finding, authenticity: Authenticity) => {
      let total = 0
      let n = 0
      for (let s = 1; s <= 300; s++) {
        const ctx = ctxOf(walkIn(TEMPERAMENTS[s % 4]!, (s % 9) / 10 + 0.05, 0.5), { authenticity })
        const { rng, state } = opening(ctx, s)
        const { response } = haggleRound(state, { offer: 4_000, approach, evidenceId: finding.id }, ctx, rng)
        if (response.kind === 'walk') continue
        total += response.kind === 'accept' ? 4_000 : response.price
        n++
      }
      return total / n
    }
    const straight = avg('straight', negCondition, 'genuine')
    const condition = avg('evidence', negCondition, 'genuine')
    const fakeCaught = avg('evidence', negAuth, 'fake')
    expect(condition).toBeLessThan(straight * 0.95)
    expect(fakeCaught).toBeLessThan(condition)
  })

  it('evidence hits knowledgeable sellers harder', () => {
    const floorAfter = (knowledge: number) => {
      let total = 0
      for (let s = 1; s <= 200; s++) {
        const ctx = ctxOf(walkIn('flexible', knowledge))
        const { rng, state } = opening(ctx, s)
        const { state: next } = haggleRound(state, { offer: 3_000, approach: 'evidence', evidenceId: negCondition.id }, ctx, rng)
        total += next.floor / state.floor
      }
      return total / 200
    }
    expect(floorAfter(0.9)).toBeLessThan(floorAfter(0.1))
  })

  it('evidence citing a positive, neutral or missing finding backfires', () => {
    for (let s = 1; s <= 100; s++) {
      for (const t of TEMPERAMENTS) {
        const ctx = ctxOf(walkIn(t, 0.5, 0.5))
        const { state } = opening(ctx, s)
        const offer = Math.round(state.ask * 0.6)
        const straight = haggleRound(state, { offer, approach: 'straight' }, ctx, new Rng(s))
        for (const evidenceId of [posAuth.id, neutral.id, 'no-such-finding', undefined]) {
          const bad = haggleRound(state, { offer, approach: 'evidence', evidenceId }, ctx, new Rng(s))
          expect(bad.state.irritation).toBeGreaterThan(straight.state.irritation)
          expect(bad.state.floor).toBeGreaterThanOrEqual(state.floor)
          if (bad.response.kind === 'counter') {
            // The ask firms: no concession this round.
            expect(bad.response.price).toBe(state.ask)
            expect(['counter.evidenceBackfire', 'counter.lastChance']).toContain(bad.response.lineKey)
          }
        }
      }
    }
  })

  it('citing the same finding twice does nothing the second time', () => {
    const ctx = ctxOf(walkIn('stubborn', 0.5, 0.2))
    const { rng, state } = opening(ctx, 7)
    const move: HaggleMove = { offer: 2_600, approach: 'evidence', evidenceId: negCondition.id }
    const first = haggleRound(state, move, ctx, rng)
    expect(first.response.kind).toBe('counter')
    const second = haggleRound(first.state, move, ctx, rng)
    expect(second.state.floor).toBe(first.state.floor)
    expect(second.state.irritation).toBeGreaterThan(first.state.irritation)
  })

  it('a walk threat lowers the floor for desperate sellers and angers proud ones', () => {
    for (let s = 1; s <= 100; s++) {
      const desperate = ctxOf(walkIn('desperate', 0.5, 0.8))
      const d = opening(desperate, s)
      const threat = haggleRound(d.state, { offer: 2_600, approach: 'walk' }, desperate, d.rng)
      expect(threat.state.floor).toBeLessThan(d.state.floor)

      const proud = ctxOf(walkIn('proud', 0.5, 0.3))
      const p = opening(proud, s)
      const pThreat = haggleRound(p.state, { offer: 6_000, approach: 'walk' }, proud, new Rng(s))
      const pStraight = haggleRound(p.state, { offer: 6_000, approach: 'straight' }, proud, new Rng(s))
      if (pThreat.response.kind === 'walk') expect(pThreat.response.lineKey).toBe('walk.threatCalled')
      else expect(pThreat.state.irritation).toBeGreaterThan(pStraight.state.irritation + 0.2)
      expect(['annoyed', 'insulted']).toContain(pThreat.response.mood)
      expect(pThreat.state.floor).toBeGreaterThanOrEqual(p.state.floor)
    }
  })

  it('sympathy lands with proud and desperate sellers, and costs margin', () => {
    for (let s = 1; s <= 50; s++) {
      for (const t of ['proud', 'desperate'] as const) {
        const ctx = ctxOf(walkIn(t, 0.5, 0.3))
        const { state } = opening(ctx, s)
        const sym = haggleRound(state, { offer: 3_000, approach: 'sympathy' }, ctx, new Rng(s))
        const plain = haggleRound(state, { offer: 3_000, approach: 'straight' }, ctx, new Rng(s))
        expect(sym.state.irritation).toBeLessThan(plain.state.irritation)
        expect(sym.state.floor).toBeGreaterThan(state.floor)
      }
      const stubborn = ctxOf(walkIn('stubborn'))
      const st = opening(stubborn, s)
      const flat = haggleRound(st.state, { offer: 3_000, approach: 'sympathy' }, stubborn, st.rng)
      expect(flat.state.floor).toBe(st.state.floor)
      if (flat.response.kind === 'counter') expect(['counter.sympathyShrug', 'counter.lastChance']).toContain(flat.response.lineKey)
    }
  })

  it('never exceeds maxRounds and always ends', () => {
    for (let s = 1; s <= 500; s++) {
      const { steps, final } = randomHaggle(s)
      expect(final.status).not.toBe('open')
      expect(final.round).toBeLessThanOrEqual(final.maxRounds)
      expect(steps.length).toBe(final.round)
      expect(final.history.length).toBe(final.round)
    }
  })

  it('counters stay between the floor and the previous ask, above the offer', () => {
    for (let s = 1; s <= 500; s++) {
      for (const { before, move, after, response } of randomHaggle(s).steps) {
        expect(after.floor).toBeLessThanOrEqual(after.ask)
        if (response.kind === 'counter') {
          expect(response.price).toBe(after.ask)
          expect(response.price).toBeGreaterThanOrEqual(after.floor)
          expect(response.price).toBeLessThanOrEqual(before.ask)
          expect(response.price).toBeGreaterThan(move.offer)
        }
        if (response.kind === 'accept') expect(response.price).toBe(move.offer)
        if (response.kind === 'walk') expect(response.price).toBe(before.ask)
      }
    }
  })

  it('is deterministic and never mutates its inputs', () => {
    for (let s = 1; s <= 50; s++) {
      const a = randomHaggle(s)
      const b = randomHaggle(s)
      expect(b).toEqual(a)
      for (const { before, move, after } of a.steps) {
        const snapshot = JSON.stringify({ before, move, ctx: a.ctx })
        haggleRound(before, move, a.ctx, new Rng(s))
        expect(JSON.stringify({ before, move, ctx: a.ctx })).toBe(snapshot)
        expect(after).not.toBe(before)
      }
    }
  })

  it('a finished haggle stays finished', () => {
    const { ctx, final } = randomHaggle(3)
    const again = haggleRound(final, { offer: 1, approach: 'straight' }, ctx, new Rng(1))
    expect(again.state).toBe(final)
    expect(again.response).toEqual(final.history[final.history.length - 1]!.response)
  })

  it('only emits line keys that have lines', () => {
    const emitted = new Set<string>()
    for (let s = 1; s <= 2_000; s++) for (const { response } of randomHaggle(s).steps) emitted.add(response.lineKey)
    for (const key of emitted) expect(haggleLines[key], key).toBeDefined()
    // Every temperament's own voice shows up.
    for (const t of TEMPERAMENTS) {
      expect(emitted).toContain(`counter.${t}`)
      expect(emitted).toContain(`accept.${t}`)
    }
  })

  it('has 3–5 lines per key and states prices with {price}', () => {
    for (const [key, lines] of Object.entries(haggleLines)) {
      expect(lines.length, key).toBeGreaterThanOrEqual(3)
      expect(lines.length, key).toBeLessThanOrEqual(5)
      if (key.startsWith('accept.') || key.startsWith('counter.')) {
        for (const line of lines) expect(line, key).toContain('{price}')
      }
    }
  })
})

describe('economy (GDD §3)', () => {
  it('a careful player pays 40–65% of claimedValue on average', () => {
    const { avg, buyRate } = simulate(careful)
    expect(avg).toBeGreaterThan(0.4)
    expect(avg).toBeLessThan(0.65)
    expect(buyRate).toBeGreaterThan(0.5)
  })

  it('a careless player pays 85%+', () => {
    const { avg, buyRate } = simulate(careless)
    expect(avg).toBeGreaterThan(0.85)
    expect(buyRate).toBeGreaterThan(0.9)
  })
})

