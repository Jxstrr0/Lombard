/** M3 shop life: the pure parts (shop time, clock hands, window light, tea) and their anchors in bake/layout.json. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { TEA, teaAt, wantsRefill } from '../src/render/life/teaModel'
import { PATCH_CLIP, WINDOW, clockForTime, floorHit, handAngles, patchCorners, shopHour, sunAt, sunDirection } from '../src/render/life/timeOfDay'
import { WALL_CLOCK } from '../src/render/life/wallClock'
import { shopClock } from '../src/ui/format'

const TAU = Math.PI * 2

interface LayoutObject {
  name: string
  shape?: string
  prop?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  size?: [number, number, number]
  children?: LayoutObject[]
}
const layout = JSON.parse(readFileSync(path.resolve(__dirname, '..', 'bake', 'layout.json'), 'utf8')) as { objects: LayoutObject[] }

function child(groupName: string, name: string): { at: [number, number, number]; o: LayoutObject } {
  const g = layout.objects.find((o) => o.name === groupName)
  const c = g?.children?.find((o) => o.name === name)
  if (!g || !c?.position) throw new Error(`layout has no ${groupName}/${name}`)
  const p = g.position ?? [0, 0, 0]
  return { at: [p[0] + c.position[0], p[1] + c.position[1], p[2] + c.position[2]], o: c }
}

/** "HH:MM" as fractional hours. */
function hours(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h! + m! / 60
}

describe('shop time', () => {
  it('follows the HUD clock (shopClock)', () => {
    for (const c of [0, 1, 59, 60, 61, 125, 300, 479, 480, 600]) {
      expect(shopHour(c)).toBeCloseTo(hours(shopClock(c)) + (c % 1) / 60, 9)
    }
  })

  it('parses ?time=HH:MM into day.clock seconds', () => {
    expect(clockForTime('10:00')).toBe(0)
    expect(clockForTime('13:00')).toBe(180)
    expect(clockForTime('9:30')).toBe(-30)
    expect(shopClock(clockForTime('17:45')!)).toBe('17:45')
    for (const bad of [null, '', '17', '25:00', '12:60', 'noon', '12:5']) expect(clockForTime(bad)).toBeNull()
  })
})

describe('wall clock hands', () => {
  it('show the shop time', () => {
    const at10 = handAngles(0, 0)
    expect(at10.hour).toBeCloseTo((10 / 12) * TAU)
    expect(at10.minute).toBeCloseTo(0)
    const at1330 = handAngles(clockForTime('13:30')!, 0)
    expect(at1330.hour).toBeCloseTo((1.5 / 12) * TAU)
    expect(at1330.minute).toBeCloseTo(Math.PI)
    const at1745 = handAngles(clockForTime('17:45')!, 0)
    expect(at1745.minute).toBeCloseTo(0.75 * TAU)
    expect(at1745.hour).toBeCloseTo((5.75 / 12) * TAU)
  })

  it('keeps every angle in [0, 2π), before opening too', () => {
    for (const c of [-600, -1, 0, 37, 719, 720, 5000]) {
      const a = handAngles(c, c * 1.37)
      for (const v of [a.hour, a.minute, a.second]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(TAU)
      }
    }
  })

  it('ticks the second hand once per real second', () => {
    expect(handAngles(0, 15.7).second).toBeCloseTo((15 / 60) * TAU)
    expect(handAngles(0, 60.2).second).toBeCloseTo(0)
  })

  it('sits on the baked wall clock (bake/layout.json wall_clock)', () => {
    const p = child('props', 'wall_clock')
    expect(p.o.prop).toBe('wall_clock')
    expect(p.o.rotation).toEqual([0, 180, 0])
    expect(WALL_CLOCK.center.x).toBeCloseTo(p.at[0], 3)
    expect(WALL_CLOCK.center.z).toBeCloseTo(p.at[2], 3)
    // Dial centre half the prop's 0.321 m height above its origin.
    expect(WALL_CLOCK.center.y - p.at[1]).toBeCloseTo(0.1605, 3)
  })
})

