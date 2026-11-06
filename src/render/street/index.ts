/**
 * Life outside the shop window and door (M3 art pass): people walking past on
 * the near pavement, the embankment and across the canal, cars and a bus on the
 * far embankment road, a tour boat with its wake, pigeons crossing the sky and
 * now and then one on the windowsill, drifting clouds, lamps and windows coming
 * on at dusk by the season, and the day's weather (rain on the glass, snow,
 * a frozen canal in winter).
 *
 * Assets are made headless in Blender (art/street/build.py, packed by
 * scripts/street-pack.mjs into public/assets/street/) and load after the shop
 * is up. Three draws at most: people, everything else, weather on the glass;
 * the clouds, night lights, weather grading and wake ride along in the canal
 * backdrop's own draw (src/render/backdrop.ts).
 *
 * Presentation only. It reads the career seed, the day, the season and the
 * shop clock and never writes state. Its random streams are its own (seeded
 * from the career seed and the day, src/render/street/plan.ts), so the same
 * day's weather survives a reload.
 *
 * Review flags: ?street=0 (off), ?street=busy (four times the traffic),
 * ?weather=clear|rain|snow, ?season=winter|spring|summer|autumn. The shop's
 * ?time=HH:MM override (render/life/timeOfDay.ts clockForTime) reaches the
 * street through setClockOverride, like the rest of the room.
 */
import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { STREET, type WalkLane } from '../../data/street'
import type { GameState, Season } from '../../game/state'
import type { CanalBackdrop } from '../backdrop'
import { shopHour } from '../life/timeOfDay'
import type { QualityTier } from '../perf'
import {
  StreetPlan,
  crossingTime,
  lookIsWoman,
  mixSeed,
  outdoorLight,
  weatherFor,
  type BoatEvent,
  type FlockEvent,
  type SillEvent,
  type StreetEvent,
  type VehicleEvent,
  type WalkerEvent,
  type Weather,
  type WeatherKind,
} from './plan'
import { SpriteLayer, type SpriteFrame, type SpriteInstance } from './sprites'
import { WeatherGlass } from './weather'

interface Cell {
  id: string
  x: number
  y: number
  w: number
  h: number
  m: [number, number]
  /** Where the cell's bottom edge sits relative to the sprite's anchor, metres (pigeons in flight). */
  y0?: number
}

export interface StreetManifest {
  version: number
  inputHash: string
  backdropHash: string
  people: { cell: [number, number]; metres: [number, number]; frames: number; clip: number; atlas: [number, number]; looks: { id: string; x: number; y: number }[]; walkSpeed: { m: number; f: number } }
  props: { atlas: [number, number]; cells: Cell[] }
  canal: { size: [number, number]; depth: { z0: number; step: number }; file: string }
  files: { people_dry: string; people_rain: string; props: string; canal: string }
}

export interface StreetFlags {
  enabled: boolean
  busy: number
  weather: WeatherKind | null
  season: Season | null
}

export function streetFlags(params: URLSearchParams): StreetFlags {
  const s = params.get('street')
  const w = params.get('weather')
  const season = params.get('season')
  return {
    enabled: s !== '0',
    busy: s === 'busy' ? 4 : 1,
    weather: w === 'clear' || w === 'rain' || w === 'snow' ? w : null,
    season: season === 'winter' || season === 'spring' || season === 'summer' || season === 'autumn' ? season : null,
  }
}

/** Near-pavement window span (world x) the inside of the shop could care about (a shadow crossing the floor). */
const WINDOW_SPAN = { x0: -3.2, x1: 0.9 }
const SILL = { y: 0.85, z: 4.24 }

