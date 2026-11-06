/** M3: life outside the window (src/render/street): scheduling, the day's weather, dusk, and the packed assets. */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { STREET, type WalkLane } from '../src/data/street'
import type { Season } from '../src/game/state'
import { StreetPlan, outdoorLight, weatherFor, type StreetEvent, type StreetMood, type WalkerEvent } from '../src/render/street/plan'

const SEASONS: Season[] = ['winter', 'spring', 'summer', 'autumn']
const DAY: StreetMood = { weather: 'clear', dark: 0, ice: false, busy: 1 }

function run(seed: number, mood: StreetMood, seconds: number): StreetEvent[] {
  const plan = new StreetPlan(seed, mood, 0)
  const out: StreetEvent[] = []
  for (let t = 0; t <= seconds; t += 0.5) out.push(...plan.advance(t))
  return out
}

describe('street weather', () => {
  it('is the same for the same career and day (stable across reloads)', () => {
    for (const s of SEASONS) for (let d = 1; d < 40; d++) expect(weatherFor(1234, d, s)).toEqual(weatherFor(1234, d, s))
  })

  it('varies between days and careers', () => {
    const kinds = new Set(Array.from({ length: 60 }, (_, d) => weatherFor(99, d, 'autumn').kind))
    expect(kinds.has('rain')).toBe(true)
    expect(kinds.has('clear')).toBe(true)
    const a = Array.from({ length: 60 }, (_, d) => weatherFor(1, d, 'autumn').kind).join()
    const b = Array.from({ length: 60 }, (_, d) => weatherFor(2, d, 'autumn').kind).join()
    expect(a).not.toBe(b)
  })

  it('follows the season odds: rainy autumns, snowy winters, no summer snow', () => {
    const share = (season: Season, kind: string) => {
      let n = 0
      for (let d = 0; d < 4000; d++) if (weatherFor(77, d, season).kind === kind) n++
      return n / 4000
    }
    expect(share('summer', 'snow')).toBe(0)
    expect(share('autumn', 'rain')).toBeCloseTo(STREET.weather.rain.autumn, 1)
    expect(share('winter', 'snow')).toBeCloseTo(STREET.weather.snow.winter, 1)
    expect(share('winter', 'rain')).toBeLessThan(0.1)
    for (let d = 0; d < 200; d++) {
      const w = weatherFor(5, d, 'autumn')
      if (w.kind === 'clear') expect(w.intensity).toBe(0)
      else expect(w.intensity).toBeGreaterThanOrEqual(STREET.weather.intensity[0])
    }
  })
})

describe('street light', () => {
  it('is daylight at midday in every season', () => {
    for (const s of SEASONS) {
      const l = outdoorLight(12.5, s)
      expect(l.dark).toBe(0)
      expect(l.tint).toEqual([1, 1, 1])
    }
  })

  it('gets dark by the season: winter mid-afternoon, never in a summer shop day', () => {
    expect(outdoorLight(17.5, 'winter').dark).toBeGreaterThan(0.9)
    expect(outdoorLight(15, 'winter').dark).toBe(0)
    expect(outdoorLight(19, 'summer').dark).toBe(0)
    expect(outdoorLight(19, 'autumn').dark).toBeGreaterThan(0.5)
    const w = outdoorLight(18, 'winter').tint
    expect(Math.max(...w)).toBeLessThan(0.45)
  })

  it('without a season keeps the backdrop curve (dusk after 18:00)', () => {
    expect(outdoorLight(17, null).dark).toBe(0)
    expect(outdoorLight(19.5, null).dark).toBeGreaterThan(0.6)
  })
})

