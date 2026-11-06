/**
 * Street life outside the window, the pure part: who passes when, the day's
 * weather, and the light by the shop clock and season. No three.js, no DOM,
 * so it is unit-tested (tests/street.test.ts). Everything is seeded: the same
 * career and day give the same weather after a reload, and the same street
 * for screenshots.
 *
 * Presentation only. It reads the career seed, the day and the season and
 * never feeds anything back into the game.
 */
import { STREET, type WalkLane } from '../../data/street'
import { Rng } from '../../game/rng'
import type { Season } from '../../game/state'

export type WeatherKind = 'clear' | 'rain' | 'snow'

export interface Weather {
  kind: WeatherKind
  /** 0 for a dry day, 0.45..1 for rain or snow. */
  intensity: number
}

/** Mix two numbers into a 32-bit seed (no Math.random anywhere here). */
export function mixSeed(a: number, b: number): number {
  let h = Math.imul(a ^ 0x5bd1e995, 0x9e3779b1) ^ Math.imul(b + 0x7f4a7c15, 0x85ebca6b)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  return h >>> 0 || 1
}

/** The day's weather: stable for a career seed and day, odds by season (STREET.weather). */
export function weatherFor(seed: number, day: number, season: Season): Weather {
  const rng = new Rng(mixSeed(mixSeed(seed, 0x77ea7e), day))
  const roll = rng.next()
  const w = STREET.weather
  const [lo, hi] = w.intensity
  const intensity = lo + (hi - lo) * rng.next()
  if (roll < w.snow[season]) return { kind: 'snow', intensity }
  if (roll < w.snow[season] + w.rain[season]) return { kind: 'rain', intensity }
  return { kind: 'clear', intensity: 0 }
}

export interface OutdoorLight {
  /** Multiplier on the daytime render and the sprites. */
  tint: [number, number, number]
  /** 0 in daylight → 1 at night: drives the street lamps and lit windows. */
  dark: number
}

/**
 * Overcast daylight over a shop day by the shop clock, as [hour, r, g, b]. The
 * afternoon half slides with the season's sunset (STREET.sunset); the base
 * curve is the backdrop's original March light with sunset at 18:00.
 */
const DAYLIGHT: [number, number, number, number][] = [
  [10, 0.94, 0.96, 1.0],
  [12.5, 1.0, 1.0, 1.0],
  [15.5, 1.0, 0.97, 0.92],
  [17.5, 0.9, 0.84, 0.8],
  [18.5, 0.6, 0.62, 0.74],
  [19.5, 0.34, 0.38, 0.52],
  [20.5, 0.24, 0.27, 0.4],
]
const BASE_SUNSET = 18

