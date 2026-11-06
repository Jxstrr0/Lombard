/**
 * The shop scene. The static room comes from the bake (bakedShop.ts:
 * shop.glb + Cycles lightmap, built from bake/layout.json); until that loads,
 * or if it fails, or with ?nobake=1, a procedural grey box stands in. Both are
 * lit by a Poly Haven HDRI environment plus at most two real-time lights
 * (counter lamp, window fill), which mostly matter for the item and customer.
 * No real-time shadows.
 *
 * Coordinates (metres): x across the shop (-3..3), z from the back wall
 * behind the player (-4) to the street wall (+4), y up. The player stands
 * behind the counter at z ≈ -2.9 looking towards the street.
 */
import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import type { GameState } from '../game/state'
import { loadCanalBackdrop, type CanalBackdrop } from './backdrop'
import { loadBakedShop, type BakedShop, type ShopManifest } from './bakedShop'
import { INSPECT_POINT } from './camera'
import { lookFor } from '../game/customers/look'
import type { CustomerCast, CustomerModel } from './customerModel'
import { canalBackdropTexture, contactShadowTexture, parquetTexture, plasterTexture } from './textures'

const ROOM = { halfW: 3, halfD: 4, height: 4.2 }
const COUNTER = { z: -2.25, width: 3.2, depth: 0.7, baseH: 0.66, caseH: 0.28 }
/** Top surface of the rubber counter mat in front of the player (world). */
const MAT_POINT = new THREE.Vector3(0, COUNTER.baseH + COUNTER.caseH + 0.015, COUNTER.z + 0.12)
const ENV_INTENSITY = { counter: 0.55, inspect: 1.0 }

interface LightRig {
  lamp: THREE.PointLight
  fill: THREE.DirectionalLight
  lampPos: THREE.Vector3
  fillPos: THREE.Vector3
  fillTarget: THREE.Vector3
}

export interface SceneOptions {
  envUrl: string
}

/** Customer silhouette opacity behind the item in inspect view (presentation only). */
const INSPECT_CUSTOMER_OPACITY = 0.25

/**
 * The customer's walk (presentation only): in through the street door, across
 * the floor to their spot at the counter, a turn to face the player; out the
 * same way. Positions are world metres (bake/layout.json): the door is at
 * x 1.7 on the street wall (z 3.97), the spot is in front of the counter glass.
 * The straight line clears the island case and the chair.
 */
const WALK = {
  door: new THREE.Vector3(1.7, 0, 3.55),
  spot: new THREE.Vector3(-0.15, 0, -1.45),
  /** Metres from the door over which they fade in (or out): through the door, not out of thin air. */
  fadeDistance: 0.7,
  /** Default ground speed (m/s) when the cast entry has none. */
  speed: 1.25,
  /** Radians per second when turning on the spot. */
  turnRate: 3.2,
  /** Seconds to crossfade idle and walk. */
  blend: 0.35,
}

export class ShopScene {
  readonly scene = new THREE.Scene()
  /** Procedural grey-box room; removed once the baked shop is in. */
  private room = new THREE.Group()
  private baked: BakedShop | null = null
  private customer: THREE.Group
  private customerFade = 0
  private customerTarget = 0
  /** Materials the customer fade drives (the silhouette's, or a cast model's). */
  private customerMats: THREE.Material[] = []
  private customerOpaque = false
  private customerMixer: THREE.AnimationMixer | null = null
  /** Where the customer is on their way: 0 at the door, 1 at the counter. */
  private walkT = 0
  /** 'out' (nobody), 'in' (walking in, then turning to the player), 'here', 'leaving'. */
  private walkPhase: 'out' | 'entering' | 'here' | 'leaving' = 'out'
  /** ?walk=0: customers fade in at the counter as before (screenshots). */
  private walking = true
  /** Stand-in drawn when there's no cast, or a cast model fails to load. */
  private silhouette!: THREE.Group
  private silhouetteMats: THREE.Material[] = []
  private cast: CustomerCast | null = null
  private castOverride: string | null = null
  private model: CustomerModel | null = null
  /** Cast id the customer group shows now, the one the current customer needs, and the next in line. */
  private shownLook: string | null = null
  private wantLook: string | null = null
  private nextLook: string | null = null
  /** A loaded look waiting for the customer to be out of sight before it swaps in (model null = silhouette). */
  private pending: { look: string; model: CustomerModel | null } | null = null
  private disposables: { dispose(): void }[] = []
  private lights!: LightRig
  /** Canvas card outside the window until the rendered canal backdrop loads (and if it doesn't). */
  private backdropCard: THREE.Mesh | null = null
  private backdrop: CanalBackdrop | null = null
  private backdropState = { clock: 0, reduceMotion: false }
  readonly matPoint = MAT_POINT.clone()

