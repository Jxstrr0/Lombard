/**
 * Save migrations across every past state version (M6).
 *
 * tests/fixtures/saves holds one mid-career save per STATE_VERSION, each made by
 * the last build of that version playing its own reducer with its own sim policy
 * (src/sim/policies.ts of that build; M0 and M1 had none, so a scripted counter),
 * plus a few choices of the player's own (upgrades, specialists on retainer):
 *
 *   v1  b1dface  M0 skeleton             day 1, a visitor at the counter (M0 had no autosave or save code: bare state)
 *   v2  df0d093  M1 counter loop         day 12, mid-haggle
 *   v3  c7c1b26  M2/M3 shop and loans    day 30, mid-haggle, renamed shop, jeweler retained
 *   v4  18d879a  M4 story engine         day 39, closed, two specialists
 *   v5  3bcb7e4  M4 reputation, slots    day 34, mid-haggle, slot 2, two specialists
 *   v6  7dce5db  M4 specialists' arcs    day 51, closed, slot 1
 *   v7  a32178e  M4 story pledges        day 47, a story scene playing at the counter, slot 3
 *   v8  a7e8c39  M5 crime, M6 flood      day 65, closed, slot 1 (fence-friendly player, after the flood)
 *   v9  current  M6 appraiser            day 71, a scene at the counter and one in the line, slot 2, appraiser hired
 *
 * vN.autosave.json is the IndexedDB record that build's autosave wrote
 * ({ careerId, savedAt, version, state, slot? }); vN.code.txt is the save code
 * that build's encoder made. The save-code format (LMB1, deflate, FNV-1a) has not
 * changed since M1, so every code goes through the same decoder. item-ids.json
 * lists every item def id each of those builds shipped.
 *
 * Fixtures are frozen history: never regenerate an old one. A GameState change
 * bumps STATE_VERSION, adds a migration and adds a fixture (docs/02-ARCHITECTURE.md § Save).
 */
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ITEM_DEFS, getItemDef } from '../src/data/items'
import { getRegular } from '../src/data/regulars'
import { decodeSaveCode, encodeSaveCode, leanState, SaveCodeError, checksum, SAVE_CODE_PREFIX, toBase64Url } from '../src/game/save/code'
import { CURRENT_VERSION, GameStateShape, migrate, SaveFormatError } from '../src/game/save/migrations'
import { STATE_VERSION, type GameState } from '../src/game/state'
import { closeAutosave, listSlots, loadLatestCareer, loadSlot } from '../src/persist/autosave'
import { APPRAISER_ID } from '../src/game/staff/appraiser'
import { careful } from '../src/sim/policies'
import { simulate } from '../src/sim/simulate'
import { deflateSync, strToU8 } from 'fflate'

type Raw = Record<string, unknown> & {
  meta: { version: number; careerId: string }
  cash: number
  calendar: { day: number; date: string }
  inventory: { id: string; defId: string }[]
  loans: { id?: string; itemId?: string; principal: number }[]
  reputation: { general: number; byGroup: Record<string, number> }
}

interface Fixture {
  version: number
  state: Raw
  record: { careerId: string; savedAt: number; version: number; state: Raw; slot?: number } | null
  code: string | null
}

const dir = new URL('./fixtures/saves/', import.meta.url)
const read = (name: string) => readFileSync(new URL(name, dir), 'utf8')

function loadFixture(version: number): Fixture {
  if (version === 1) return { version, state: JSON.parse(read('v1.state.json')) as Raw, record: null, code: null }
  const record = JSON.parse(read(`v${version}.autosave.json`)) as NonNullable<Fixture['record']>
  return { version, state: record.state, record, code: read(`v${version}.code.txt`).trim() }
}

const VERSIONS = Array.from({ length: STATE_VERSION }, (_, i) => i + 1)
const FIXTURES = VERSIONS.map(loadFixture)
/** A fresh deep copy, so no test can leak a mutation into another. */
const rawOf = (f: Fixture): Raw => structuredClone(f.state)

