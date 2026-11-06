/**
 * Byte progress for the big first-load files (the HDRI, the baked shop glb and
 * its lightmap), for the loading screen's bar. No three.js and no DOM: the
 * loaders get `track(key)` as their onProgress callback, main.ts reads
 * `fraction()` and hands it to the loading screen (src/ui/loading.ts).
 */

/** What three's loaders pass to onProgress (a ProgressEvent in the browser). */
export interface BytesEvent {
  loaded: number
  total: number
  lengthComputable?: boolean
}

export type OnBytes = (e: BytesEvent) => void

interface FileProgress {
  loaded: number
  /** 0 while the size is unknown (not started, or the server sent no length). */
  total: number
  done: boolean
}

export class LoadProgress {
  private files = new Map<string, FileProgress>()
  /** Called after every change. */
  onChange: (() => void) | null = null

  /** `expected` names every file the first screen waits for, so the bar knows how many are still to start. */
  constructor(expected: readonly string[]) {
    for (const key of expected) this.files.set(key, { loaded: 0, total: 0, done: false })
  }

  /** An onProgress callback for one file. */
  track(key: string): OnBytes {
    return (e) => {
      const f = this.file(key)
      f.loaded = e.loaded
      if ((e.lengthComputable ?? true) && e.total > 0) f.total = e.total
      this.onChange?.()
    }
  }

  /** Mark a file finished (loaded, or given up on: either way the bar moves past it). */
  done(key: string): void {
    this.file(key).done = true
    this.onChange?.()
  }

  /**
   * 0…1 over every expected file. Once every size is known it is bytes loaded
   * over bytes total; until then each file counts the same.
   */
  fraction(): number {
    const all = [...this.files.values()]
    if (all.length === 0) return 1
    const share = (f: FileProgress) => (f.done ? 1 : f.total > 0 ? Math.min(1, f.loaded / f.total) : 0)
    if (all.every((f) => f.done || f.total > 0)) {
      let total = 0
      let loaded = 0
      for (const f of all) {
        // A finished file with no known size still needs a weight: give it the average.
        const size = f.total > 0 ? f.total : 0
        total += size
        loaded += size * share(f)
      }
      const unknown = all.filter((f) => f.total === 0).length
      if (total > 0) {
        const avg = total / (all.length - unknown)
        return (loaded + unknown * avg) / (total + unknown * avg)
      }
    }
    return all.reduce((sum, f) => sum + share(f), 0) / all.length
  }

  private file(key: string): FileProgress {
    let f = this.files.get(key)
    if (!f) {
      f = { loaded: 0, total: 0, done: false }
      this.files.set(key, f)
    }
    return f
  }
}
