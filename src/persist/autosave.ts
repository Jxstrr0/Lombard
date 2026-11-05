/**
 * Browser persistence: IndexedDB autosave of the career, via `idb`.
 *
 * Database `lombard`, object store `careers` keyed by `careerId`, index
 * `savedAt`. Nothing here ever throws to callers: private mode, quota errors
 * and blocked upgrades are logged with console.warn and surface as a null /
 * empty result. M1 has a single active career; slots are M4.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { migrate } from '../game/save/migrations'
import type { GameState } from '../game/state'

const DB_NAME = 'lombard'
const DB_VERSION = 1
const STORE = 'careers'

export interface CareerRecord {
  careerId: string
  savedAt: number
  /** state.meta.version at save time (the state is migrated again on load). */
  version: number
  state: GameState
}

interface LombardDB extends DBSchema {
  careers: {
    key: string
    value: CareerRecord
    indexes: { savedAt: number }
  }
}

/** What the settings screen needs to list careers without holding every state. */
export interface CareerSummary {
  careerId: string
  savedAt: number
  day: number
  date: string
  cash: number
}

// --- connection ---------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase<LombardDB>> | null = null

function getDb(): Promise<IDBPDatabase<LombardDB>> {
  if (!dbPromise) {
    const opening = openDB<LombardDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'careerId' })
        store.createIndex('savedAt', 'savedAt')
      },
      blocked() {
        console.warn('Lombard: autosave database upgrade is blocked by another tab')
      },
      blocking() {
        // Another tab wants to upgrade: let go so it can.
        void opening.then((db) => db.close()).catch(() => {})
        dbPromise = null
      },
      terminated() {
        dbPromise = null
      },
    })
    dbPromise = opening
    // A failed open must not be cached forever (e.g. a blocked upgrade that later clears).
    opening.catch(() => {
      if (dbPromise === opening) dbPromise = null
    })
  }
  return dbPromise
}

/** Close the cached connection (tests, or before deleting the whole database). */
export async function closeAutosave(): Promise<void> {
  const pending = dbPromise
  dbPromise = null
  if (!pending) return
  try {
    ;(await pending).close()
  } catch {
    /* never opened */
  }
}

function warn(what: string, err: unknown): void {
  console.warn(`Lombard: autosave ${what} failed`, err)
}

// --- save (coalesced) ---------------------------------------------------------

let lastSavedAt = 0
let writer: Promise<void> | null = null
let queued: GameState | null = null

async function writeOne(state: GameState): Promise<void> {
  try {
    const db = await getDb()
    // Strictly increasing, so "latest wins" holds even for two saves in the same millisecond.
    const savedAt = Math.max(Date.now(), lastSavedAt + 1)
    lastSavedAt = savedAt
    await db.put(STORE, { careerId: state.meta.careerId, savedAt, version: state.meta.version, state })
  } catch (err) {
    warn('save', err)
  }
}

async function drain(): Promise<void> {
  try {
    // While a write is in flight, newer saves only replace `queued`: at most one write waits.
    while (queued) {
      const next = queued
      queued = null
      await writeOne(next)
    }
  } finally {
    writer = null // same tick as the loop's final check, so no save can be stranded
  }
}

/**
 * Save the career. Resolves once this state, or a newer one that replaced it
 * while waiting, has been written (or the attempt failed; failures are warned,
 * never thrown). Rapid calls coalesce: at most one write is in flight and one
 * waiting.
 */
export function saveCareer(state: GameState): Promise<void> {
  queued = state
  writer ??= drain()
  return writer
}

// --- load ---------------------------------------------------------------------

/** Migrate a stored record, or null (with a warning) if it is unusable. */
function readRecord(rec: unknown): GameState | null {
  try {
    if (typeof rec !== 'object' || rec === null) throw new Error('record is not an object')
    return migrate((rec as { state?: unknown }).state)
  } catch (err) {
    console.warn(`Lombard: skipping unreadable save record ${String((rec as { careerId?: unknown } | null)?.careerId)}`, err)
    return null
  }
}

/** The most recently saved readable career, or null. Corrupt records are skipped, not deleted. */
export async function loadLatestCareer(): Promise<GameState | null> {
  try {
    const db = await getDb()
    let cursor = await db.transaction(STORE).store.index('savedAt').openCursor(null, 'prev')
    while (cursor) {
      const state = readRecord(cursor.value)
      if (state) return state
      cursor = await cursor.continue()
    }
    return null
  } catch (err) {
    warn('load', err)
    return null
  }
}

/** Every readable career, newest first. For the settings screen; M1 shows only the first. */
export async function listCareers(): Promise<CareerSummary[]> {
  try {
    const db = await getDb()
    const records = await db.getAllFromIndex(STORE, 'savedAt')
    const out: CareerSummary[] = []
    for (const rec of records.reverse()) {
      const state = readRecord(rec)
      if (state) {
        out.push({ careerId: rec.careerId, savedAt: rec.savedAt, day: state.calendar.day, date: state.calendar.date, cash: state.cash })
      }
    }
    return out
  } catch (err) {
    warn('list', err)
    return []
  }
}

export async function deleteCareer(careerId: string): Promise<void> {
  // Drop a queued save of this career so it cannot resurrect it after the delete.
  if (queued?.meta.careerId === careerId) queued = null
  try {
    // Let an in-flight write finish first so the delete is the last word.
    await writer
    const db = await getDb()
    await db.delete(STORE, careerId)
  } catch (err) {
    warn('delete', err)
  }
}