export class StreetLife {
  private readonly people: SpriteLayer
  private readonly things: SpriteLayer
  private readonly weatherGlass: WeatherGlass
  private readonly loader: KTX2Loader
  private readonly atlases: Partial<Record<'people_dry' | 'people_rain', THREE.Texture>> = {}
  private plan: StreetPlan | null = null
  private planKey = ''
  private events: StreetEvent[] = []
  private time = 0
  private weather: Weather = { kind: 'clear', intensity: 0 }
  private season: Season = 'spring'
  private dark = 0
  private tint: [number, number, number] = [1, 1, 1]
  private reduceMotion = false
  private layers = 3
  private seed = 1
  private ice = false
  private readonly cells = new Map<string, Cell>()
  private readonly peopleList: SpriteInstance[] = []
  private readonly thingList: SpriteInstance[] = []
  private boatWake: [number, number, number, number] = [0, 0, 1, 0]
  private readonly passers: { x: number; z: number }[] = []
  /** Walkers already announced to onWindowPasser. */
  private readonly announced = new WeakSet<WalkerEvent>()
  private clockOverride: number | null = null
  /**
   * Someone on the shop's pavement is about to pass in front of the window:
   * `dir` +1 walks towards +x (the door side), −1 towards −x; `speed` m/s.
   * main.ts points this at ShopLife.passerBy so their shadow crosses the sun
   * patch on the floor. Not called under reduce motion.
   */
  onWindowPasser: ((dir: 1 | -1, speed: number) => void) | null = null

  private constructor(
    private readonly manifest: StreetManifest,
    private readonly backdrop: CanalBackdrop,
    private readonly scene: THREE.Scene,
    private readonly base: string,
    private readonly flags: StreetFlags,
    loader: KTX2Loader,
    private readonly props: THREE.Texture,
    private readonly extra: THREE.Texture,
  ) {
    this.loader = loader
    const info = { ...backdrop.frame, depth: manifest.canal.depth }
    // the people sheet comes in once the day's weather is known (dry or with umbrellas)
    this.people = new SpriteLayer('street-people', 40, props, manifest.people.atlas, extra, backdrop.texture, info)
    this.people.mesh.visible = false
    this.things = new SpriteLayer('street-things', 40, props, manifest.props.atlas, extra, backdrop.texture, info)
    this.weatherGlass = new WeatherGlass(backdrop.texture, backdrop.frame)
    for (const c of manifest.props.cells) this.cells.set(c.id, c)
    backdrop.attachStreet(extra)
    scene.add(this.people.mesh, this.things.mesh, this.weatherGlass.mesh)
  }

  static async load(renderer: THREE.WebGLRenderer, base: string, backdrop: CanalBackdrop, scene: THREE.Scene, flags: StreetFlags): Promise<StreetLife> {
    const dir = `${base}assets/street/`
    const res = await fetch(`${dir}street.json`, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`no street assets (${res.status})`)
    const manifest = (await res.json()) as StreetManifest
    const loader = new KTX2Loader().setTranscoderPath(`${base}assets/decoders/basis/`).detectSupport(renderer)
    const [props, extra] = await Promise.all([
      loadKtx2(loader, `${dir}${manifest.files.props}?v=${manifest.inputHash}`),
      loadData(`${dir}${manifest.files.canal}?v=${manifest.inputHash}`),
    ])
    return new StreetLife(manifest, backdrop, scene, base, flags, loader, props, extra)
  }

  /** Read what the street needs from the game (seed, day, season, clock, reduce motion). Never writes. */
  sync(state: GameState): void {
    this.reduceMotion = state.settings.reduceMotion
    this.season = this.flags.season ?? state.calendar.season
    this.seed = state.meta.seed
    const day = state.calendar.day
    const w = weatherFor(this.seed, day, this.season)
    this.weather = this.flags.weather ? { kind: this.flags.weather, intensity: this.flags.weather === 'clear' ? 0 : 0.85 } : w
    this.ice = (STREET.iceSeasons as readonly Season[]).includes(this.season)
    const hour = shopHour(this.clockOverride ?? state.day.clock)
    const light = outdoorLight(hour, this.season)
    this.tint = light.tint
    this.dark = light.dark
    const key = `${this.seed}:${day}:${this.season}:${this.weather.kind}`
    if (key !== this.planKey) {
      this.planKey = key
      this.plan = new StreetPlan(mixSeed(this.seed, day), this.mood())
      this.events = []
      this.time = 0
      this.wantPeople(this.weather.kind === 'rain' ? 'people_rain' : 'people_dry')
    } else {
      this.plan?.setMood(this.mood())
    }
    this.pushBackdrop()
  }

