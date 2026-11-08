/**
 * A distant tram now and then while the shop is open: presentation only, like
 * the street's passers-by. The gaps are real seconds drawn from the career
 * seed and the day (the same day hears its trams at the same moments after
 * opening), never from the game Rng, so nothing in the game shifts.
 *
 * Not gated on reduce motion: it is a sound, not movement. Sound off and the
 * ambience level are the engine's business (it drops the cue).
 */
import { TRAM } from '../data/audio'
import { Rng, hashString } from '../game/rng'

/** Real seconds before the n-th tram of a day (n = 0: after opening; then between passes). */
export function tramGap(seed: number, day: number, n: number): number {
  const [lo, hi] = n === 0 ? TRAM.first : TRAM.gap
  return new Rng(hashString(`tram:${seed}:${day}:${n}`)).range(lo, hi)
}

export class TramSchedule {
  private key = ''
  private n = 0
  private wait = 0

  /** Advance by `dt` real seconds; true when a tram passes now. Only counts while `open`. */
  update(dt: number, seed: number, day: number, open: boolean): boolean {
    if (!open) return false
    const key = `${seed}:${day}`
    if (key !== this.key) {
      this.key = key
      this.n = 0
      this.wait = tramGap(seed, day, 0)
    }
    this.wait -= dt
    if (this.wait > 0) return false
    this.n += 1
    this.wait = tramGap(seed, day, this.n)
    return true
  }
}