  constructor() {
    this.scene.background = new THREE.Color('#0d0c0b')
    this.room.name = 'grey-box'
    this.scene.add(this.room)
    this.buildRoom()
    this.buildCounter()
    this.buildWallCases()
    this.buildWindowAndDoor()
    this.buildFixtures()
    this.buildLights()
    this.customer = this.buildCustomer()
  }

  /** Load the HDRI and set it as the scene environment (reflections + ambient). */
  async loadEnvironment(renderer: THREE.WebGLRenderer, opts: SceneOptions): Promise<void> {
    const hdr = await new HDRLoader().loadAsync(opts.envUrl)
    hdr.mapping = THREE.EquirectangularReflectionMapping
    const pmrem = new THREE.PMREMGenerator(renderer)
    const env = pmrem.fromEquirectangular(hdr).texture
    hdr.dispose()
    pmrem.dispose()
    this.scene.environment = env
    this.scene.environmentIntensity = ENV_INTENSITY.counter
    this.disposables.push(env)
  }

  /**
   * Swap the grey box for the baked shop. Resolves to the bake manifest, or
   * null if there is no bake yet (the grey box stays).
   */
  async loadBaked(renderer: THREE.WebGLRenderer, base: string): Promise<ShopManifest | null> {
    try {
      const baked = await loadBakedShop(renderer, base)
      this.baked = baked
      this.scene.add(baked.group)
      this.scene.remove(this.room)
      disposeTree(this.room)
      return baked.manifest
    } catch (err) {
      console.info('[shop] using the grey box:', err instanceof Error ? err.message : err)
      return null
    }
  }

  /**
   * Swap the canvas card outside the window for the rendered canal
   * (art/backdrop, seen through the window and the door glass). The card
   * stays if the render is missing or fails to load.
   */
  async loadBackdrop(renderer: THREE.WebGLRenderer, base: string): Promise<boolean> {
    try {
      const backdrop = await loadCanalBackdrop(renderer, base)
      backdrop.setState(this.backdropState.clock, this.backdropState.reduceMotion)
      this.backdrop = backdrop
      this.scene.add(backdrop.mesh)
      if (this.backdropCard) {
        this.scene.remove(this.backdropCard)
        disposeTree(this.backdropCard)
        this.backdropCard = null
      }
      return true
    } catch (err) {
      console.info('[shop] canal backdrop: keeping the canvas card:', err instanceof Error ? err.message : err)
      return false
    }
  }

  /** Sync render-owned objects to game state. Never mutates state. */
  sync(state: GameState): void {
    this.backdropState = { clock: state.day.clock, reduceMotion: state.settings.reduceMotion }
    this.backdrop?.setState(state.day.clock, state.settings.reduceMotion)
    // Dim the customer while inspecting so they don't fight the item.
    this.customerTarget = !state.current ? 0 : state.current.phase === 'inspect' ? INSPECT_CUSTOMER_OPACITY : 1
    const look = state.current ? this.lookOf(state.current.customer) : null
    if (look !== this.wantLook) {
      this.wantLook = look
      if (look) this.requestLook(look)
    }
    const next = state.queue[0]
    this.nextLook = next ? this.lookOf(next.customer) : null
    // Fetch the next person while this one talks.
    if (this.cast && this.nextLook) this.cast.get(this.nextLook).catch(() => {})
    this.cast?.retain([this.shownLook, this.wantLook, this.nextLook])
  }

