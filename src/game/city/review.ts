/**
 * Dev review careers for M6's city layer (main.ts; never used in play). Pure.
 *
 *   ?scenario=flood-warning  three days before the water: the paper's warning, the canal up its
 *                            walls, Kuzmich first in line with his sandbags (the three choices).
 *   ?scenario=flood          the flood morning (&prep=none|sandbags|lifted, default none): the bill,
 *                            the water on the floor and over the street, Arkady first with his pump.
 *   ?scenario=flood-after    the water going down (sandbags held): Nina Arkadyevna first, asking you
 *                            to keep her things dry.
 *   ?scenario=paper          the morning paper on a given date (&on=MM-DD in the first year, or
 *                            YYYY-MM-DD; default 09-01, the first day of school), unread.
 */
import { getBeat } from '../../data/stories'
import { tuning } from '../../data/tuning'
import { reducer } from '../actions'
import { lateCareer } from '../endings/review'
import { beatVisit } from '../story/plan'
import { recordBeat } from '../story/progress'
import type { GameState } from '../state'
import { FLOOD_FLAGS, floodDay, type FloodPrep } from './flood'

/** Open the shop that morning with this beat's visit first in line (once). */
function openWith(s: GameState, beatId: string): GameState {
  s = reducer(s, { type: 'day/open' })
  const beat = getBeat(beatId)
  if (!beat) return s
  let n = 0
  const visit = beatVisit(s, beat, (p) => `${p}-dev-${n++}`)
  if (!visit) return s
  const queue = [visit, ...s.queue.filter((v) => v.beatId !== beatId)]
  return { ...s, queue, day: { ...s.day, total: queue.length } }
}

const withFlags = (s: GameState, flags: readonly string[]): GameState => ({ ...s, story: { ...s.story, flags: [...s.story.flags, ...flags] } })

export function floodReview(seed: number, careerId: string, step: 'warning' | 'flood' | 'after', prep: FloodPrep = 'none'): GameState {
  const fd = floodDay(seed)
  if (step === 'warning') return openWith(lateCareer(seed, careerId, fd - 3), 'flood.sandbags')
  let s = lateCareer(seed, careerId, step === 'flood' ? fd : fd + tuning.flood.floodDays)
  const sandbagsDay = fd - 3
  if (prep === 'sandbags' || step === 'after') {
    s = recordBeat(withFlags(s, [FLOOD_FLAGS.sandbags]), 'flood.sandbags', { day: sandbagsDay, outcome: 'talked', choice: 'flood_sandbags' })
  } else if (prep === 'lifted') {
    s = recordBeat(withFlags(s, [FLOOD_FLAGS.lifted]), 'flood.sandbags', { day: sandbagsDay, outcome: 'talked', choice: 'flood_lift' })
  } else {
    s = recordBeat(withFlags(s, [FLOOD_FLAGS.unprepared]), 'flood.sandbags', { day: sandbagsDay, outcome: 'talked', choice: 'flood_ignore' })
  }
  if (step === 'flood') return openWith(s, 'flood.pump')
  // The flood morning has been and gone (the sandbags held); the pump went to Arkady.
  s = withFlags(s, [FLOOD_FLAGS.hit, FLOOD_FLAGS.dry, 'flood.hero_pump', 'heart.flood_pump'])
  s = recordBeat(s, 'flood.pump', { day: fd, outcome: 'talked', choice: 'pump_lend' })
  return openWith(s, 'flood.storage')
}

/** The paper on `on` (MM-DD in the career's first year from its start, or YYYY-MM-DD). */
export function paperReview(seed: number, careerId: string, on: string | null): GameState {
  const start = tuning.career.startDate
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(on ?? '') ? on! : `${start.slice(0, 4)}-${/^\d{2}-\d{2}$/.test(on ?? '') ? on : '09-01'}`
  const days = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000)
  const day = Math.max(2, days + 1 + (days < 0 ? 365 : 0))
  return reducer(lateCareer(seed, careerId, day), { type: 'day/open' })
}
