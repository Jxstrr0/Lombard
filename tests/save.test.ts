import { playScene, startedState } from './helpers'
import { deflateSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { tuning } from '../src/data/tuning'
import { reducer, type Action } from '../src/game/actions'
import { checksum, decodeSaveCode, encodeSaveCode, fromBase64Url, leanState, SaveCodeError, toBase64Url } from '../src/game/save/code'
import { CURRENT_VERSION, MIGRATIONS, migrate, SaveFormatError } from '../src/game/save/migrations'
import { createInitialState, STATE_VERSION, type GameState } from '../src/game/state'
import type { ToolId } from '../src/game/schema/item'

// --- scripted play (defensive: reads phase/outcome after every action) ---------

const step = (s: GameState, a: Action) => reducer(s, a)
const norm = (s: GameState): GameState => JSON.parse(JSON.stringify(leanState(s))) as GameState

interface Policy {
  /** Buy the first N customers' items each day, offering this multiple of trueValue (capped by cash). */
  buysPerDay: number
  offerMultiple: number
  /** Every Nth day, keep one newly bought item for good (0 = sell everything). */
  keepEvery: number
  /** Cash top-up at the start of each day so the script can keep buying for 200 days. */
  topUpTo: number
}

const TOOLS: ToolId[] = ['loupe', 'scale', 'magnet']

/** Serve the customer at the counter until the visit is resolved and dismissed. */
function serveCurrent(s0: GameState, wantBuy: boolean, multiple: number, stopAtOffer = false): GameState {
  let s = s0
  for (let guard = 0; guard < 60 && s.current; guard++) {
    const c = s.current
    if (c.phase === 'present' && c.kind === 'redeem') s = step(s, { type: 'loan/return' })
    else if (c.phase === 'scene') s = playScene(s)
    else if (c.phase === 'present') s = step(s, { type: 'counter/inspect' })
    else if (c.phase === 'inspect') {
      for (const tool of TOOLS) s = step(s, { type: 'inspect/useTool', tool })
      s = step(s, { type: 'inspect/done' })
    } else if (c.phase === 'offer') {
      if (stopAtOffer) return s
      const amount = Math.floor(Math.min(c.item!.trueValue * multiple, s.cash))
      if (!wantBuy || amount <= 0) {
        s = step(s, { type: 'counter/pass' })
      } else if (!s.haggle || s.haggle.status === 'open') {
        const before = s
        s = step(s, { type: 'offer/make', amount, approach: 'straight' })
        if (s === before) s = step(s, { type: 'counter/pass' }) // rejected action: do not loop forever
        else if (s.haggle && s.haggle.round >= s.haggle.maxRounds && s.current?.phase === 'offer') s = step(s, { type: 'counter/pass' })
      } else {
        s = step(s, { type: 'counter/pass' })
      }
    } else if (c.phase === 'resolved') s = step(s, { type: 'counter/dismiss' })
    else break
  }
  return s
}

function playDay(s0: GameState, p: Policy, boughtSoFar: { n: number }): GameState {
  let s = s0
  const prevKept = new Set(s0.inventory.map((i) => i.id)) // everything held overnight was kept on purpose
  if (s.cash < p.topUpTo) s = { ...s, cash: p.topUpTo }
  s = step(s, { type: 'day/open' })
  let customer = 0
  for (let guard = 0; guard < 200 && (s.current || s.queue.length > 0); guard++) {
    if (!s.current) {
      s = step(s, { type: 'counter/next' })
      if (!s.current) break
    }
    const had = s.inventory.length
    s = serveCurrent(s, customer < p.buysPerDay, p.offerMultiple)
    if (s.inventory.length > had) boughtSoFar.n++
    customer++
  }
  s = step(s, { type: 'day/close' })
  // Sell everything except items kept earlier, plus (every keepEvery-th day) the first item bought today.
  const keepIds = new Set(prevKept)
  if (p.keepEvery > 0 && s.calendar.day % p.keepEvery === 0) {
    const fresh = s.inventory.find((i) => !prevKept.has(i.id))
    if (fresh) keepIds.add(fresh.id)
  }
  for (const item of s.inventory) if (!keepIds.has(item.id)) s = step(s, { type: 'ledger/sell', itemId: item.id })
  return s
}

function playCareer(days: number, p: Policy, seed = 2024): { state: GameState; bought: number } {
  let s = startedState(seed, 'career-test')
  const bought = { n: 0 }
  for (let d = 0; d < days; d++) s = playDay(s, p, bought)
  return { state: s, bought: bought.n }
}

const POLICY: Policy = { buysPerDay: 2, offerMultiple: 2, keepEvery: 2, topUpTo: 150_000 }

// --- tests --------------------------------------------------------------------

describe('base64url and checksum', () => {
  it('round-trips bytes of every small length', () => {
    for (let len = 0; len < 40; len++) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + len * 11) & 255)
      const text = toBase64Url(bytes)
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/)
      expect(Array.from(fromBase64Url(text))).toEqual(Array.from(bytes))
    }
  })

  it('rejects characters outside the alphabet and impossible lengths', () => {
    expect(() => fromBase64Url('ab$d')).toThrow()
    expect(() => fromBase64Url('abcde')).toThrow()
  })

  it('checksum is fixed width and sensitive to change', () => {
    expect(checksum('abc')).toHaveLength(7)
    expect(checksum('abc')).not.toBe(checksum('abd'))
    expect(checksum('')).toHaveLength(7)
  })
})