  /** 'in' once the current customer stands at the counter, faded in (the UI and screenshots wait for it); 'away' with nobody there. */
  get customerState(): 'away' | 'arriving' | 'in' {
    if (this.wantLook === null || this.customerTarget === 0) return 'away'
    const ready = this.shownLook === this.wantLook && this.walkPhase === 'here' && Math.abs(this.customerFade - this.customerTarget) < 0.01
    return ready ? 'in' : 'arriving'
  }

  /** false: customers appear at the counter without walking (?walk=0). */
  setWalking(on: boolean): void {
    this.walking = on
  }

  /** Play customers with the 3D cast (otherwise the silhouette stands in). `override`: everyone is that cast id. */
  setCast(cast: CustomerCast, override: string | null = null): void {
    this.cast = cast
    this.castOverride = override
  }

  private lookOf(customer: Parameters<typeof lookFor>[0]): string | null {
    return this.castOverride ?? lookFor(customer) ?? customer.archetype
  }

  private requestLook(look: string): void {
    if (look === this.shownLook) {
      this.pending = null
      return
    }
    if (!this.cast) {
      this.pending = { look, model: null }
      return
    }
    this.cast.get(look).then(
      (model) => {
        if (this.wantLook === look) this.pending = { look, model }
      },
      () => {
        if (this.wantLook === look) this.pending = { look, model: null }
      },
    )
  }

  /** Swap in a loaded look (only while the customer is out of sight). */
  private installLook(p: { look: string; model: CustomerModel | null }): void {
    this.model?.root.removeFromParent()
    this.model = p.model
    this.silhouette.visible = !p.model
    if (p.model) this.customer.add(p.model.root)
    this.customerMats = p.model ? p.model.materials : this.silhouetteMats
    this.customerMixer = p.model ? p.model.mixer : null
    p.model?.play('idle', 0)
    for (const m of this.customerMats) {
      m.opacity = this.customerFade
      m.transparent = true
      m.needsUpdate = true
    }
    this.customerOpaque = false
    this.shownLook = p.look
    this.pending = null
    this.cast?.retain([this.shownLook, this.wantLook, this.nextLook])
  }

  /**
   * Retune the two real-time lights for the inspect view (no extra lights):
   * the window fill becomes a soft key from the upper left of the camera and
   * the counter lamp a warm rim from the right, so metals read well.
   * 0 = counter lighting, 1 = inspect lighting.
   */
  setInspectBlend(b: number): void {
    const { lamp, fill, lampPos, fillPos, fillTarget } = this.lights
    const P = INSPECT_POINT
    lamp.position.copy(lampPos).lerp(TMP.set(P.x - 0.3, P.y + 0.18, P.z + 0.22), b)
    lamp.intensity = 2.2 + (0.35 - 2.2) * b
    fill.position.copy(fillPos).lerp(TMP.set(P.x + 0.9, P.y + 1.1, P.z - 1.3), b)
    fill.target.position.copy(fillTarget).lerp(P, b)
    fill.intensity = 1.1 + (1.9 - 1.1) * b
    if (this.scene.environment) {
      this.scene.environmentIntensity = ENV_INTENSITY.counter + (ENV_INTENSITY.inspect - ENV_INTENSITY.counter) * b
    }
  }

  update(dt: number): void {
    this.backdrop?.update(dt)
    this.updateWalk(dt)
    // Fully faded in, draw opaque (a transparent skinned body sorts badly against itself).
    const opaque = this.customerFade > 0.99
    for (const mat of this.customerMats) {
      mat.opacity = this.customerFade
      if (opaque !== this.customerOpaque) {
        mat.transparent = !opaque || mat.userData.blend === true
        mat.needsUpdate = true
      }
    }
    this.customerOpaque = opaque
    if (this.customer.visible) this.customerMixer?.update(dt)
  }