/** Every string under a `defId` key, anywhere in the save. */
function defIds(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) for (const x of v) defIds(x, out)
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (k === 'defId' && typeof x === 'string') out.add(x)
      else defIds(x, out)
    }
  }
  return out
}

/** Every item instance (has id, defId and authenticity) anywhere in the save. */
function itemInstances(v: unknown, out: { defId: string; fakeProfileId?: string }[] = []) {
  if (Array.isArray(v)) for (const x of v) itemInstances(x, out)
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.defId === 'string' && typeof o.id === 'string' && typeof o.authenticity === 'string') {
      out.push({ defId: o.defId, fakeProfileId: typeof o.fakeProfileId === 'string' ? o.fakeProfileId : undefined })
    }
    for (const x of Object.values(o)) itemInstances(x, out)
  }
  return out
}

describe('fixtures', () => {
  it('there is one per state version, v1 to the current one, each at its version', () => {
    expect(FIXTURES.map((f) => f.state.meta.version)).toEqual(VERSIONS)
    for (const f of FIXTURES) if (f.record) expect(f.record.version).toBe(f.version)
  })

  it('the current fixture is at the current version', () => {
    expect(FIXTURES.at(-1)!.version).toBe(CURRENT_VERSION)
  })
})

describe.each(FIXTURES)('v$version save', (fixture) => {
  const raw = rawOf(fixture)
  let migrated: GameState

  it('migrates to the current version without throwing', () => {
    migrated = migrate(rawOf(fixture))
    expect(migrated.meta.version).toBe(CURRENT_VERSION)
  })

  it('does not mutate the stored save', () => {
    const before = JSON.stringify(fixture.state)
    migrate(fixture.state)
    expect(JSON.stringify(fixture.state)).toBe(before)
  })

  it('passes the current schema', () => {
    const result = GameStateShape.safeParse(migrated)
    expect(result.success, result.error?.message).toBe(true)
  })

  it('keeps cash, day, date, stock, open loans and reputation', () => {
    expect(migrated.cash).toBe(raw.cash)
    expect(migrated.calendar.day).toBe(raw.calendar.day)
    expect(migrated.calendar.date).toBe(raw.calendar.date)
    expect(migrated.meta.careerId).toBe(raw.meta.careerId)
    expect(migrated.inventory.map((i) => i.id)).toEqual(raw.inventory.map((i) => i.id))
    expect(migrated.inventory.map((i) => i.defId)).toEqual(raw.inventory.map((i) => i.defId))
    // v1/v2 loans were placeholders nothing could create; v2→v3 drops them by design. These saves hold none.
    expect(migrated.loans.length).toBe(raw.loans.length)
    expect(migrated.loans.map((l) => l.principal)).toEqual(raw.loans.map((l) => l.principal))
    expect(migrated.reputation.general).toBe(raw.reputation.general)
    for (const [group, value] of Object.entries(raw.reputation.byGroup)) expect(migrated.reputation.byGroup[group as never]).toBe(value)
    if (fixture.version < 5) expect(migrated.reputation.byGroup.youth).toBe(0)
  })

  it('keeps what that era had: shop, regulars, story flags, crime and staff', () => {
    if (fixture.version >= 3) {
      const shop = raw.shop as GameState['shop']
      expect(migrated.shop.name).toBe(shop.name)
      expect(migrated.shop.prices).toEqual(shop.prices)
      expect(migrated.shop.slots).toEqual(shop.slots)
      expect(Object.keys(migrated.specialists)).toEqual(Object.keys(raw.specialists as object))
    } else {
      // Before M2 there were no display slots: all stock starts in the safe.
      expect(migrated.shop.slots.every((s) => s.itemId === null)).toBe(true)
    }
    if (fixture.version >= 4) {
      const story = raw.story as GameState['story']
      expect(migrated.story.flags).toEqual(story.flags)
      expect(Object.keys(migrated.story.arcs)).toEqual(Object.keys(story.arcs))
      expect(migrated.customers).toEqual(raw.customers)
    }
    if (fixture.version >= 8) {
      expect(migrated.crime).toEqual(raw.crime)
      expect(migrated.career).toEqual(raw.career)
    }
    if (fixture.version >= 9) expect(migrated.staff).toEqual(raw.staff)
    else expect(migrated.staff.hired).toBe(false)
  })

  it('plays on for a few days through the simulator', () => {
    const days = 5
    const run = simulate(fixture.version, careful, days, { from: migrate(rawOf(fixture)) })
    expect(run.days).toHaveLength(days)
    expect(run.end).toBeNull()
    // Closed saves start with the next day's opening, mid-day saves finish today first: either way days N … N+4.
    expect(run.days.map((d) => d.day)).toEqual(Array.from({ length: days }, (_, i) => raw.calendar.day + i))
    expect(Number.isFinite(run.finalCash)).toBe(true)
    expect(run.stats.customersSeen).toBeGreaterThan((raw.stats as { customersSeen: number }).customersSeen)
  })

  it('holds only item defs and regulars the current catalogue still has', () => {
    for (const id of defIds(raw)) expect(() => getItemDef(id), id).not.toThrow()
    for (const item of itemInstances(raw)) {
      if (!item.fakeProfileId) continue
      expect(getItemDef(item.defId).fakeProfiles.map((p) => p.id), `${item.defId}/${item.fakeProfileId}`).toContain(item.fakeProfileId)
    }
    // Regulars' memory, plus the appraiser's trust (v9, staff/appraiser.ts keeps it there too).
    if (fixture.version >= 4) for (const id of Object.keys(raw.customers as object)) expect(getRegular(id) !== undefined || id === APPRAISER_ID, id).toBe(true)
  })

  it('round-trips through a save code made on the current build', () => {
    const state = migrate(rawOf(fixture))
    const norm = JSON.parse(JSON.stringify(leanState(state))) as GameState
    expect(decodeSaveCode(encodeSaveCode(state))).toEqual(norm)
  })
})