  /** ?time=HH:MM: show this shop time (as day.clock seconds) whatever the game's clock says. */
  setClockOverride(seconds: number | null): void {
    this.clockOverride = seconds
  }

  setTier(tier: QualityTier): void {
    this.layers = tier === 'low' ? 2 : 3
  }

  /**
   * People on the shop's own pavement in front of the window right now (world
   * x, z), for anything inside that wants to follow them (e.g. a shadow
   * crossing the sun patch on the floor). Empty under reduce motion.
   */
  windowPassers(): readonly { x: number; z: number }[] {
    return this.passers
  }

  update(dt: number): void {
    if (this.plan && !this.reduceMotion) {
      this.time += dt
      this.events.push(...this.plan.advance(this.time))
    }
    this.weatherGlass.set(this.weather.kind === 'rain' ? this.weather.intensity : 0, this.weather.kind === 'snow' ? this.weather.intensity : 0, this.tint, this.reduceMotion, this.layers)
    this.weatherGlass.update(dt, this.reduceMotion)
    this.build()
    const wet = this.weather.kind === 'rain' ? 0.6 * this.weather.intensity : 0
    this.people.setLook(this.tint, wet)
    this.things.setLook(this.tint, wet)
    this.people.set(this.peopleList)
    this.things.set(this.thingList)
    if (!this.atlasReady()) this.people.mesh.visible = false
    this.pushBackdrop()
  }

  dispose(): void {
    this.backdrop.setStreet(null)
    this.scene.remove(this.people.mesh, this.things.mesh, this.weatherGlass.mesh)
    this.people.dispose()
    this.things.dispose()
    this.weatherGlass.dispose()
    for (const t of Object.values(this.atlases)) t?.dispose()
    this.props.dispose()
    this.extra.dispose()
    this.loader.dispose()
  }

  // ---------------------------------------------------------------------------

  /** Today's weather, for the shop's window light (rain and snow hide the sun). */
  get todaysWeather(): Weather {
    return this.weather
  }

  private mood() {
    return { weather: this.weather.kind, dark: this.dark, ice: this.ice, busy: this.flags.busy }
  }

  private pushBackdrop(): void {
    const w = this.weather
    this.backdrop.setStreet({
      tint: this.tint,
      dark: this.dark,
      wet: w.kind === 'rain' ? 0.45 + 0.55 * w.intensity : 0,
      snow: w.kind === 'snow' ? 0.5 + 0.5 * w.intensity : 0,
      ice: this.ice ? 1 : 0,
      boat: this.boatWake,
    })
  }

  private wanted: 'people_dry' | 'people_rain' = 'people_dry'

  private wantPeople(name: 'people_dry' | 'people_rain'): void {
    this.wanted = name
    const have = this.atlases[name]
    if (have) {
      this.people.setAtlas(have)
      return
    }
    const url = `${this.base}assets/street/${this.manifest.files[name]}?v=${this.manifest.inputHash}`
    loadKtx2(this.loader, url)
      .then((t) => {
        // keep only the sheet the day needs
        for (const [k, v] of Object.entries(this.atlases)) {
          if (k !== name) {
            v?.dispose()
            delete this.atlases[k as typeof name]
          }
        }
        this.atlases[name] = t
        if (this.wanted === name) this.people.setAtlas(t)
      })
      .catch((err) => console.info('[street] people sheet failed to load:', err instanceof Error ? err.message : err))
  }

  private atlasReady(): boolean {
    return this.atlases[this.wanted] !== undefined
  }