describe('street plan', () => {
  it('is deterministic for a seed', () => {
    expect(run(42, DAY, 600)).toEqual(run(42, DAY, 600))
    expect(run(42, DAY, 600)).not.toEqual(run(43, DAY, 600))
  })

  it('keeps a quiet street: people pass the window every half minute or so, never bunched', () => {
    const lanes = Object.keys(STREET.walk.lanes) as WalkLane[]
    const events = run(7, DAY, 3600)
    for (const lane of lanes) {
      const spec = STREET.walk.lanes[lane]
      // one time per spawn (a pair shares it)
      const times = [...new Set(events.filter((e): e is WalkerEvent => e.kind === 'walker' && e.lane === lane).map((e) => e.t))]
      const gaps = times.slice(1).map((t, i) => t - times[i]!)
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(spec.minGap - 1e-9)
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
      expect(mean).toBeGreaterThan(spec.meanGap * 0.7)
      expect(mean).toBeLessThan(spec.meanGap * 1.35)
    }
    const near = events.filter((e) => e.kind === 'walker' && e.lane === 'pavement').length
    expect(near).toBeGreaterThan(60)
    expect(near).toBeLessThan(200)
  })

  it('mixes directions, speeds, looks and some pairs', () => {
    const walkers = run(11, DAY, 3600).filter((e): e is WalkerEvent => e.kind === 'walker')
    const left = walkers.filter((w) => w.dir > 0).length / walkers.length
    expect(left).toBeGreaterThan(0.35)
    expect(left).toBeLessThan(0.65)
    expect(new Set(walkers.map((w) => w.look)).size).toBe(8)
    const byTime = new Map<number, WalkerEvent[]>()
    for (const w of walkers) byTime.set(w.t * 1000 + w.lane.length, [...(byTime.get(w.t * 1000 + w.lane.length) ?? []), w])
    const pairs = [...byTime.values()].filter((g) => g.length === 2)
    expect(pairs.length / byTime.size).toBeGreaterThan(0.1)
    expect(pairs.length / byTime.size).toBeLessThan(0.3)
    for (const [a, b] of pairs) {
      expect(a!.dir).toBe(b!.dir)
      expect(a!.look).not.toBe(b!.look)
      expect(Math.abs(a!.z - b!.z)).toBeCloseTo(0.55, 5)
    }
    for (const w of walkers) {
      expect(w.speed).toBeGreaterThanOrEqual(STREET.walk.speed[0])
      expect(w.speed).toBeLessThanOrEqual(STREET.walk.speed[1])
    }
  })

  it('has fewer people in the rain and after dark, no boats on ice, no sill pigeon in the rain', () => {
    const count = (mood: StreetMood) => run(3, mood, 3600).filter((e) => e.kind === 'walker').length
    const dry = count(DAY)
    expect(count({ ...DAY, weather: 'rain' })).toBeLessThan(dry * 0.8)
    expect(count({ ...DAY, dark: 1 })).toBeLessThan(dry * 0.8)
    expect(run(3, DAY, 3600).some((e) => e.kind === 'boat')).toBe(true)
    expect(run(3, { ...DAY, ice: true }, 3600).some((e) => e.kind === 'boat')).toBe(false)
    expect(run(3, DAY, 3600).some((e) => e.kind === 'sill')).toBe(true)
    expect(run(3, { ...DAY, weather: 'rain' }, 3600).some((e) => e.kind === 'sill')).toBe(false)
  })

  it('pre-warms so the street is not empty when the shop opens', () => {
    const plan = new StreetPlan(9, DAY)
    const first = plan.advance(0)
    expect(first.some((e) => e.kind === 'walker' && e.t < 0)).toBe(true)
    expect(first.every((e) => e.kind !== 'boat' && e.kind !== 'sill')).toBe(true)
  })

  it('traffic keeps to the right and the bus is rare', () => {
    const v = run(21, DAY, 7200).filter((e) => e.kind === 'vehicle')
    expect(v.length).toBeGreaterThan(150)
    for (const e of v) expect(e.dir).toBe(STREET.traffic.lanes.find((l) => l.z === e.z)!.dir)
    const buses = v.filter((e) => e.model === 'bus').length / v.length
    expect(buses).toBeGreaterThan(0.02)
    expect(buses).toBeLessThan(0.16)
  })
})

describe('street assets', () => {
  const ROOT = path.resolve(__dirname, '..')
  const DIR = path.join(ROOT, 'public', 'assets', 'street')
  const read = () =>
    JSON.parse(readFileSync(path.join(DIR, 'street.json'), 'utf8')) as {
      inputHash: string
      backdropHash: string
      files: Record<string, string>
      people: { looks: unknown[] }
    }
  const hashOf = (dir: string) => {
    const h = createHash('sha256')
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.py')).sort()) h.update(readFileSync(path.join(dir, f)))
    return h.digest('hex').slice(0, 16)
  }

  it('were packed from the current scripts', () => {
    const manifest = read()
    expect(manifest.inputHash).toBe(hashOf(path.join(ROOT, 'art', 'street')))
  })

  it('match the canal render they are drawn over (rerun art/street/build.py --only canal after a backdrop rebuild)', () => {
    const manifest = read()
    const canal = JSON.parse(readFileSync(path.join(ROOT, 'public', 'assets', 'backdrop', 'canal.json'), 'utf8')) as { inputHash: string }
    expect(manifest.backdropHash).toBe(canal.inputHash)
  })

  it('stay small: under 1.5 MB to download, all of it lazy', () => {
    const manifest = read()
    let total = 0
    for (const f of Object.values(manifest.files)) {
      const p = path.join(DIR, f)
      expect(existsSync(p)).toBe(true)
      total += statSync(p).size
    }
    // a day loads one people sheet, not both
    const oneDay = total - statSync(path.join(DIR, manifest.files.people_rain!)).size
    expect(oneDay).toBeLessThan(1.5 * 1024 * 1024)
    expect(manifest.people.looks).toHaveLength(8)
  })
})