// M0 had no save code, so v1 has none.
describe.each(FIXTURES.filter((f) => f.code !== null))('v$version save code', (fixture) => {
  it('decodes on the current build to the same career as its autosave', () => {
    const decoded = decodeSaveCode(fixture.code!)
    const expected = JSON.parse(JSON.stringify(migrate(rawOf(fixture)))) as GameState
    const { history: h1, ...restDecoded } = decoded
    const { history: h2, ...restExpected } = expected
    expect(restDecoded).toEqual(restExpected)
    // The encoder may trim old day summaries (tuning.save.historyDays); the rest is identical.
    expect(h1).toEqual(h2.slice(-h1.length))
  })
})

describe('what particular steps fill in', () => {
  it('v5→v6 counts the month ends each retained specialist has been billed for', () => {
    // v5: 2014-04-05 (day 34), jeweler since day 3 (Mar 5), collector since day 14 (Mar 16): one month end each (Mar 31).
    const raw = rawOf(FIXTURES[4]!)
    expect(raw.calendar.date).toBe('2014-04-05')
    const sp = migrate(raw).specialists
    expect(Object.fromEntries(Object.entries(sp).map(([id, s]) => [id, [s.sinceDay, s.months]]))).toEqual({ jeweler: [3, 1], collector: [14, 1] })
    for (const s of Object.values(sp)) expect(s).toMatchObject({ events: {}, mods: {}, lowballed: [] })
  })

  it('v7→v8 seeds the ending axes from the heart.* and dirty.* choices already made', () => {
    const raw = rawOf(FIXTURES[6]!)
    expect((raw.story as { flags: string[] }).flags).toContain('heart.gennady_kolya')
    expect(migrate(raw).career).toEqual({ axes: { clean: 0, heart: 1 }, end: null })
  })

  it('v2→v3 starts an M1 career past the intro, its stock in the safe and untagged', () => {
    const m = migrate(rawOf(FIXTURES[1]!))
    expect(m.meta.intro).toBe(false)
    expect(m.shop.prices).toEqual({})
    expect(m.current?.kind).toBe('seller') // saved mid-haggle, still mid-haggle
    expect(m.haggle?.status).toBe('open')
  })
})

// --- the item catalogue -------------------------------------------------------------