  /** Turn the live events into this frame's sprites; drop the ones that are done. */
  private build(): void {
    const P = this.peopleList
    const T = this.thingList
    P.length = 0
    T.length = 0
    this.passers.length = 0
    this.boatWake = [0, 0, 1, 0]
    if (this.reduceMotion) return
    const now = this.time
    const keep: StreetEvent[] = []
    for (const e of this.events) {
      const age = now - e.t
      let alive = true
      switch (e.kind) {
        case 'walker':
          alive = age <= crossingTime(e)
          if (alive) this.walker(e, age)
          break
        case 'vehicle':
          alive = age <= crossingTime(e)
          if (alive) this.vehicle(e, age)
          break
        case 'boat':
          alive = age <= crossingTime(e)
          if (alive) this.boat(e, age)
          break
        case 'flock':
          alive = age <= 30
          if (alive) this.flock(e, age)
          break
        case 'sill':
          alive = age <= e.stay + 6
          if (alive) this.sill(e, age)
          break
      }
      if (alive) keep.push(e)
    }
    this.events = keep
  }

  private walker(e: WalkerEvent, age: number): void {
    const M = this.manifest.people
    const x = e.x + e.dir * e.speed * age
    const lane = STREET.walk.lanes[e.lane]
    const ground = 0.12 // every walk is a kerbed pavement (art/backdrop/scene.py WALK_TOP)
    const ws = lookIsWoman(e.look) ? M.walkSpeed.f : M.walkSpeed.m
    const phase = e.phase + (age * e.speed) / ws / M.clip
    const f = Math.floor((phase - Math.floor(phase)) * M.frames) % M.frames
    const look = M.looks[e.look % M.looks.length]!
    const cols = M.atlas[0] / M.cell[0]
    const k0 = look.x / M.cell[0] + (look.y / M.cell[1]) * cols + f
    const frame: SpriteFrame = { x: (k0 % cols) * M.cell[0], y: Math.floor(k0 / cols) * M.cell[1], w: M.cell[0], h: M.cell[1] }
    // fade at the lane's ends (they are out of sight there anyway)
    const edge = Math.min(x - lane.x0, lane.x1 - x)
    this.peopleList.push({ x, y: ground, z: e.z, width: M.metres[0], height: M.metres[1], frame, facingPlusX: e.dir > 0, alpha: clamp01(edge / 1.5), shade: 1 })
    if (e.lane === 'pavement' && x > WINDOW_SPAN.x0 && x < WINDOW_SPAN.x1) {
      this.passers.push({ x, z: e.z })
      if (!this.announced.has(e)) {
        this.announced.add(e)
        this.onWindowPasser?.(e.dir > 0 ? 1 : -1, e.speed)
      }
    }
  }

  private vehicle(e: VehicleEvent, age: number): void {
    const id = e.model === 'car' ? (['car_white', 'car_green', 'car_red'] as const)[e.variant % 3]! : e.model
    const c = this.cells.get(id)
    if (!c) return
    const x = e.x + e.dir * e.speed * age
    const T = STREET.traffic
    const edge = Math.min(x - T.x0, T.x1 - x)
    this.thingList.push({ x, y: 0, z: e.z, width: c.m[0], height: c.m[1], frame: c, facingPlusX: e.dir > 0, alpha: clamp01(edge / 3), shade: 1 })
  }

  private boat(e: BoatEvent, age: number): void {
    const c = this.cells.get('boat')
    if (!c) return
    const x = e.x + e.dir * e.speed * age
    const B = STREET.boat
    const edge = clamp01(Math.min(x - B.x0, B.x1 - x) / 4)
    const y = this.backdrop.frame.waterY
    const s: SpriteInstance = { x, y, z: e.z, width: c.m[0], height: c.m[1], frame: c, facingPlusX: e.dir > 0, alpha: edge, shade: 1 }
    this.thingList.push(s, { ...s, reflection: true })
    this.boatWake = [x - e.dir * 4.5, e.z, e.dir, edge]
  }

