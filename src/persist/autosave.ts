/**
 * Browser persistence: IndexedDB autosave of the career, via `idb`.
 *
 * Database `lombard`, object store `careers` keyed by `careerId`, index
 * `savedAt`. Nothing here ever throws to callers: private mode, quota errors
 * and blocked upgrades are logged with console.warn and surface as a null /
 * empty result.
 *
 * Career slots (M4): each record carries its slot (1–3). Records saved before
 * slots existed have no slot;
 * `listSlots` assigns them on first read (newest into slot 1, see
 * game/save/slots.ts `assignSlots`) and writes the slot back. The object store
 * and its key are unchanged, so no database version bump is needed and an
 * older build can still read every record.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { migrate } from '../game/save/migrations'
import { assignSlots, isSlotNo, summarizeCareer, withUniqueCareerId, SLOT_NUMBERS, type SlotNo, type SlotView } from '../game/save/slots'
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
  /** Career slot on this device (M4). Missing on records from M1–M3 until `listSlots` assigns one. */
  slot?: SlotNo
}

interface LombardDB extends DBSchema {
  careers: {
    key: string
    value: CareerRecord
    indexes: { savedAt: number }
  }
}

/** A career listed without holding every state. */
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
let afterSave: ((state: GameState) => void) | null = null
let writer: Promise<void> | null = null
/** Waiting saves, one per career: a newer save of the same career replaces the older. */
const queued = new Map<string, { state: GameState; slot?: SlotNo }>()

function nextSavedAt(): number {
  // Strictly increasing, so "latest wins" holds even for two saves in the same millisecond.
  const savedAt = Math.max(Date.now(), lastSavedAt + 1)
  lastSavedAt = savedAt
  return savedAt
}

function makeRecord(state: GameState, slot: SlotNo | undefined): CareerRecord {
  const rec: CareerRecord = { careerId: state.meta.careerId, savedAt: nextSavedAt(), version: state.meta.version, state }
  if (slot) rec.slot = slot
  return rec
}

async function writeOne(state: GameState, slot: SlotNo | undefined): Promise<void> {
  try {
    const db = await getDb()
    const tx = db.transaction(STORE, 'readwrite')
    // Keep the record's slot unless told otherwise.
    const existing = await tx.store.get(state.meta.careerId)
    await tx.store.put(makeRecord(state, slot ?? (isSlotNo(existing?.slot) ? existing.slot : undefined)))
    await tx.done
  } catch (err) {
    warn('save', err)
    return
  }
  try {
    afterSave?.(state)
  } catch (err) {
    console.warn('Lombard: after-save hook failed', err)
  }
}

/** Run `fn` after each successful write (main uses it to ask the browser to keep the storage). */
export function onCareerSaved(fn: ((state: GameState) => void) | null): void {
  afterSave = fn
}

async function drain(): Promise<void> {
  try {
    // While a write is in flight, newer saves only replace their career's entry: at most one write waits per career.
    for (let next = queued.entries().next(); !next.done; next = queued.entries().next()) {
      const [careerId, entry] = next.value
      queued.delete(careerId)
      await writeOne(entry.state, entry.slot)
    }
  } finally {
    writer = null // same tick as the loop's final check, so no save can be stranded
  }
}

/**
 * Save the career (into `slot`, or the slot its record already has). Resolves
 * once this state, or a newer one that replaced it while waiting, has been
 * written (or the attempt failed; failures are warned, never thrown). Rapid
 * calls coalesce: at most one write is in flight and one waiting per career.
 */
export function saveCareer(state: GameState, slot?: SlotNo): Promise<void> {
  queued.set(state.meta.careerId, { state, slot })
  writer ??= drain()
  return writer
}

/** Wait for every pending save to land. */
export async function flushSaves(): Promise<void> {
  while (writer) await writer
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

/** Every readable career, newest first, slotted or not. */
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
  queued.delete(careerId)
  try {
    // Let an in-flight write finish first so the delete is the last word.
    await writer
    const db = await getDb()
    await db.delete(STORE, careerId)
  } catch (err) {
    warn('delete', err)
  }
}