  /**
   * Move the customer along the door → counter line and set their fade. A new
   * look only swaps in while nobody is in the shop; whoever is there walks
   * out first.
   */
  private updateWalk(dt: number): void {
    const wanted = this.wantLook !== null && this.customerTarget > 0
    const mine = wanted && this.shownLook === this.wantLook
    if (this.walkPhase === 'out') {
      if (this.pending) this.installLook(this.pending)
      if (mine) {
        this.walkPhase = this.walking ? 'entering' : 'here'
        this.walkT = this.walking ? 0 : 1
        this.customer.rotation.y = this.walking ? this.heading(WALK.spot, WALK.door) : 0
        if (this.walking) this.model?.play('walk', 0)
      }
    } else if (!mine && this.walkPhase !== 'leaving') {
      this.walkPhase = this.walking ? 'leaving' : 'out'
      if (!this.walking) this.walkT = 0
    }

    const length = WALK.door.distanceTo(WALK.spot)
    const speed = this.model?.walkSpeed ?? WALK.speed
    const step = (speed * dt) / length
    if (this.walkPhase === 'entering') {
      this.walkT = Math.min(1, this.walkT + step)
      if (this.walkT >= 1) {
        // At the counter: settle into the idle while turning to the player.
        this.model?.play('idle', WALK.blend)
        if (this.turnTo(0, dt)) this.walkPhase = 'here'
      }
    } else if (this.walkPhase === 'leaving') {
      // Turn towards the door first, then walk.
      if (this.walkT <= 0 || this.turnTo(this.heading(WALK.door, this.customer.position), dt)) {
        this.model?.play('walk', WALK.blend)
        this.walkT = Math.max(0, this.walkT - step)
      }
      if (this.walkT <= 0) {
        this.walkPhase = 'out'
        this.model?.play('idle', 0)
      }
    }
    this.customer.position.lerpVectors(WALK.door, WALK.spot, this.walkT)

    // Fade: in and out over the first stretch from the door; dimmed while inspecting.
    const fromDoor = this.walkT * length
    const doorFade = this.walkPhase === 'out' ? 0 : Math.min(1, fromDoor / WALK.fadeDistance)
    const dim = this.walkPhase === 'here' ? this.customerTarget || 1 : 1
    const target = doorFade * dim
    this.customerFade += (target - this.customerFade) * Math.min(1, dt * 6)
    if (Math.abs(target - this.customerFade) < 0.002) this.customerFade = target
    this.customer.visible = this.customerFade > 0.01
  }

  /** Yaw that points the customer (whose front is −z) from `from` towards `to`. */
  private heading(to: THREE.Vector3, from: THREE.Vector3): number {
    return Math.atan2(-(to.x - from.x), -(to.z - from.z))
  }

  /** Turn towards `yaw`; true once facing it. */
  private turnTo(yaw: number, dt: number): boolean {
    let d = yaw - this.customer.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    const maxStep = WALK.turnRate * dt
    if (Math.abs(d) <= maxStep) {
      this.customer.rotation.y = yaw
      return true
    }
    this.customer.rotation.y += Math.sign(d) * maxStep
    return false
  }

  dispose(): void {
    this.model?.root.removeFromParent()
    this.cast?.dispose()
    if (this.baked) {
      this.scene.remove(this.baked.group)
      this.baked.dispose()
    }
    if (this.backdrop) {
      this.scene.remove(this.backdrop.mesh)
      this.backdrop.dispose()
    }
    disposeTree(this.scene)
    for (const d of this.disposables) d.dispose()
  }

  // ---------------------------------------------------------------------------

  private track<T extends { dispose(): void }>(thing: T): T {
    this.disposables.push(thing)
    return thing
  }

