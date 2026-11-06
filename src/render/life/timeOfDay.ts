/**
 * Shop life, pure part: what the room's moving details show at a given shop
 * time. No three, no DOM, so it is unit-tested (tests/life.test.ts).
 *
 * Shop time follows shopClock() in src/ui/format.ts: the shop opens at 10:00
 * and day.clock counts in-game seconds since opening, one shop minute each.
 *
 * The window light: a soft patch of daylight through the street window, the
 * window's panes projected onto the floor along the light's direction. It is
 * thin March sun through cloud (the canal render outside is overcast), so it
 * stays soft and modest. It slides from the player's right in the morning
 * (the left wall, world −x) towards the door side in the afternoon, grows
 * longer and warmer as the sun drops, and is gone by about 18:40, when the
 * sun sinks behind the houses across the canal.
 */

/** day.clock (in-game seconds since opening) → shop hour, e.g. 13.5 = 13:30. */
export function shopHour(clockSeconds: number): number {
  return OPENING_HOUR + (clockSeconds * CLOCK_MINUTES_PER_SECOND) / 60
}

/** Keep in step with OPENING_MINUTES / CLOCK_MINUTES_PER_SECOND in src/ui/format.ts (a test checks). */
export const OPENING_HOUR = 10
export const CLOCK_MINUTES_PER_SECOND = 1

/**
 * ?time=HH:MM → the day.clock value that shows that time (negative before
 * opening), or null if it doesn't parse. For review screenshots only.
 */
export function clockForTime(raw: string | null): number | null {
  const m = raw?.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return (h * 60 + min - OPENING_HOUR * 60) / CLOCK_MINUTES_PER_SECOND
}

/** Clock hand angles in radians, clockwise from 12 o'clock. */
export interface HandAngles {
  hour: number
  minute: number
  second: number
}

/**
 * The wall clock: hour and minute hands show the shop time; the second hand
 * ticks once per real second (one shop minute passes per tick, so a true
 * second hand would just spin).
 */
export function handAngles(clockSeconds: number, realSeconds: number): HandAngles {
  const minutes = OPENING_HOUR * 60 + clockSeconds * CLOCK_MINUTES_PER_SECOND
  const TAU = Math.PI * 2
  const wrap = (x: number, n: number) => ((x % n) + n) % n
  return {
    hour: (wrap(minutes / 60, 12) / 12) * TAU,
    minute: (wrap(minutes, 60) / 60) * TAU,
    second: (wrap(Math.floor(realSeconds), 60) / 60) * TAU,
  }
}

/** The street window's light opening, world metres (bake/layout.json; a test checks). */
export const WINDOW = {
  /** Inside edges of the outer posts. */
  x0: -2.465,
  x1: 0.465,
  /** Top of the sill frame (window_foot) and the bottom of the sign board, which hides the top strip. */
  y0: 0.885,
  y1: 3.04,
  /** The glass plane. */
  z: 3.97,
  /** Middle post (x) and transom (y): the bars that split the panes, centre and width. */
  postX: -1.0,
  postW: 0.07,
  transomY: 2.55,
  transomW: 0.049,
  /** The potted plant on the sill (its shadow sits in the patch's near end). */
  plantX: -2.15,
  plantTop: 1.3,
}

/** The floor the patch may land on: in front of the counter (z −1.9) and inside the walls. */
export const PATCH_CLIP = { x0: -3, x1: 3, z0: -1.9, z1: 4 }

export interface Sun {
  /** Degrees above the horizon. */
  elevation: number
  /** Degrees; 0 shines straight in (towards −z), positive swings the light towards +x. */
  azimuth: number
  /** Extra light on the floor as a fraction of what the bake gives it there: 0 = no patch, 1.2 at most. */
  strength: number
  /** Linear RGB tint of the patch (and the dust in it). */
  color: [number, number, number]
}

/** [hour, elevation°, azimuth°, strength, r, g, b] */
const SUN_KEYS: [number, number, number, number, number, number, number][] = [
  [9.5, 22, -36, 0.0, 0.9, 0.95, 1.0],
  [10.0, 24, -32, 0.5, 0.92, 0.96, 1.0],
  [11.5, 31, -18, 0.95, 0.97, 0.98, 0.98],
  [13.0, 34, -4, 1.2, 1.0, 0.97, 0.92],
  [14.5, 32, 10, 1.2, 1.0, 0.93, 0.82],
  [16.0, 27, 24, 1.1, 1.0, 0.84, 0.64],
  [17.2, 21, 34, 0.95, 1.0, 0.7, 0.44],
  [18.0, 17, 40, 0.55, 1.0, 0.6, 0.34],
  [18.65, 14, 44, 0.0, 1.0, 0.56, 0.32],
]

export function sunAt(hour: number): Sun {
  const k = SUN_KEYS
  let a = k[0]!
  let b = k[k.length - 1]!
  if (hour <= a[0]) b = a
  else if (hour >= b[0]) a = b
  else {
    for (let i = 1; i < k.length; i++) {
      if (hour <= k[i]![0]) {
        a = k[i - 1]!
        b = k[i]!
        break
      }
    }
  }
  const t = b[0] === a[0] ? 0 : (hour - a[0]) / (b[0] - a[0])
  const l = (i: number) => a[i]! + (b[i]! - a[i]!) * t
  return { elevation: l(1), azimuth: l(2), strength: l(3), color: [l(4), l(5), l(6)] }
}

/** Unit direction the light travels in (into the room and down). */
export function sunDirection(sun: Sun): [number, number, number] {
  const el = (sun.elevation * Math.PI) / 180
  const az = (sun.azimuth * Math.PI) / 180
  return [Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el)]
}

/** Where a point on the window glass at (x, y) lands on the floor. Returns [x, z]. */
export function floorHit(sun: Sun, x: number, y: number): [number, number] {
  const [dx, dy, dz] = sunDirection(sun)
  const s = y / -dy
  return [x + dx * s, WINDOW.z + dz * s]
}

/**
 * The patch on the floor: the window opening's four corners projected along
 * the light, in window-space order (u, v) = (0,0) sill left, (1,0) sill right,
 * (0,1) top left, (1,1) top right; "left/right" are world −x/+x. The light
 * travels parallel, so the map from window to floor is affine and the patch
 * is a parallelogram (exact with plain uv interpolation).
 */
export function patchCorners(sun: Sun): [number, number][] {
  const { x0, x1, y0, y1 } = WINDOW
  return [floorHit(sun, x0, y0), floorHit(sun, x1, y0), floorHit(sun, x0, y1), floorHit(sun, x1, y1)]
}