describe('window light', () => {
  it('matches the window in bake/layout.json', () => {
    const foot = child('window', 'window_foot')
    const postL = child('window', 'window_post_l')
    const postM = child('window', 'window_post_m')
    const postR = child('window', 'window_post_r')
    const transom = child('window', 'window_transom')
    const sign = child('window', 'sign_board')
    const plant = child('props', 'plant')
    expect(WINDOW.y0).toBeCloseTo(foot.at[1] + foot.o.size![1] / 2, 3)
    expect(WINDOW.y1).toBeCloseTo(sign.at[1] - sign.o.size![1] / 2, 3)
    expect(WINDOW.x0).toBeCloseTo(postL.at[0] + postL.o.size![0] / 2, 3)
    expect(WINDOW.x1).toBeCloseTo(postR.at[0] - postR.o.size![0] / 2, 3)
    expect(WINDOW.postX).toBeCloseTo(postM.at[0], 3)
    expect(WINDOW.postW).toBeCloseTo(postM.o.size![0], 3)
    expect(WINDOW.transomY).toBeCloseTo(transom.at[1], 3)
    expect(WINDOW.transomW).toBeCloseTo(transom.o.size![1], 3)
    expect(WINDOW.plantX).toBeCloseTo(plant.at[0], 3)
    // The glass sits just inside the street wall (z 4).
    expect(Math.abs(WINDOW.z - foot.at[2])).toBeLessThan(0.05)
  })

  it('is there in daytime and gone before opening and after sundown', () => {
    expect(sunAt(9).strength).toBe(0)
    expect(sunAt(19).strength).toBe(0)
    expect(sunAt(21).strength).toBe(0)
    for (const h of [10.5, 12, 13, 15, 17]) expect(sunAt(h).strength).toBeGreaterThan(0.3)
    expect(sunAt(13).strength).toBeGreaterThan(sunAt(10.25).strength)
    expect(sunAt(13).strength).toBeGreaterThan(sunAt(18).strength)
  })

  it('slides towards the door side and grows longer through the afternoon', () => {
    const centre = (h: number) => {
      const c = patchCorners(sunAt(h))
      return [c.reduce((s, p) => s + p[0], 0) / 4, c.reduce((s, p) => s + p[1], 0) / 4] as const
    }
    const hoursOfDay = [10.5, 12, 13.5, 15, 16.5, 17.75]
    for (let i = 1; i < hoursOfDay.length; i++) expect(centre(hoursOfDay[i]!)[0]).toBeGreaterThan(centre(hoursOfDay[i - 1]!)[0])
    const length = (h: number) => {
      const c = patchCorners(sunAt(h))
      return c[0]![1] - c[2]![1] // sill edge z − top edge z
    }
    expect(length(17.5)).toBeGreaterThan(length(13))
    expect(length(16)).toBeGreaterThan(length(13))
  })

  it('is warmer in the evening than in the morning', () => {
    const warmth = (h: number) => sunAt(h).color[0] / sunAt(h).color[2]
    expect(warmth(17.5)).toBeGreaterThan(warmth(13))
    expect(warmth(13)).toBeGreaterThan(warmth(10.5))
    expect(warmth(17.5)).toBeGreaterThan(1.8)
  })

  it('projects the window along the light onto the floor in front of it', () => {
    for (const h of [10.25, 12, 14, 16, 18]) {
      const sun = sunAt(h)
      const [dx, dy, dz] = sunDirection(sun)
      expect(Math.hypot(dx, dy, dz)).toBeCloseTo(1, 9)
      expect(dy).toBeLessThan(0)
      expect(dz).toBeLessThan(0) // into the room
      // A point on the glass at floor height lands where it is.
      const [x, z] = floorHit(sun, -1, 0)
      expect(x).toBeCloseTo(-1, 9)
      expect(z).toBeCloseTo(WINDOW.z, 9)
      const c = patchCorners(sun)
      // Parallelogram: the two sill corners are the window's width apart along x, same z.
      expect(c[1]![0] - c[0]![0]).toBeCloseTo(WINDOW.x1 - WINDOW.x0, 9)
      expect(c[1]![1]).toBeCloseTo(c[0]![1], 9)
      // The sill edge lands inside the room, beyond the wall under the window; the top edge further in.
      expect(c[0]![1]).toBeLessThan(WINDOW.z - 0.5)
      expect(c[2]![1]).toBeLessThan(c[0]![1])
    }
    // Midday the whole patch lies on the floor in front of the counter.
    for (const [, z] of patchCorners(sunAt(13))) expect(z).toBeGreaterThan(PATCH_CLIP.z0)
  })
})

describe('tea', () => {
  it('starts full and hot, is sipped down and cools', () => {
    expect(teaAt(0)).toEqual({ level: 1, heat: 1 })
    let prev = teaAt(0)
    for (let m = 1; m <= 200; m++) {
      const t = teaAt(m)
      expect(t.level).toBeLessThanOrEqual(prev.level)
      expect(t.heat).toBeLessThan(prev.heat)
      expect(t.level).toBeGreaterThanOrEqual(TEA.minLevel)
      prev = t
    }
    expect(teaAt(TEA.sipEvery - 0.01).level).toBe(1)
    expect(teaAt(TEA.sipEvery).level).toBeCloseTo(1 - TEA.sip)
    expect(teaAt(1000).level).toBe(TEA.minLevel)
    expect(teaAt(TEA.coolMinutes).heat).toBeCloseTo(Math.exp(-1))
  })

  it('is topped up in a lull only once it is about half gone', () => {
    expect(wantsRefill(0)).toBe(false)
    expect(wantsRefill(TEA.sipEvery * 2)).toBe(false)
    const half = Math.ceil((1 - TEA.refillBelow) / TEA.sip) * TEA.sipEvery
    expect(wantsRefill(half)).toBe(true)
    expect(wantsRefill(10_000)).toBe(true)
  })
})