  private box(
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = this.room,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  private buildRoom(): void {
    const { halfW, halfD, height } = ROOM
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.track(parquetTexture()),
      roughness: 0.62,
      metalness: 0,
    })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, halfD * 2), floorMat)
    floor.rotation.x = -Math.PI / 2
    this.room.add(floor)

    const plaster = this.track(plasterTexture())
    const wallMat = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.95, color: '#f2ead8' })
    const walls: [number, number, number, number, number][] = [
      // width, x, z, rotY, (unused)
      [halfD * 2, -halfW, 0, Math.PI / 2, 0],
      [halfD * 2, halfW, 0, -Math.PI / 2, 0],
      [halfW * 2, 0, -halfD, 0, 0],
    ]
    for (const [w, x, z, ry] of walls) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, height), wallMat)
      wall.position.set(x, height / 2, z)
      wall.rotation.y = ry
      this.room.add(wall)
    }

    // Front (street) wall, built around the window and door openings.
    const front = new THREE.Shape()
    front.moveTo(-halfW, 0)
    front.lineTo(halfW, 0)
    front.lineTo(halfW, height)
    front.lineTo(-halfW, height)
    front.lineTo(-halfW, 0)
    const windowHole = new THREE.Path()
    windowHole.moveTo(-2.5, 0.85)
    windowHole.lineTo(0.5, 0.85)
    windowHole.lineTo(0.5, 3.25)
    windowHole.lineTo(-2.5, 3.25)
    windowHole.lineTo(-2.5, 0.85)
    const doorHole = new THREE.Path()
    doorHole.moveTo(1.1, 0)
    doorHole.lineTo(2.3, 0)
    doorHole.lineTo(2.3, 2.4)
    doorHole.lineTo(1.1, 2.4)
    doorHole.lineTo(1.1, 0)
    front.holes.push(windowHole, doorHole)
    const frontGeo = new THREE.ShapeGeometry(front)
    // ShapeGeometry UVs are in metres; normalise to 0..1 like the other walls.
    const uv = frontGeo.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + halfW) / (halfW * 2), uv.getY(i) / height)
    const frontWall = new THREE.Mesh(frontGeo, wallMat)
    frontWall.position.z = halfD
    frontWall.rotation.y = Math.PI
    frontWall.scale.x = -1 // keep the hole layout in world-x after the flip
    this.room.add(frontWall)

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 2, halfD * 2),
      new THREE.MeshStandardMaterial({ color: '#c9c1b0', roughness: 1 }),
    )
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = height
    this.room.add(ceiling)

    // Painted lower walls (oil-paint dado, typical of old ground-floor shops)
    const dadoMat = new THREE.MeshStandardMaterial({ color: '#33473f', roughness: 0.45 })
    const dadoH = 1.15
    const dadoL = new THREE.Mesh(new THREE.PlaneGeometry(halfD * 2, dadoH), dadoMat)
    dadoL.position.set(-halfW + 0.005, dadoH / 2, 0)
    dadoL.rotation.y = Math.PI / 2
    const dadoR = dadoL.clone()
    dadoR.position.x = halfW - 0.005
    dadoR.rotation.y = -Math.PI / 2
    const dadoB = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, dadoH), dadoMat)
    dadoB.position.set(0, dadoH / 2, -halfD + 0.005)
    this.room.add(dadoL, dadoR, dadoB)
    const railMat = new THREE.MeshStandardMaterial({ color: '#1f2b26', roughness: 0.5 })
    this.box(0.03, 0.04, halfD * 2, railMat, -halfW + 0.015, dadoH, 0)
    this.box(0.03, 0.04, halfD * 2, railMat, halfW - 0.015, dadoH, 0)

    // Skirting boards
    const skirtMat = new THREE.MeshStandardMaterial({ color: '#2a1c14', roughness: 0.7 })
    this.box(0.03, 0.14, halfD * 2, skirtMat, -halfW + 0.015, 0.07, 0)
    this.box(0.03, 0.14, halfD * 2, skirtMat, halfW - 0.015, 0.07, 0)
    this.box(halfW * 2, 0.14, 0.03, skirtMat, 0, 0.07, -halfD + 0.015)
  }

  private buildCounter(): void {
    const { z, width, depth, baseH, caseH } = COUNTER
    const wood = new THREE.MeshStandardMaterial({ color: '#3b2417', roughness: 0.55, metalness: 0 })
    const brass = new THREE.MeshStandardMaterial({ color: '#b08a45', roughness: 0.35, metalness: 1 })
    const felt = new THREE.MeshStandardMaterial({ color: '#2d3a2c', roughness: 1 })
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#dfeee8',
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.2,
      envMapIntensity: 1.6,
      depthWrite: false,
    })

    const counter = new THREE.Group()
    counter.position.z = z
    this.room.add(counter)

    // Wooden base with a kick plate
    this.box(width, baseH, depth, wood, 0, baseH / 2, 0, counter)
    this.box(width - 0.02, 0.08, depth - 0.06, new THREE.MeshStandardMaterial({ color: '#160e09' }), 0, 0.04, 0.02, counter)

    // Showcase: wooden case walls, felt bed inside, glass top only, brass rim.
    const top = baseH + caseH
    const wall = 0.03
    this.box(width - 2 * wall, 0.02, depth - 2 * wall, felt, 0, baseH + 0.01, 0, counter)
    for (const sz of [-1, 1]) this.box(width, caseH, wall, wood, 0, baseH + caseH / 2, sz * (depth / 2 - wall / 2), counter)
    for (const sx of [-1, 1]) this.box(wall, caseH, depth - 2 * wall, wood, sx * (width / 2 - wall / 2), baseH + caseH / 2, 0, counter)
    const glassTop = this.box(width - 2 * wall, 0.008, depth - 2 * wall, glass, 0, top - 0.006, 0, counter)
    glassTop.renderOrder = 2
    const t = 0.02
    for (const sz of [-1, 1]) this.box(width + 0.01, t, t * 1.6, brass, 0, top, sz * (depth / 2), counter)
    for (const sx of [-1, 1]) this.box(t * 1.6, t, depth + 0.01, brass, sx * (width / 2), top, 0, counter)
    // brass corner caps down the customer-side edges
    for (const sx of [-1, 1]) this.box(t, caseH + baseH - 0.08, t, brass, sx * (width / 2), (caseH + baseH - 0.08) / 2 + 0.08, depth / 2, counter)

    // A few placeholder trinkets under the glass
    const gold = new THREE.MeshStandardMaterial({ color: '#d4a64a', roughness: 0.25, metalness: 1 })
    const steel = new THREE.MeshStandardMaterial({ color: '#b9bcbf', roughness: 0.3, metalness: 1 })
    const ringGeo = new THREE.TorusGeometry(0.035, 0.007, 8, 24)
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(ringGeo, gold)
      ring.rotation.x = -Math.PI / 2 + 0.2 * (i % 2)
      ring.position.set(0.08 + i * 0.09, baseH + 0.03, 0.14 + (i % 2) * 0.06)
      counter.add(ring)
    }
    for (let i = 0; i < 3; i++) {
      const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), steel)
      watch.position.set(-0.1 - i * 0.13, baseH + 0.027, 0.16 + (i % 2) * 0.05)
      counter.add(watch)
    }

    // Rubber counter mat in front of the player, on the glass (items sit on MAT_POINT)
    this.box(0.46, 0.006, 0.32, new THREE.MeshStandardMaterial({ color: '#1c2a24', roughness: 0.9 }), 0, top + 0.012, 0.12, counter)

    // Contact shadow under the counter
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.7, depth + 0.7),
      new THREE.MeshBasicMaterial({ map: this.track(contactShadowTexture()), transparent: true, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(0, 0.003, z)
    this.room.add(shadow)
  }

  private buildWallCases(): void {
    const wood = new THREE.MeshStandardMaterial({ color: '#4a2f1e', roughness: 0.6 })
    const glass = new THREE.MeshStandardMaterial({
      color: '#cfe0da',
      roughness: 0.04,
      transparent: true,
      opacity: 0.14,
      envMapIntensity: 1.5,
      depthWrite: false,
    })
    const brass = new THREE.MeshStandardMaterial({ color: '#a8823f', roughness: 0.4, metalness: 1 })

    // Left wall: two tall glazed cases
    for (const cz of [0.2, 2.0]) {
      const g = new THREE.Group()
      g.position.set(-ROOM.halfW + 0.24, 0, cz)
      this.room.add(g)
      this.box(0.46, 0.8, 1.5, wood, 0, 0.4, 0, g)
      this.box(0.46, 1.2, 1.5, glass, 0, 1.4, 0, g).renderOrder = 2
      this.box(0.48, 0.06, 1.52, wood, 0, 2.03, 0, g)
      for (const sy of [1.2, 1.6]) this.box(0.42, 0.01, 1.44, glass, 0, sy, 0, g)
      // items: placeholder cameras and boxes
      for (let i = 0; i < 4; i++) {
        this.box(0.12, 0.08, 0.16, new THREE.MeshStandardMaterial({ color: i % 2 ? '#222' : '#5a5148', roughness: 0.5 }), 0, 0.85, -0.5 + i * 0.32, g)
      }
    }

    // Right wall: glass shelves on brass brackets
    const shelfZ = 1.2
    for (const [i, sy] of [1.0, 1.45, 1.9].entries()) {
      this.box(0.36, 0.012, 2.4, glass, ROOM.halfW - 0.2, sy, shelfZ).renderOrder = 2
      for (const bz of [-1.0, 1.0]) this.box(0.3, 0.03, 0.015, brass, ROOM.halfW - 0.17, sy - 0.02, shelfZ + bz)
      for (let k = 0; k < 4; k++) {
        const h = 0.1 + ((i + k) % 3) * 0.06
        const prop = this.box(
          0.12,
          h,
          0.12,
          new THREE.MeshStandardMaterial({ color: ['#6b4b2e', '#2f3438', '#8a7a64', '#3c2a3a'][k]!, roughness: 0.5 }),
          ROOM.halfW - 0.22,
          sy + h / 2 + 0.008,
          shelfZ - 0.9 + k * 0.6,
        )
        prop.rotation.y = 0.2 * k
      }
    }
    // Contact shadows under the left cases
    const shadowMat = new THREE.MeshBasicMaterial({ map: this.track(contactShadowTexture()), transparent: true, depthWrite: false })
    for (const cz of [0.2, 2.0]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.0), shadowMat)
      s.rotation.x = -Math.PI / 2
      s.position.set(-ROOM.halfW + 0.3, 0.003, cz)
      this.room.add(s)
    }
  }

  private buildWindowAndDoor(): void {
    const z = ROOM.halfD
    // Canal backdrop card outside the window (unlit so it reads as daylight). loadBackdrop()
    // swaps in the rendered canal; the card is the fallback.
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 3.5),
      new THREE.MeshBasicMaterial({ map: canalBackdropTexture(), toneMapped: false }),
    )
    backdrop.position.set(-1, 1.9, z + 1.6)
    backdrop.rotation.y = Math.PI
    this.scene.add(backdrop) // outside the room group: stays when the baked shop replaces the room
    this.backdropCard = backdrop

    const frame = new THREE.MeshStandardMaterial({ color: '#e7e1d3', roughness: 0.6 })
    // window frame and mullions
    const wx0 = -2.5
    const wx1 = 0.5
    const wy0 = 0.85
    const wy1 = 3.25
    const fw = 0.07
    this.box(wx1 - wx0, fw, 0.12, frame, (wx0 + wx1) / 2, wy0, z)
    this.box(wx1 - wx0, fw, 0.12, frame, (wx0 + wx1) / 2, wy1, z)
    this.box(wx1 - wx0, fw * 0.7, 0.08, frame, (wx0 + wx1) / 2, 2.55, z)
    for (const x of [wx0, -1.0, wx1]) this.box(fw, wy1 - wy0, 0.12, frame, x, (wy0 + wy1) / 2, z)
    // sill
    this.box(wx1 - wx0 + 0.2, 0.04, 0.3, frame, (wx0 + wx1) / 2, wy0 - 0.02, z - 0.12)
    // shop sign lettering is M3+; a dark strip stands in for the sign board
    this.box(wx1 - wx0, 0.18, 0.02, new THREE.MeshStandardMaterial({ color: '#2a201a' }), (wx0 + wx1) / 2, wy1 - 0.12, z - 0.05)

    // Door: dark painted wood with a glass panel
    const doorMat = new THREE.MeshStandardMaterial({ color: '#2c3b35', roughness: 0.55 })
    const door = new THREE.Group()
    door.position.set(1.7, 0, z - 0.03)
    this.room.add(door)
    this.box(1.2, 0.9, 0.05, doorMat, 0, 0.45, 0, door)
    this.box(1.2, 0.35, 0.05, doorMat, 0, 2.225, 0, door)
    this.box(0.15, 1.15, 0.05, doorMat, -0.525, 1.475, 0, door)
    this.box(0.15, 1.15, 0.05, doorMat, 0.525, 1.475, 0, door)
    const doorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 1.15),
      new THREE.MeshBasicMaterial({ color: '#c9d2d4', toneMapped: false }),
    )
    doorGlass.position.set(0, 1.475, 0.01)
    doorGlass.rotation.y = Math.PI
    door.add(doorGlass)
    this.box(0.04, 0.2, 0.06, new THREE.MeshStandardMaterial({ color: '#b08a45', metalness: 1, roughness: 0.35 }), -0.45, 1.05, -0.04, door)
  }

  private buildFixtures(): void {
    // Radiator under the window
    const radMat = new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.5, metalness: 0.2 })
    const rad = new THREE.Group()
    rad.position.set(-1, 0.18, ROOM.halfD - 0.12)
    this.room.add(rad)
    for (let i = 0; i < 14; i++) this.box(0.05, 0.55, 0.09, radMat, -0.65 + i * 0.1, 0.275, 0, rad)

    // Ceiling pendants (emissive shades; real lights come from the bake in M3)
    const cord = new THREE.MeshBasicMaterial({ color: '#111' })
    const shade = new THREE.MeshStandardMaterial({ color: '#2b2b26', roughness: 0.6, side: THREE.DoubleSide })
    const bulb = new THREE.MeshBasicMaterial({ color: '#ffd8a0', toneMapped: false })
    for (const pz of [-1.6, 1.4]) {
      const p = new THREE.Group()
      p.position.set(0, ROOM.height, pz)
      this.room.add(p)
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4), cord)
      c.position.y = -0.6
      p.add(c)
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 20, 1, true), shade)
      s.position.y = -1.3
      p.add(s)
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), bulb)
      b.position.y = -1.38
      p.add(b)
    }

    // Counter lamp (the real-time warm light sits in its shade)
    const lamp = new THREE.Group()
    lamp.position.set(1.15, COUNTER.baseH + COUNTER.caseH, COUNTER.z - 0.15)
    this.room.add(lamp)
    const metal = new THREE.MeshStandardMaterial({ color: '#1f3a2c', roughness: 0.4, metalness: 0.6 })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 20), metal)
    base.position.y = 0.015
    lamp.add(base)
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.38, 6), metal)
    arm.position.set(-0.04, 0.2, 0)
    arm.rotation.z = 0.25
    lamp.add(arm)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 16, 1, true), metal)
    head.position.set(-0.1, 0.38, 0.02)
    head.rotation.z = 0.9
    lamp.add(head)

    // Back wall: safe door and back-office door (behind the player; seen when turning in later milestones)
    const safe = new THREE.MeshStandardMaterial({ color: '#3a3d3a', roughness: 0.45, metalness: 0.7 })
    this.box(0.9, 1.2, 0.12, safe, -1.8, 0.6, -ROOM.halfD + 0.06)
    this.box(0.9, 2.1, 0.06, new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 0.6 }), 1.6, 1.05, -ROOM.halfD + 0.03)
  }

  private buildLights(): void {
    // 1) Counter lamp: warm, short range
    const lamp = new THREE.PointLight('#ffc98a', 2.2, 4.5, 1.6)
    lamp.position.set(1.02, COUNTER.baseH + COUNTER.caseH + 0.33, COUNTER.z - 0.13)
    this.scene.add(lamp)
    // 2) Window fill: cool daylight from the street
    const fill = new THREE.DirectionalLight('#dfe8f0', 1.1)
    fill.position.set(-1, 3, ROOM.halfD + 2)
    fill.target.position.set(0, 0.8, -2)
    this.scene.add(fill, fill.target)
    this.lights = {
      lamp,
      fill,
      lampPos: lamp.position.clone(),
      fillPos: fill.position.clone(),
      fillTarget: fill.target.position.clone(),
    }
  }

  private buildCustomer(): THREE.Group {
    // The customer slot: a cast model goes in here; the silhouette stands in without one.
    const g = new THREE.Group()
    const sil = new THREE.Group()
    const mat = () =>
      new THREE.MeshStandardMaterial({ color: '#4c5560', roughness: 0.85, transparent: true, opacity: 0 })
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 4, 12), mat())
    body.position.y = 1.0
    body.scale.set(1, 1, 0.6)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mat())
    head.position.y = 1.68
    sil.add(body, head)
    g.add(sil)
    this.silhouette = sil
    this.silhouetteMats = [body.material, head.material]
    this.customerMats = this.silhouetteMats
    g.position.set(-0.15, 0, -1.45)
    g.visible = false
    this.scene.add(g)
    return g
  }
}

const TMP = new THREE.Vector3()

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) {
      mesh.geometry.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const m of mats) {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose()
        m.dispose()
      }
    }
  })
}
