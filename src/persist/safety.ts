/**
 * Save safety in the browser: ask it to keep our storage, remember when the
 * player last made a backup, and write / read backup files.
 *
 * Every Longlight game lives on the same GitHub Pages origin, so they share one
 * storage quota: if the phone runs low, the browser can wipe the whole origin
 * at once. A save code (or a backup file holding one) is the way back.
 *
 * Nothing here throws to callers. Missing APIs (old browsers, Node in tests)
 * read as "unknown" and are skipped quietly.
 */
import { tuning } from '../data/tuning'

/** Device-only key (like the sound settings): when the last backup was made, ms since epoch. */
const LAST_BACKUP_KEY = 'lombard.lastBackup'
const GAME_SLUG = 'lombard'
const DAY_MS = 24 * 60 * 60 * 1000

// --- storage persistence ----------------------------------------------------------

type StorageApi = { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean> }

function storageApi(): StorageApi | null {
  try {
    const s = (globalThis.navigator as { storage?: StorageApi } | undefined)?.storage
    return s && typeof s.persisted === 'function' ? s : null
  } catch {
    return null
  }
}

/** true = the browser promised to keep our storage, false = it may clear it, null = can't tell. */
export async function storageProtected(): Promise<boolean | null> {
  const s = storageApi()
  if (!s?.persisted) return null
  try {
    return await s.persisted()
  } catch {
    return null
  }
}

let asked = false

/**
 * Ask the browser to keep this site's storage, at most once per page load.
 * Call it only once there is progress worth keeping (Firefox shows a prompt;
 * Chrome and Safari decide quietly). Resolves to the protected state, or null.
 */
export async function keepStorage(): Promise<boolean | null> {
  const s = storageApi()
  if (!s?.persist) return null
  try {
    if (await s.persisted?.()) return true
    if (asked) return false
    asked = true
    return await s.persist()
  } catch {
    return null
  }
}

// --- last backup ---------------------------------------------------------------------

/** When the player last copied a save code or saved a backup file, or null if never (or unknown). */
export function lastBackupAt(): number | null {
  try {
    const n = Number(localStorage.getItem(LAST_BACKUP_KEY))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function markBackedUp(now = Date.now()): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(now))
  } catch {
    // storage blocked: the reminder may show again next session
  }
}

/** Pure: should the quiet backup reminder show? Only with real progress, never backed up or too long ago. */
export function backupReminderDue(hasProgress: boolean, last: number | null, now: number): boolean {
  if (!hasProgress) return false
  if (last === null) return true
  return now - last >= tuning.save.backupReminderDays * DAY_MS
}

/** Pure: "today", "yesterday", "5 days ago" or "never". */
export function backupAgeText(last: number | null, now: number): string {
  if (last === null) return 'never'
  const days = Math.floor(Math.max(0, now - last) / DAY_MS)
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

// --- backup files ----------------------------------------------------------------

/** `lombard-backup-YYYY-MM-DD.txt`, in the player's local date. */
export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${GAME_SLUG}-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.txt`
}

export type FileResult = 'shared' | 'downloaded' | 'cancelled' | 'failed'

/**
 * Hand the player a text file holding `text`. The share sheet first (on iPhone
 * it offers "Save to Files" and works in a Home Screen app), else a download.
 */
export async function saveBackupFile(text: string, name = backupFileName()): Promise<FileResult> {
  const body = `${text}\n`
  try {
    const file = new File([body], name, { type: 'text/plain' })
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return 'shared'
      } catch (err) {
        // The player closed the share sheet: not saved, and nothing to report.
        if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
        // Anything else (e.g. not allowed here): fall through to a download.
      }
    }
  } catch {
    // No File constructor or share support: try a download.
  }
  try {
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Give the browser a moment to start the download before letting go of the data.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}

/** The text of a chosen backup file, trimmed. Throws a player-safe message for files far too big to be a code. */
export async function readBackupFile(file: File): Promise<string> {
  // A code is plain ASCII, so its byte size is its length; allow a little slack for line breaks.
  if (file.size > tuning.save.maxCodeChars + 1024) throw new Error('That file is far too big to be a Lombard backup.')
  return (await file.text()).trim()
}