describe('item catalogue', () => {
  /** Every def id each era's build shipped (src/data/items of the commits above). */
  const eraIds = JSON.parse(read('item-ids.json')) as Record<string, string[]>
  const current = new Set(ITEM_DEFS.map((d) => d.id))

  it.each(Object.entries(eraIds).filter(([, ids]) => ids.length > 0))('every def the %s build had is still in the catalogue', (_, ids) => {
    expect(ids.filter((id) => !current.has(id))).toEqual([])
  })

  it('has grown, never shrunk', () => {
    const sizes = Object.values(eraIds).map((ids) => ids.length)
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
    expect(ITEM_DEFS.length).toBeGreaterThanOrEqual(sizes.at(-1)!)
  })
})

// --- bad input -------------------------------------------------------------------

const current = () => rawOf(FIXTURES.at(-1)!)

/** The message must be a sentence for a person, not a stack trace or "undefined". */
function expectReadable(err: unknown, kind: typeof SaveFormatError | typeof SaveCodeError): string {
  expect(err).toBeInstanceOf(kind)
  const msg = (err as Error).message
  expect(msg.length).toBeGreaterThan(10)
  expect(msg).not.toMatch(/\[object|\n\s+at |TypeError|ReferenceError/)
  return msg
}

function thrown(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  throw new Error('expected a throw')
}

/** A code with a valid checksum around any payload bytes (so the checksum is not what catches it). */
function codeAround(bytes: Uint8Array): string {
  const payload = toBase64Url(bytes)
  return `${SAVE_CODE_PREFIX}${payload}.${checksum(SAVE_CODE_PREFIX + payload)}`
}
const codeOf = (value: unknown) => codeAround(deflateSync(strToU8(JSON.stringify(value)), { level: 9 }))

describe('bad input fails cleanly', () => {
  it('a save from a newer build: a "future" SaveFormatError naming both versions', () => {
    const raw = current()
    raw.meta = { ...raw.meta, version: CURRENT_VERSION + 1 }
    const err = thrown(() => migrate(raw)) as SaveFormatError
    const msg = expectReadable(err, SaveFormatError)
    expect(err.kind).toBe('future')
    expect(msg).toContain(String(CURRENT_VERSION + 1))
    expect(msg).toContain(String(CURRENT_VERSION))
  })

  it('a save code from a newer build asks the player to update', () => {
    const raw = current()
    raw.meta = { ...raw.meta, version: CURRENT_VERSION + 1 }
    expect(expectReadable(thrown(() => decodeSaveCode(codeOf(raw))), SaveCodeError)).toMatch(/newer version/)
  })

  it('an empty object, null, an array, a string, a bad version', () => {
    for (const bad of [{}, null, [], 'save', 42, { meta: {} }, { meta: { version: 0 } }, { meta: { version: 2.5 } }, { meta: { version: '9' } }]) {
      expectReadable(thrown(() => migrate(bad)), SaveFormatError)
    }
    expectReadable(thrown(() => decodeSaveCode(codeOf({}))), SaveCodeError)
  })

  it('a save at a known version with parts missing is "damaged", not a crash', () => {
    for (const fixture of FIXTURES) {
      const raw = rawOf(fixture)
      delete (raw as Record<string, unknown>).inventory
      expect(expectReadable(thrown(() => migrate(raw)), SaveFormatError)).toMatch(/damaged|upgraded/)
    }
    const raw = current()
    ;(raw as Record<string, unknown>).cash = 'lots'
    expect(expectReadable(thrown(() => migrate(raw)), SaveFormatError)).toMatch(/damaged \(cash/)
  })

  it('a seller with no item is damaged; a story scene with no item is not', () => {
    const v7 = rawOf(FIXTURES[6]!) // saved with a scene playing at the counter
    expect((v7.current as { kind: string }).kind).toBe('scene')
    expect(() => migrate(rawOf(FIXTURES[6]!))).not.toThrow()
    const raw = current() // a scene waiting in the line
    const queue = raw.queue as { kind: string; item?: unknown }[]
    expect(queue.some((q) => q.kind === 'scene' && q.item === undefined)).toBe(true)
    const seller = queue.findIndex((q) => q.kind === 'seller')
    delete queue[seller]!.item
    expect(expectReadable(thrown(() => migrate(raw)), SaveFormatError)).toMatch(`damaged (queue.${seller}.item`)
  })

  it('corrupt codes: edited, cut off, empty, not a code, valid checksum around garbage', () => {
    const code = FIXTURES.at(-1)!.code!
    const mid = Math.floor(code.length / 2)
    const edited = code.slice(0, mid) + (code[mid] === 'A' ? 'B' : 'A') + code.slice(mid + 1)
    const cases = [
      edited,
      code.slice(0, mid),
      code.slice(0, -3),
      '',
      '   ',
      'hello, this is my save',
      'LMB1.',
      'LMB1.abc',
      codeAround(new Uint8Array([1, 2, 3, 4, 5])), // not deflate
      codeAround(deflateSync(strToU8('{"meta":'))), // not JSON
      codeOf([1, 2, 3]),
      codeOf({ meta: { version: 3 } }),
    ]
    for (const bad of cases) expectReadable(thrown(() => decodeSaveCode(bad)), SaveCodeError)
    expect(() => decodeSaveCode(undefined as unknown as string)).toThrow(SaveCodeError)
  })
})

// --- the autosave path -------------------------------------------------------------

describe('autosave records from every era', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(async () => {
    await closeAutosave()
    vi.restoreAllMocks()
  })

  const openRaw = () =>
    openDB('lombard', 1, {
      upgrade(d) {
        d.createObjectStore('careers', { keyPath: 'careerId' }).createIndex('savedAt', 'savedAt')
      },
    })

  async function putRaw(...records: unknown[]): Promise<void> {
    const db = await openRaw()
    for (const r of records) await db.put('careers', r)
    db.close()
  }

  async function allRaw(): Promise<{ careerId: string; state: unknown }[]> {
    const db = await openRaw()
    const all = (await db.getAll('careers')) as { careerId: string; state: unknown }[]
    db.close()
    return all
  }

  const withRecord = FIXTURES.filter((f) => f.record)

  it.each(withRecord)('the v$version record loads as the latest career', async (fixture) => {
    await putRaw(structuredClone(fixture.record))
    const loaded = await loadLatestCareer()
    expect(loaded?.meta.version).toBe(CURRENT_VERSION)
    expect(loaded?.cash).toBe(fixture.state.cash)
    expect(loaded?.calendar.day).toBe(fixture.state.calendar.day)
  })

  it('an unreadable record never stops the others loading and is never deleted', async () => {
    const good = structuredClone(FIXTURES[2]!.record!) // v3
    const future = structuredClone(FIXTURES.at(-1)!.record!)
    future.careerId = 'from-the-future'
    future.state.meta = { ...future.state.meta, careerId: 'from-the-future', version: CURRENT_VERSION + 1 }
    future.savedAt = good.savedAt + 2
    future.slot = 2
    const empty = { careerId: 'empty', savedAt: good.savedAt + 3, version: 9, state: {}, slot: 3 }
    const junk = { careerId: 'junk', savedAt: good.savedAt + 4, version: 4, state: 'not a state' }
    await putRaw({ ...good, slot: 1 }, future, empty, junk)
    const before = JSON.stringify(await allRaw())

    const latest = await loadLatestCareer()
    expect(latest?.meta.careerId).toBe(good.careerId)
    expect((await loadSlot(1))?.cash).toBe(good.state.cash)
    expect(await loadSlot(2)).toBeNull()
    const slots = await listSlots()
    expect(slots.map((s) => [s.career !== null, s.damaged])).toEqual([
      [true, false],
      [false, true],
      [false, true],
    ])

    // Every record is still there, byte for byte (the slotless junk got no slot: all three are taken).
    const after = await allRaw()
    expect(after.map((r) => r.careerId).sort()).toEqual(['empty', 'from-the-future', 'junk', good.careerId].sort())
    expect(JSON.stringify(after)).toBe(before)
  })
})