  private flock(e: FlockEvent, age: number): void {
    const frames = ['fly1', 'fly2', 'fly3', 'fly4']
    for (const b of e.birds) {
      const x = b.x + e.dir * e.speed * age
      // flap for a while, glide for a while
      const cycle = (age * 0.35 + b.phase) % 1
      const gliding = cycle > 0.7
      const f = gliding ? 'fly4' : frames[Math.floor((age * 9 + b.phase * 4) % 4)]!
      const c = this.cells.get(`pigeon_${f}`)
      if (!c) continue
      const y = b.y + Math.sin(age * 1.3 + b.phase * 6) * 0.4 - (gliding ? (cycle - 0.7) * 1.2 : 0)
      this.thingList.push({ x, y: y + (c.y0 ?? 0), z: b.z, width: c.m[0], height: c.m[1], frame: c, facingPlusX: e.dir > 0, alpha: 1, shade: 0.9 })
    }
  }

  /** A pigeon flies in from the side, lands on the outside sill, looks about and pecks, and flies off. */
  private sill(e: SillEvent, age: number): void {
    const arrive = 1.8
    const leave = arrive + e.stay
    const cell = (id: string) => this.cells.get(`pigeon_${id}`)
    let x = e.x
    let y = SILL.y
    let z = SILL.z
    let id: string
    let facing = e.dir > 0
    if (age < arrive) {
      // swoop down from above and to the side
      const t = age / arrive
      const k = 1 - (1 - t) * (1 - t)
      x = e.x - e.dir * (1 - k) * 4
      y = SILL.y + (1 - k) * 2.4
      z = SILL.z + (1 - k) * 1.5
      id = t > 0.72 ? 'land' : ['fly1', 'fly2', 'fly3', 'fly4'][Math.floor(age * 10) % 4]!
    } else if (age < leave) {
      const t = age - arrive
      // a little routine: stand, peck, peck, a step, turn round now and then
      const beat = Math.floor(t / 0.55)
      const r = hash(beat * 7.13 + e.t)
      id = r < 0.4 ? 'stand' : r < 0.7 ? 'peck1' : 'peck2'
      const steps = Math.floor(t / 2.2)
      for (let i = 0; i < steps; i++) x += (hash(i * 3.7 + e.t) - 0.5) * 0.14
      facing = (Math.floor(t / 5.5 + hash(e.t)) % 2 === 0) === e.dir > 0
      if (t < 0.25) id = 'land'
    } else {
      const t = age - leave
      x = e.x + e.dir * t * 3.2
      y = SILL.y + t * t * 0.9 + t * 0.4
      z = SILL.z + t * 0.8
      id = ['fly1', 'fly2', 'fly3', 'fly4'][Math.floor(t * 11) % 4]!
      facing = e.dir > 0
    }
    const c = cell(id)
    if (!c) return
    this.thingList.push({ x, y: y + (c.y0 ?? 0), z, width: c.m[0], height: c.m[1], frame: c, facingPlusX: facing, alpha: 1, shade: 1 })
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Deterministic 0..1 from a number (pigeon fidgets; presentation only). */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

async function loadKtx2(loader: KTX2Loader, url: string): Promise<THREE.Texture> {
  const t = await loader.loadAsync(url)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = false // rows flipped when packing
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.anisotropy = 1
  return t
}

/** The canal data layer: exact bytes, no colour conversion, no premultiplied alpha, rows bottom-up. */
async function loadData(url: string): Promise<THREE.Texture> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`canal layer ${res.status}`)
  const bitmap = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: 'none' })
  const t = new THREE.Texture(bitmap as unknown as HTMLImageElement)
  t.flipY = false
  t.premultiplyAlpha = false
  t.colorSpace = THREE.NoColorSpace
  t.generateMipmaps = false
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.needsUpdate = true
  return t
}

export type { WalkLane }