describe('save code format', () => {
  const state = playCareer(3, POLICY).state

  it('has the LMB1 prefix, payload and 7-char checksum', () => {
    const code = encodeSaveCode(state)
    expect(code).toMatch(/^LMB1\.[A-Za-z0-9_-]+\.[0-9a-z]{7}$/)
  })

  it('round-trips a fresh state', () => {
    const s = createInitialState(7, 'fresh')
    expect(decodeSaveCode(encodeSaveCode(s))).toEqual(norm(s))
  })

  it('round-trips a played state and is deterministic', () => {
    expect(encodeSaveCode(state)).toBe(encodeSaveCode(state))
    expect(decodeSaveCode(encodeSaveCode(state))).toEqual(norm(state))
  })

  it('does not mutate the state it encodes', () => {
    const before = JSON.stringify(state)
    encodeSaveCode(state)
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('forgiving paste', () => {
  const state = playCareer(2, POLICY).state
  const code = encodeSaveCode(state)
  const expected = norm(state)

  it('ignores surrounding whitespace and tabs', () => {
    expect(decodeSaveCode(`  \n\t${code}\r\n  `)).toEqual(expected)
  })

  it('ignores line breaks inserted anywhere, including mid-payload and before the checksum', () => {
    const wrapped = code.replace(/(.{40})/g, '$1\n')
    expect(decodeSaveCode(wrapped)).toEqual(expected)
    expect(decodeSaveCode(code.replace(/\./g, '\r\n.\r\n'))).toEqual(expected)
    expect(decodeSaveCode(code.split('').join(' '))).toEqual(expected)
  })

  it('ignores smart quotes, brackets and a trailing full stop', () => {
    expect(decodeSaveCode(`“${code}”`)).toEqual(expected)
    expect(decodeSaveCode(`‘${code}’.`)).toEqual(expected)
    expect(decodeSaveCode(`(${code}).`)).toEqual(expected)
    expect(decodeSaveCode(`${code}.`)).toEqual(expected)
    expect(decodeSaveCode(`${code}…`)).toEqual(expected)
  })

  it('finds the code inside a sentence', () => {
    expect(decodeSaveCode(`Here is my save: ${code}  Thanks!`)).toEqual(expected)
  })

  it('restores smart dashes that notes apps substitute for hyphens', () => {
    // Make sure there is at least one hyphen to replace by picking a state whose code has one.
    let probe = code
    for (let seed = 1; !probe.includes('-') && seed < 50; seed++) probe = encodeSaveCode(playCareer(1, POLICY, seed).state)
    expect(probe).toContain('-')
    expect(decodeSaveCode(probe.replace(/-/g, '–'))).toEqual(decodeSaveCode(probe))
    expect(decodeSaveCode(probe.replace(/-/g, '‑'))).toEqual(decodeSaveCode(probe))
  })

  it('accepts an upper- or lower-case prefix and checksum', () => {
    const i = code.lastIndexOf('.')
    expect(decodeSaveCode(code.slice(0, i + 1) + code.slice(i + 1).toUpperCase())).toEqual(expected)
    expect(decodeSaveCode(code.replace(/^LMB1/, 'lmb1'))).toEqual(expected)
  })
})

describe('bad codes fail cleanly', () => {
  const state = playCareer(2, POLICY).state
  const code = encodeSaveCode(state)

  const craft = (json: string): string => {
    const payload = toBase64Url(deflateSync(strToU8(json), { level: 9 }))
    return `LMB1.${payload}.${checksum('LMB1.' + payload)}`
  }

  it('rejects empty, wrong-prefix and arbitrary text', () => {
    expect(() => decodeSaveCode('')).toThrow(SaveCodeError)
    expect(() => decodeSaveCode('   \n ')).toThrow(SaveCodeError)
    expect(() => decodeSaveCode('hello world')).toThrow(/does not look like/)
    expect(() => decodeSaveCode(code.replace('LMB1', 'LMB2'))).toThrow(SaveCodeError)
    expect(() => decodeSaveCode(undefined as unknown as string)).toThrow(SaveCodeError)
  })

  it('rejects every kind of truncation', () => {
    for (const cut of [5, 6, 7, 20, Math.floor(code.length / 2), code.length - 9, code.length - 8, code.length - 1]) {
      expect(() => decodeSaveCode(code.slice(0, cut)), `cut at ${cut}`).toThrow(SaveCodeError)
    }
  })

  it('rejects a single flipped payload character (checksum mismatch)', () => {
    const i = 5 + Math.floor((code.length - 13) / 2)
    const swapped = code[i] === 'A' ? 'B' : 'A'
    const bad = code.slice(0, i) + swapped + code.slice(i + 1)
    expect(() => decodeSaveCode(bad)).toThrow(/checksum/)
  })

  it('rejects a wrong checksum and a dropped middle chunk', () => {
    const i = code.lastIndexOf('.')
    expect(() => decodeSaveCode(code.slice(0, i + 1) + '0000000')).toThrow(/checksum/)
    expect(() => decodeSaveCode(code.slice(0, 60) + code.slice(90))).toThrow(SaveCodeError)
  })

  it('rejects a correct checksum around bad content (bad base64, bad deflate, bad JSON)', () => {
    const badChars = 'LMB1.ab$d'
    const sum = checksum(badChars)
    expect(() => decodeSaveCode(`${badChars}.${sum}`)).toThrow(/unpacked/)
    const junk = toBase64Url(Uint8Array.from({ length: 64 }, (_, i) => (i * 91 + 7) & 255))
    expect(() => decodeSaveCode(`LMB1.${junk}.${checksum('LMB1.' + junk)}`)).toThrow(SaveCodeError)
    expect(() => decodeSaveCode(craft('{not json'))).toThrow(/unreadable/)
  })

  it('rejects valid JSON that is not a career', () => {
    for (const json of ['null', '42', '[]', '{}', '{"meta":{"version":2}}', JSON.stringify({ ...norm(state), cash: 'rich' })]) {
      expect(() => decodeSaveCode(craft(json)), json).toThrow(/not a valid Lombard career/)
    }
  })

  it('rejects a save from a newer version with a friendly message', () => {
    const future = { ...norm(state), meta: { ...state.meta, version: CURRENT_VERSION + 1 } }
    expect(() => decodeSaveCode(craft(JSON.stringify(future)))).toThrow(/newer version/)
  })

  it('refuses absurdly long input without trying to decode it', () => {
    expect(() => decodeSaveCode('LMB1.' + 'A'.repeat(tuning.save.maxCodeChars + 1))).toThrow(/too long/)
  })

  it('refuses a decompression bomb', () => {
    const bomb = craft(' '.repeat(tuning.save.maxInflatedBytes + 100))
    expect(bomb.length).toBeLessThan(tuning.save.maxCodeChars)
    expect(() => decodeSaveCode(bomb)).toThrow(SaveCodeError)
  })
})

describe('size and continuity', () => {
  it('a 200-day career stays under 20,000 characters', () => {
    const { state, bought } = playCareer(200, POLICY)
    const code = encodeSaveCode(state)
    console.log(`200 days: ${code.length} chars, inventory ${state.inventory.length}, bought ${bought}, history ${state.history.length}, json ${JSON.stringify(state).length} bytes`)
    expect(state.calendar.day).toBe(201)
    expect(code.length).toBeLessThan(20_000)
    expect(decodeSaveCode(code)).toEqual(norm(state))
  })

  it('a hoarding career (keeps an item every day) round-trips', () => {
    const { state } = playCareer(200, { ...POLICY, keepEvery: 1 })
    const code = encodeSaveCode(state)
    console.log(`200 days, keeping one item a day: ${code.length} chars, inventory ${state.inventory.length}`)
    expect(decodeSaveCode(code)).toEqual(norm(state))
  })

  it('history is capped by tuning in the encoded state', () => {
    const { state } = playCareer(70, POLICY)
    expect(state.history.length).toBeLessThanOrEqual(tuning.save.historyDays)
    const long = { ...state, history: [...state.history, ...state.history, ...state.history] }
    expect(decodeSaveCode(encodeSaveCode(long)).history).toHaveLength(tuning.save.historyDays)
  })

  it('a decoded state keeps playing identically (day boundary)', () => {
    const { state } = playCareer(5, POLICY)
    const decoded = decodeSaveCode(encodeSaveCode(state))
    const bought = { n: 0 }
    const a = playDay(playDay(state, POLICY, bought), POLICY, bought)
    const b = playDay(playDay(decoded, POLICY, bought), POLICY, bought)
    expect(b).toEqual(norm(a))
  })

  it('a code copied mid-day, mid-visit continues identically', () => {
    for (const stopAtOffer of [false, true]) {
      let s = playCareer(4, POLICY).state
      s = step(s, { type: 'day/open' })
      s = step(s, { type: 'counter/next' })
      s = step(s, { type: 'counter/inspect' })
      s = step(s, { type: 'inspect/useTool', tool: 'loupe' })
      if (stopAtOffer) {
        s = step(s, { type: 'inspect/done' })
        s = step(s, { type: 'offer/estimate', value: 1000 })
        s = step(s, { type: 'offer/make', amount: 1, approach: 'straight' })
      }
      expect(s.current).not.toBeNull()
      const decoded = decodeSaveCode(encodeSaveCode(s))
      expect(decoded).toEqual(norm(s))

      // Finish this visit and the rest of the day from both states.
      const finish = (from: GameState): GameState => {
        let t = serveCurrent(from, true, 2)
        for (let guard = 0; guard < 100 && (t.current || t.queue.length > 0); guard++) {
          if (!t.current) t = step(t, { type: 'counter/next' })
          if (!t.current) break
          t = serveCurrent(t, true, 2)
        }
        return step(t, { type: 'day/close' })
      }
      expect(norm(finish(decoded))).toEqual(norm(finish(s)))
    }
  })
})

describe('migrations', () => {
  /** An M0 (STATE_VERSION 1) save, as the shipped M0 build produced it. */
  const v1 = () => ({
    meta: { version: 1, seed: 123, careerId: 'old-career', rng: 987654 },
    calendar: { day: 4, weekday: 3, season: 'spring', date: '2014-03-06' },
    cash: 61_500,
    shop: { slots: [], upgrades: [], security: 0 },
    inventory: [],
    loans: [],
    customers: {},
    queue: [],
    current: { customerName: 'Old Man Petrov', line: 'Morning.' },
    inspect: { itemId: 'x' },
    haggle: { round: 2 },
    crime: { heat: 0, pressure: 0, fenceTrust: 0, flags: [] },
    story: { arcs: {}, pendingEvents: [] },
    reputation: { general: 3, byGroup: { neighbourhood: 1, police: 0, mob: 0, specialists: 0 } },
    stats: { customersSeen: 17 },
    settings: { reduceMotion: true, textScale: 1.25 },
    narration: 'Quiet morning.',
  })

  it('chain is contiguous and ends at the current version', () => {
    expect(CURRENT_VERSION).toBe(STATE_VERSION)
    expect(MIGRATIONS[0]?.from).toBe(1)
    MIGRATIONS.forEach((m, i) => {
      expect(m.to).toBe(m.from + 1)
      if (i > 0) expect(m.from).toBe(MIGRATIONS[i - 1]?.to)
    })
    expect(MIGRATIONS[MIGRATIONS.length - 1]?.to).toBe(CURRENT_VERSION)
  })

  it('upgrades an M0 save to the current shape with sensible defaults', () => {
    const s = migrate(v1())
    expect(s.meta).toEqual({ version: CURRENT_VERSION, seed: 123, careerId: 'old-career', rng: 987654, nextId: 1, intro: false })
    expect(s.calendar.day).toBe(4)
    expect(s.cash).toBe(61_500)
    expect(s.current).toBeNull()
    expect(s.inspect).toBeNull()
    expect(s.haggle).toBeNull()
    expect(s.queue).toEqual([])
    expect(s.paid).toEqual({})
    expect(s.history).toEqual([])
    expect(s.day).toEqual({ phase: 'closed', clock: 0, served: 0, total: 0, openingCash: 61_500, log: [], newsRead: true })
    expect(s.stats).toEqual({ ...createInitialState(1, 'x').stats, customersSeen: 17 })
    expect(s.settings).toEqual({ reduceMotion: true, textScale: 1.25 })
    expect(s.reputation.general).toBe(3)
    expect(s.narration).toBe('Quiet morning.')
  })

  it('does not mutate its input', () => {
    const raw = v1()
    const copy = JSON.stringify(raw)
    migrate(raw)
    expect(JSON.stringify(raw)).toBe(copy)
  })

  it('an upgraded M0 save is playable and encodes/decodes', () => {
    const s = migrate(v1())
    const opened = reducer(s, { type: 'day/open' })
    expect(opened.day.phase).toBe('open')
    expect(opened.queue.length).toBeGreaterThan(0)
    expect(decodeSaveCode(encodeSaveCode(s))).toEqual(norm(s))
  })

  it('an old v1 save code still loads', () => {
    const payload = toBase64Url(deflateSync(strToU8(JSON.stringify(v1())), { level: 9 }))
    const code = `LMB1.${payload}.${checksum('LMB1.' + payload)}`
    const s = decodeSaveCode(code)
    expect(s.meta.version).toBe(CURRENT_VERSION)
    expect(s.meta.careerId).toBe('old-career')
  })

  it('prices carried-over M0 inventory at true value so profit starts neutral', () => {
    const raw = v1() as Record<string, unknown>
    raw.inventory = [{ id: 'i1', defId: 'gold-ring', condition: 80, authenticity: 'genuine', provenance: 'clean', trueValue: 5000, revealed: [], story: 's' }]
    expect(migrate(raw).paid).toEqual({ i1: 5000 })
  })

  it('current-version saves pass through unchanged', () => {
    const s = playCareer(2, POLICY).state
    expect(migrate(norm(s))).toEqual(norm(s))
  })

  it('throws SaveFormatError for garbage', () => {
    for (const bad of [null, undefined, 5, 'str', [], {}, { meta: {} }, { meta: { version: 'two' } }, { meta: { version: 0 } }, { meta: { version: 1.5 } }]) {
      expect(() => migrate(bad), JSON.stringify(bad)).toThrow(SaveFormatError)
    }
    // right version, missing keys
    expect(() => migrate({ meta: { version: 1, seed: 1, careerId: 'a', rng: 1 } })).toThrow(SaveFormatError)
    expect(() => migrate({ ...v1(), cash: 'lots' })).toThrow(SaveFormatError)
    const broken = norm(createInitialState(1, 'a')) as unknown as Record<string, unknown>
    delete broken.day
    expect(() => migrate(broken)).toThrow(SaveFormatError)
  })

  it('throws a "future" SaveFormatError for newer versions', () => {
    const future = { ...norm(createInitialState(1, 'a')), meta: { ...createInitialState(1, 'a').meta, version: CURRENT_VERSION + 1 } }
    try {
      migrate(future)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(SaveFormatError)
      expect((e as SaveFormatError).kind).toBe('future')
    }
  })
})

describe('v2 → v3 (M2)', () => {
  it('an M1 mid-career save gains M2 defaults and keeps playing', () => {
    // Build a v2-shaped record by stripping the M2 fields from a played state.
    let s = startedState(77, 'm1-career')
    s = reducer(s, { type: 'day/open' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately untyped old-shape record
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, any>
    raw.meta.version = 2
    delete raw.meta.intro
    raw.shop = { slots: [], upgrades: [], security: 0 }
    delete raw.specialists
    delete raw.market
    delete raw.day.newsRead
    for (const v of raw.queue) {
      delete v.kind
      delete v.wants
    }
    const m = migrate(raw)
    expect(m.meta.intro).toBe(false)
    expect(m.shop.name).toBe('Lombard No. 7')
    expect(m.shop.slots.length).toBeGreaterThan(0)
    expect(m.queue.every((v) => v.kind === 'seller' && v.wants === 'sell')).toBe(true)
    const next = reducer(m, { type: 'counter/next' })
    expect(next.current?.kind).toBe('seller')
  })
})
