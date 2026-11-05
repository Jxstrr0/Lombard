import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeAutosave, deleteCareer, listCareers, loadLatestCareer, saveCareer } from '../src/persist/autosave'
import { reducer } from '../src/game/actions'
import { CURRENT_VERSION } from '../src/game/save/migrations'
import { createInitialState, type GameState } from '../src/game/state'

const career = (id: string, seed = 1, cash?: number): GameState => {
  const s = createInitialState(seed, id)
  return cash === undefined ? s : { ...s, cash }
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  // A fresh, empty database for every test.
  globalThis.indexedDB = new IDBFactory()
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(async () => {
  await closeAutosave()
  vi.restoreAllMocks()
})

/** Write a raw record behind the module's back (to simulate old or corrupt data). */
async function putRaw(record: unknown): Promise<void> {
  const db = await openDB('lombard', 1, {
    upgrade(d) {
      d.createObjectStore('careers', { keyPath: 'careerId' }).createIndex('savedAt', 'savedAt')
    },
  })
  await db.put('careers', record)
  db.close()
}

describe('autosave round trip', () => {
  it('returns null when nothing was saved', async () => {
    expect(await loadLatestCareer()).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })

  it('saves and loads a career', async () => {
    let s = createInitialState(42, 'c-one')
    s = reducer(s, { type: 'day/open' })
    await saveCareer(s)
    expect(await loadLatestCareer()).toEqual(s)
  })

  it('stores the record shape { careerId, savedAt, version, state }', async () => {
    await saveCareer(career('shape'))
    const db = await openDB('lombard')
    const rec = await db.get('careers', 'shape')
    db.close()
    expect(rec).toMatchObject({ careerId: 'shape', version: CURRENT_VERSION })
    expect(typeof rec.savedAt).toBe('number')
    expect(rec.state.meta.careerId).toBe('shape')
  })

  it('saving the same career again overwrites it', async () => {
    await saveCareer(career('same', 1, 100))
    await saveCareer(career('same', 1, 200))
    expect((await loadLatestCareer())?.cash).toBe(200)
    expect(await listCareers()).toHaveLength(1)
  })
})

describe('latest wins', () => {
  it('loads the most recently saved career, even for back-to-back saves', async () => {
    await saveCareer(career('a'))
    await saveCareer(career('b'))
    expect((await loadLatestCareer())?.meta.careerId).toBe('b')
    await saveCareer(career('a', 1, 999))
    const latest = await loadLatestCareer()
    expect(latest?.meta.careerId).toBe('a')
    expect(latest?.cash).toBe(999)
  })

  it('lists careers newest first', async () => {
    await saveCareer(career('a'))
    await saveCareer(career('b'))
    await saveCareer(career('c'))
    expect((await listCareers()).map((c) => c.careerId)).toEqual(['c', 'b', 'a'])
    const [first] = await listCareers()
    expect(first).toMatchObject({ day: 1, date: '2014-03-03', cash: career('c').cash })
  })
})

describe('delete', () => {
  it('removes a career and falls back to the previous one', async () => {
    await saveCareer(career('a'))
    await saveCareer(career('b'))
    await deleteCareer('b')
    expect((await loadLatestCareer())?.meta.careerId).toBe('a')
    await deleteCareer('a')
    expect(await loadLatestCareer()).toBeNull()
  })

  it('deleting a missing career is harmless', async () => {
    await expect(deleteCareer('nope')).resolves.toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
  })

  it('a save queued for the career being deleted does not resurrect it', async () => {
    await saveCareer(career('x'))
    const pending = saveCareer(career('x', 1, 5)) // in flight
    const queuedSave = saveCareer(career('x', 1, 6)) // waiting
    await deleteCareer('x')
    await Promise.all([pending, queuedSave])
    expect(await loadLatestCareer()).toBeNull()
  })
})

describe('corrupt and old records', () => {
  it('skips a corrupt newest record with a warning and returns the older valid one', async () => {
    await saveCareer(career('good', 1, 123))
    await putRaw({ careerId: 'bad', savedAt: Date.now() + 100_000, version: 2, state: { hello: 'world' } })
    const loaded = await loadLatestCareer()
    expect(loaded?.meta.careerId).toBe('good')
    expect(loaded?.cash).toBe(123)
    expect(warn).toHaveBeenCalled()
  })

  it('skips records with a missing or non-object state', async () => {
    await saveCareer(career('good'))
    await putRaw({ careerId: 'no-state', savedAt: Date.now() + 200_000, version: 2 })
    await putRaw({ careerId: 'null-state', savedAt: Date.now() + 300_000, version: 2, state: null })
    await putRaw({ careerId: 'str-state', savedAt: Date.now() + 400_000, version: 2, state: 'oops' })
    expect((await loadLatestCareer())?.meta.careerId).toBe('good')
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it('returns null (not a throw) when every record is corrupt, and leaves them in place', async () => {
    await putRaw({ careerId: 'bad', savedAt: Date.now() + 100_000, version: 2, state: [] })
    expect(await loadLatestCareer()).toBeNull()
    expect(warn).toHaveBeenCalled()
    const db = await openDB('lombard')
    expect(await db.count('careers')).toBe(1)
    db.close()
  })

  it('skips a record from a newer game version', async () => {
    const s = career('future')
    await putRaw({ careerId: 'future', savedAt: Date.now() + 100_000, version: 99, state: { ...s, meta: { ...s.meta, version: 99 } } })
    expect(await loadLatestCareer()).toBeNull()
    expect(warn).toHaveBeenCalled()
  })

  it('migrates an M0 (version 1) record on load', async () => {
    const v1 = {
      meta: { version: 1, seed: 5, careerId: 'm0', rng: 5 },
      calendar: { day: 3, weekday: 2, season: 'spring', date: '2014-03-05' },
      cash: 70_000,
      shop: { slots: [], upgrades: [], security: 0 },
      inventory: [],
      loans: [],
      customers: {},
      queue: [],
      current: null,
      inspect: null,
      haggle: null,
      crime: { heat: 0, pressure: 0, fenceTrust: 0, flags: [] },
      story: { arcs: {}, pendingEvents: [] },
      reputation: { general: 0, byGroup: { neighbourhood: 0, police: 0, mob: 0, specialists: 0 } },
      stats: { customersSeen: 4 },
      settings: { reduceMotion: false, textScale: 1 },
      narration: 'hi',
    }
    await putRaw({ careerId: 'm0', savedAt: Date.now() + 100_000, version: 1, state: v1 })
    const loaded = await loadLatestCareer()
    expect(loaded?.meta).toMatchObject({ careerId: 'm0', version: CURRENT_VERSION, nextId: 1 })
    expect(loaded?.stats.customersSeen).toBe(4)
    expect(loaded?.day.phase).toBe('closed')
  })

  it('listCareers also skips corrupt records', async () => {
    await saveCareer(career('good'))
    await putRaw({ careerId: 'bad', savedAt: Date.now() + 100_000, version: 2, state: {} })
    expect((await listCareers()).map((c) => c.careerId)).toEqual(['good'])
    expect((await listCareers()).map((c) => c.careerId)).not.toContain('bad')
  })
})

describe('write coalescing', () => {
  it('rapid saves collapse to at most two writes and the last state wins', async () => {
    await saveCareer(career('warm')) // open the database first so the count below is only the burst
    const put = vi.spyOn(IDBObjectStore.prototype, 'put')
    const promises = Array.from({ length: 25 }, (_, i) => saveCareer(career('burst', 1, 1000 + i)))
    await Promise.all(promises)
    expect(put.mock.calls.length).toBeLessThanOrEqual(2)
    expect(put.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect((await loadLatestCareer())?.cash).toBe(1024)
  })

  it('a save issued while another is in flight still lands', async () => {
    const first = saveCareer(career('seq', 1, 1))
    await Promise.resolve()
    const second = saveCareer(career('seq', 1, 2))
    await Promise.all([first, second])
    expect((await loadLatestCareer())?.cash).toBe(2)
    // and the writer is free again afterwards
    await saveCareer(career('seq', 1, 3))
    expect((await loadLatestCareer())?.cash).toBe(3)
  })
})

describe('storage failures never throw', () => {
  it('survives indexedDB being unavailable (private mode)', async () => {
    globalThis.indexedDB = {
      open() {
        throw new DOMException('denied', 'SecurityError')
      },
    } as unknown as IDBFactory
    await expect(saveCareer(career('p'))).resolves.toBeUndefined()
    await expect(loadLatestCareer()).resolves.toBeNull()
    await expect(listCareers()).resolves.toEqual([])
    await expect(deleteCareer('p')).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })

  it('survives indexedDB being undefined entirely', async () => {
    // @ts-expect-error simulate a browser with no IndexedDB
    globalThis.indexedDB = undefined
    await expect(saveCareer(career('p'))).resolves.toBeUndefined()
    await expect(loadLatestCareer()).resolves.toBeNull()
  })

  it('survives a quota error on write, then recovers', async () => {
    await saveCareer(career('q', 1, 1))
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await expect(saveCareer(career('q', 1, 2))).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    expect((await loadLatestCareer())?.cash).toBe(1)
    put.mockRestore()
    await saveCareer(career('q', 1, 3))
    expect((await loadLatestCareer())?.cash).toBe(3)
  })

  it('retries opening the database after a failed open', async () => {
    const real = globalThis.indexedDB
    globalThis.indexedDB = {
      open() {
        throw new Error('blocked')
      },
    } as unknown as IDBFactory
    await saveCareer(career('r'))
    globalThis.indexedDB = real
    await saveCareer(career('r', 1, 7))
    expect((await loadLatestCareer())?.cash).toBe(7)
  })
})
