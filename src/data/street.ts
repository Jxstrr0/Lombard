/**
 * Street life outside the window (presentation only, src/render/street/):
 * how often people, cars, boats and pigeons pass, the weather odds per
 * season, and when dusk falls. Nothing here moves the game.
 *
 * World metres, three.js coordinates (x across the shop, +x on the player's
 * left; z from the shop towards the far bank). The street wall's outer face
 * is z = 4.1; the canal render is shown on the plane z = 11
 * (art/backdrop/scene.py has the street's layout).
 */
import type { Season } from '../game/state'

export type WalkLane = 'pavement' | 'embankment' | 'far' | 'farPavement'

export interface WalkLaneSpec {
  /** Distance from the shop (three.js z) of the lane's middle, and how far a walker strays from it. */
  z: number
  zJitter: number
  /** Walkers appear at one end and vanish at the other, out of sight. */
  x0: number
  x1: number
  /** Mean and minimum seconds between people (or pairs) on this lane. */
  meanGap: number
  minGap: number
}

export const STREET = {
  walk: {
    lanes: {
      // the shop's own pavement, right outside the window (seen from the waist up)
      pavement: { z: 5.2, zJitter: 0.35, x0: -7, x1: 6.5, meanGap: 30, minGap: 7 },
      // the embankment walk along the near railing
      embankment: { z: 9.95, zJitter: 0.12, x0: -11, x1: 10, meanGap: 36, minGap: 6 },
      // across the canal, along the far railing and in front of the shops
      far: { z: 42.6, zJitter: 0.3, x0: -30, x1: 24, meanGap: 15, minGap: 3 },
      farPavement: { z: 50.2, zJitter: 0.3, x0: -30, x1: 24, meanGap: 22, minGap: 3 },
    } satisfies Record<WalkLane, WalkLaneSpec>,
    /** Ground speed, m/s (a stroll to a brisk walk). */
    speed: [0.95, 1.4] as const,
    /** Chance a spawn is two people walking side by side. */
    pairChance: 0.2,
    /** Share of walkers heading towards +x (the player's left). */
    leftShare: 0.5,
  },
  traffic: {
    /** The far embankment road: two lanes, traffic keeps to the right. */
    lanes: [
      { z: 44.7, dir: 1 as const },
      { z: 47.4, dir: -1 as const },
    ],
    x0: -45,
    x1: 35,
    meanGap: 24,
    minGap: 6,
    speed: [7.5, 11.5] as const,
    /** Share of vehicles that are the minibus or the bus; the rest are cars. */
    minibus: 0.14,
    bus: 0.08,
  },
  boat: {
    /** Across the canal (near wall at 11.15, far wall at 41.15) and its waterline. */
    z: [21, 29] as const,
    x0: -40,
    x1: 36,
    meanGap: 300,
    minGap: 150,
    /** The first boat of a day comes this many seconds in, at the earliest. */
    firstAfter: 45,
    speed: [1.8, 2.6] as const,
  },
  birds: {
    /** A few pigeons crossing the sky over the far bank. */
    flockGap: 75,
    flockMin: 3,
    flockMax: 7,
    y: [9, 17] as const,
    z: [26, 60] as const,
    speed: [9, 13] as const,
    /** One pigeon landing on the outside windowsill now and then, and how long it stays. */
    sillGap: 230,
    sillFirstAfter: 40,
    sillStay: [12, 28] as const,
  },
  /** Multipliers on how often people pass. */
  busier: { rain: 0.6, snow: 0.75, dark: 0.6 },
  weather: {
    /** Chance of a rainy / snowy day per season; otherwise dry and overcast. */
    rain: { winter: 0.04, spring: 0.24, summer: 0.18, autumn: 0.42 } satisfies Record<Season, number>,
    snow: { winter: 0.45, spring: 0.05, summer: 0, autumn: 0.04 } satisfies Record<Season, number>,
    /** Intensity range of a rainy or snowy day. */
    intensity: [0.45, 1] as const,
  },
  /**
   * Shop-clock hour of sunset by season (a northern city: winter dusk mid
   * afternoon, white nights in summer). Lamps come on about half an hour after,
   * it is dark about an hour and a half after.
   */
  sunset: { winter: 15.8, spring: 19.6, summer: 22.4, autumn: 17.4 } satisfies Record<Season, number>,
  /** The canal is frozen in winter (no boats). */
  iceSeasons: ['winter'] satisfies Season[] as Season[],
  /**
   * M6 the Flood (src/game/city/flood.ts floodView): the water's height in the canal render
   * (world y; the canal normally lies at y −0.65, the pavements at about +0.12) by days after the
   * flood day, from the paper's first warning to the last of the mud, and the rain on its days.
   */
  flood: {
    /** [days after the flood day, water y]; between entries the level is eased, outside them there is no flood water. */
    levels: [
      [-7, -0.56],
      [-4, -0.42],
      [-3, -0.3],
      [-1, -0.04],
      [0, 0.3],
      [1, 0.26],
      [2, 0.06],
      [3, -0.2],
      [4, -0.4],
      [7, -0.6],
    ] as readonly (readonly [number, number])[],
    /** Rain on these phases (intensity), whatever the day's weather roll said. */
    rain: { rising: 0.7, flood: 0.9 } as Partial<Record<string, number>>,
    /** Fewer people out while the street is under water (× how often they pass). */
    busier: 0.35,
  },
} as const
