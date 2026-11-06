import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tuning } from '../src/data/tuning'
import { closeAutosave, onCareerSaved, saveCareer } from '../src/persist/autosave'
import { backupAgeText, backupFileName, backupReminderDue } from '../src/persist/safety'
import { startedState } from './helpers'

const DAY = 24 * 60 * 60 * 1000

afterEach(async () => {
  onCareerSaved(null)
  await closeAutosave()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('backup reminder', () => {
  const now = Date.UTC(2026, 10, 6, 12)
  it('stays quiet without progress', () => {
    expect(backupReminderDue(false, null, now)).toBe(false)
  })
  it('shows when there has never been a backup', () => {
    expect(backupReminderDue(true, null, now)).toBe(true)
  })
  it('shows again only after the reminder interval', () => {
    const days = tuning.save.backupReminderDays
    expect(backupReminderDue(true, now - (days - 1) * DAY, now)).toBe(false)
    expect(backupReminderDue(true, now - days * DAY, now)).toBe(true)
  })
  it('describes the age of the last backup', () => {
    expect(backupAgeText(null, now)).toBe('never')
    expect(backupAgeText(now - 1000, now)).toBe('today')
    expect(backupAgeText(now - DAY - 1000, now)).toBe('yesterday')
    expect(backupAgeText(now - 15 * DAY, now)).toBe('15 days ago')
  })
})

describe('backup file name', () => {
  it('uses the local date', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('lombard-backup-2026-01-05.txt')
  })
})

describe('keepStorage', () => {
  it('does nothing (and does not throw) without the storage API', async () => {
    vi.stubGlobal('navigator', {})
    const { keepStorage, storageProtected } = await import('../src/persist/safety')
    await expect(keepStorage()).resolves.toBeNull()
    await expect(storageProtected()).resolves.toBeNull()
  })
  it('asks at most once per page load, and not when already protected', async () => {
    const persist = vi.fn(async () => false)
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist } })
    const { keepStorage } = await import('../src/persist/safety')
    await keepStorage()
    await keepStorage()
    expect(persist).toHaveBeenCalledTimes(1)
  })
  it('skips the request when the storage is already kept', async () => {
    const persist = vi.fn(async () => true)
    vi.stubGlobal('navigator', { storage: { persisted: async () => true, persist } })
    const { keepStorage } = await import('../src/persist/safety')
    await expect(keepStorage()).resolves.toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })
  it('swallows errors from the browser', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => Promise.reject(new Error('nope')), persist: async () => true } })
    const { keepStorage } = await import('../src/persist/safety')
    await expect(keepStorage()).resolves.toBeNull()
  })
})

describe('after-save hook', () => {
  it('runs after a successful autosave write', async () => {
    globalThis.indexedDB = new IDBFactory()
    const seen: string[] = []
    onCareerSaved((s) => seen.push(s.meta.careerId))
    await saveCareer(startedState(1, 'career-hook'))
    expect(seen).toEqual(['career-hook'])
  })
})