/** `season` null keeps the base curve (the backdrop without the street layer). */
export function outdoorLight(hour: number, season: Season | null): OutdoorLight {
  const sunset = season ? STREET.sunset[season] : BASE_SUNSET
  const shift = sunset - BASE_SUNSET
  // keys after midday follow the sunset; never earlier than 13:00
  const keys = DAYLIGHT.map(([h, r, g, b], i) => [i <= 1 ? h : Math.max(h + shift, 12.5 + i * 0.25), r, g, b] as const)
  const tint: [number, number, number] = [keys[0]![1], keys[0]![2], keys[0]![3]]
  if (hour >= keys[keys.length - 1]![0]) {
    const k = keys[keys.length - 1]!
    tint[0] = k[1]
    tint[1] = k[2]
    tint[2] = k[3]
  } else {
    for (let i = 1; i < keys.length; i++) {
      const b = keys[i]!
      if (hour <= b[0]) {
        const a = keys[i - 1]!
        const t = Math.max(0, (hour - a[0]) / (b[0] - a[0]))
        for (let c = 0; c < 3; c++) tint[c] = a[c + 1]! + (b[c + 1]! - a[c + 1]!) * t
        break
      }
    }
  }
  const dark = smoothstep(sunset - 0.25, sunset + 1.6, hour)
  return { tint, dark }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// --- scheduling ---------------------------------------------------------------------

export interface WalkerEvent {
  kind: 'walker'
  /** Street seconds when they enter at their lane's end. */
  t: number
  lane: WalkLane
  x: number
  z: number
  /** +1 walks towards +x (the player's left), -1 towards -x. */
  dir: 1 | -1
  speed: number
  /** Index into the passer-by looks (sprite sheet rows). */
  look: number
  /** Walk-cycle phase at t, 0..1. */
  phase: number
}

export interface VehicleEvent {
  kind: 'vehicle'
  t: number
  x: number
  z: number
  dir: 1 | -1
  speed: number
  model: 'car' | 'minibus' | 'bus'
  /** Which car colour. */
  variant: number
}

export interface BoatEvent {
  kind: 'boat'
  t: number
  x: number
  z: number
  dir: 1 | -1
  speed: number
}

export interface FlockEvent {
  kind: 'flock'
  t: number
  dir: 1 | -1
  speed: number
  birds: { x: number; y: number; z: number; phase: number }[]
}

export interface SillEvent {
  kind: 'sill'
  t: number
  /** Where on the sill it lands (x), the side it comes from, how long it stays. */
  x: number
  dir: 1 | -1
  stay: number
}

export type StreetEvent = WalkerEvent | VehicleEvent | BoatEvent | FlockEvent | SillEvent

export interface StreetMood {
  weather: WeatherKind
  /** 0 day → 1 night (fewer people out). */
  dark: number
  /** Frozen canal: no boats. */
  ice: boolean
  /** Review multiplier on every frequency (?street=busy). */
  busy: number
}

export const LOOK_COUNT = 8
/** Looks 0–3 are men, 4–7 women (art/street/build.py PEOPLE). */
export function lookIsWoman(look: number): boolean {
  return look >= LOOK_COUNT / 2
}

/** Where a walker of a lane enters and in which direction they go. */
function laneStart(lane: WalkLane, dir: 1 | -1): number {
  const s = STREET.walk.lanes[lane]
  return dir > 0 ? s.x0 : s.x1
}

interface Stream {
  next: number
  rng: Rng
  emit(t: number, rng: Rng): StreetEvent[]
  gap(rng: Rng): number
}

/**
 * Seeded event streams for one street day. `advance(t)` returns every event
 * that starts at or before street time t (seconds), in time order. Each stream
 * (a walking lane, the road, the canal, the sky, the sill) draws from its own
 * forked generator, so changing one never moves the others.
 */
export class StreetPlan {
  private readonly streams: Stream[] = []
  private mood: StreetMood

  /** `from` is where the street's clock starts: negative pre-warms it (people already mid-walk). */
  constructor(seed: number, mood: StreetMood, from = -90) {
    this.mood = mood
    const fork = (k: number) => new Rng(mixSeed(seed, k))
    const W = STREET.walk
    const lanes = Object.keys(W.lanes) as WalkLane[]
    lanes.forEach((lane, i) => {
      const spec = W.lanes[lane]
      const rng = fork(101 + i)
      this.streams.push({
        rng,
        next: from + rng.range(0, spec.meanGap * 0.5),
        gap: (r) => this.expGap(r, spec.meanGap, spec.minGap, this.peopleFactor()),
        emit: (t, r) => this.walkers(t, r, lane),
      })
    })
    const T = STREET.traffic
    const road = fork(201)
    this.streams.push({
      rng: road,
      next: from + road.range(0, T.meanGap * 0.5),
      gap: (r) => this.expGap(r, T.meanGap, T.minGap, this.mood.busy * (1 - 0.3 * this.mood.dark)),
      emit: (t, r) => [this.vehicle(t, r)],
    })
    const B = STREET.boat
    const canal = fork(301)
    this.streams.push({
      rng: canal,
      next: Math.max(from, 0) + B.firstAfter + canal.range(0, B.meanGap * 0.6),
      gap: (r) => this.expGap(r, B.meanGap, B.minGap, this.mood.busy),
      emit: (t, r) => (this.mood.ice ? [] : [this.boat(t, r)]),
    })
    const F = STREET.birds
    const sky = fork(401)
    this.streams.push({
      rng: sky,
      next: from + sky.range(0, F.flockGap),
      gap: (r) => this.expGap(r, F.flockGap, F.flockGap * 0.25, this.mood.busy * (this.mood.weather === 'clear' ? 1 : 0.5)),
      emit: (t, r) => (this.mood.dark > 0.7 ? [] : [this.flock(t, r)]),
    })
    const sill = fork(501)
    this.streams.push({
      rng: sill,
      next: Math.max(from, 0) + F.sillFirstAfter + sill.range(0, F.sillGap * 0.5),
      gap: (r) => this.expGap(r, F.sillGap, F.sillGap * 0.35, this.mood.busy),
      emit: (t, r) => (this.mood.dark > 0.6 || this.mood.weather !== 'clear' ? [] : [this.sill(t, r)]),
    })
  }

  setMood(mood: StreetMood): void {
    this.mood = mood
  }

  advance(t: number): StreetEvent[] {
    const out: StreetEvent[] = []
    for (const s of this.streams) {
      while (s.next <= t) {
        out.push(...s.emit(s.next, s.rng))
        s.next += s.gap(s.rng)
      }
    }
    return out.sort((a, b) => a.t - b.t)
  }

  private peopleFactor(): number {
    const b = STREET.busier
    const m = this.mood
    const w = m.weather === 'rain' ? b.rain : m.weather === 'snow' ? b.snow : 1
    return m.busy * w * (1 - (1 - b.dark) * m.dark)
  }

  /** Exponential gap with a floor; `factor` > 1 makes things more frequent. */
  private expGap(rng: Rng, mean: number, min: number, factor: number): number {
    const f = Math.max(0.05, factor)
    return min / Math.sqrt(f) + (-Math.log(1 - rng.next()) * Math.max(0, mean - min)) / f
  }

  private walkers(t: number, rng: Rng, lane: WalkLane): WalkerEvent[] {
    const W = STREET.walk
    const spec = W.lanes[lane]
    const dir: 1 | -1 = rng.chance(W.leftShare) ? 1 : -1
    const speed = rng.range(W.speed[0], W.speed[1])
    const look = rng.int(0, LOOK_COUNT - 1)
    const z = spec.z + rng.range(-spec.zJitter, spec.zJitter)
    const first: WalkerEvent = { kind: 'walker', t, lane, x: laneStart(lane, dir), z, dir, speed, look, phase: rng.next() }
    if (!rng.chance(W.pairChance)) return [first]
    // a companion side by side: the other half of the lane, a different look, the same pace
    let other = rng.int(0, LOOK_COUNT - 2)
    if (other >= look) other++
    const side = z > spec.z ? -1 : 1
    const second: WalkerEvent = { ...first, z: z + side * 0.55, look: other, phase: (first.phase + 0.5) % 1, x: first.x - dir * rng.range(0, 0.35) }
    return [first, second]
  }

  private vehicle(t: number, rng: Rng): VehicleEvent {
    const T = STREET.traffic
    const lane = rng.pick(T.lanes)
    const roll = rng.next()
    const model = roll < T.bus ? 'bus' : roll < T.bus + T.minibus ? 'minibus' : 'car'
    const speed = rng.range(T.speed[0], T.speed[1]) * (model === 'car' ? 1 : 0.8)
    return { kind: 'vehicle', t, x: lane.dir > 0 ? T.x0 : T.x1, z: lane.z, dir: lane.dir, speed, model, variant: rng.int(0, 2) }
  }

  private boat(t: number, rng: Rng): BoatEvent {
    const B = STREET.boat
    const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1
    return { kind: 'boat', t, x: dir > 0 ? B.x0 : B.x1, z: rng.range(B.z[0], B.z[1]), dir, speed: rng.range(B.speed[0], B.speed[1]) }
  }

  private flock(t: number, rng: Rng): FlockEvent {
    const F = STREET.birds
    const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1
    const n = rng.int(F.flockMin, F.flockMax)
    const y = rng.range(F.y[0], F.y[1])
    const z = rng.range(F.z[0], F.z[1])
    // start well outside the view on the far bank; the scale of the view grows with z
    const x = dir > 0 ? -z * 0.9 - 8 : z * 0.6 + 8
    const birds = Array.from({ length: n }, () => ({ x: x - dir * rng.range(0, 6), y: y + rng.range(-1.5, 1.5), z: z + rng.range(-3, 3), phase: rng.next() }))
    return { kind: 'flock', t, dir, speed: rng.range(F.speed[0], F.speed[1]), birds }
  }

  private sill(t: number, rng: Rng): SillEvent {
    const F = STREET.birds
    return { kind: 'sill', t, x: rng.range(-2.1, 0.2), dir: rng.chance(0.5) ? 1 : -1, stay: rng.range(F.sillStay[0], F.sillStay[1]) }
  }
}

/** How long a walker or vehicle event takes to cross its lane, seconds. */
export function crossingTime(e: WalkerEvent | VehicleEvent | BoatEvent): number {
  if (e.kind === 'walker') {
    const s = STREET.walk.lanes[e.lane]
    return (s.x1 - s.x0) / e.speed
  }
  if (e.kind === 'vehicle') return (STREET.traffic.x1 - STREET.traffic.x0) / e.speed
  return (STREET.boat.x1 - STREET.boat.x0) / e.speed
}