// --- slots (M4) -----------------------------------------------------------------

/**
 * The three slots for the title screen. Also the slot migration: records
 * without a slot (M1–M3 saves) are given one here, newest first, and the slot
 * is written back in the same transaction. Never throws: on a storage failure
 * every slot reads as empty.
 */
export async function listSlots(): Promise<SlotView[]> {
  const views: SlotView[] = SLOT_NUMBERS.map((slot) => ({ slot, career: null, damaged: false }))
  try {
    await flushSaves()
    const db = await getDb()
    const tx = db.transaction(STORE, 'readwrite')
    const records = await tx.store.getAll()
    const parsed = records.map((rec) => ({ rec, state: readRecord(rec) }))
    const slots = assignSlots(parsed.map(({ rec, state }) => ({ careerId: rec.careerId, savedAt: rec.savedAt, slot: rec.slot, readable: state !== null })))
    const writes: Promise<unknown>[] = []
    for (const { rec, state } of parsed) {
      const slot = slots.get(rec.careerId) ?? null
      const had = isSlotNo(rec.slot) ? rec.slot : null
      if (slot !== had) {
        const next: CareerRecord = { ...rec }
        if (slot) next.slot = slot
        else delete next.slot
        writes.push(tx.store.put(next))
      }
      if (!slot) continue
      const view = views[slot - 1]!
      if (state) view.career = summarizeCareer(state, rec.savedAt)
      else view.damaged = true
    }
    await Promise.all(writes)
    await tx.done
  } catch (err) {
    warn('slot list', err)
  }
  return views
}

/** The career in a slot, migrated, or null if the slot is empty or unreadable. */
export async function loadSlot(slot: SlotNo): Promise<GameState | null> {
  try {
    const db = await getDb()
    const records = (await db.getAll(STORE)).filter((r) => r.slot === slot).sort((a, b) => b.savedAt - a.savedAt)
    for (const rec of records) {
      const state = readRecord(rec)
      if (state) return state
    }
    return null
  } catch (err) {
    warn('slot load', err)
    return null
  }
}

/**
 * Put a career into a slot, replacing whatever career was there (a new career,
 * or a loaded save code). The old career's record is deleted in the same
 * transaction. If the career's id is already used by a career in another slot
 * (the same save code loaded twice), it gets a fresh id. Returns the state as
 * stored, or null if the write failed.
 */
export async function putInSlot(state: GameState, slot: SlotNo): Promise<GameState | null> {
  try {
    await flushSaves()
    const db = await getDb()
    const tx = db.transaction(STORE, 'readwrite')
    const all = await tx.store.getAll()
    const elsewhere = new Set(all.filter((r) => r.slot !== slot).map((r) => r.careerId))
    const stored = withUniqueCareerId(state, elsewhere, nextSavedAt().toString(36))
    const writes: Promise<unknown>[] = []
    for (const r of all) {
      if (r.slot === slot && r.careerId !== stored.meta.careerId) {
        queued.delete(r.careerId)
        writes.push(tx.store.delete(r.careerId))
      }
    }
    writes.push(tx.store.put(makeRecord(stored, slot)))
    await Promise.all(writes)
    await tx.done
    return stored
  } catch (err) {
    warn('slot write', err)
    return null
  }
}

/** Delete the career in a slot (and any damaged record there). */
export async function deleteSlot(slot: SlotNo): Promise<void> {
  try {
    await flushSaves()
    const db = await getDb()
    const tx = db.transaction(STORE, 'readwrite')
    const all = await tx.store.getAll()
    const writes: Promise<unknown>[] = []
    for (const r of all) {
      if (r.slot !== slot) continue
      queued.delete(r.careerId)
      writes.push(tx.store.delete(r.careerId))
    }
    await Promise.all(writes)
    await tx.done
  } catch (err) {
    warn('slot delete', err)
  }
}
