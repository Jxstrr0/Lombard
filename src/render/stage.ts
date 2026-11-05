/**
 * Item stage: the customer's item on the counter mat, lifted to eye level for
 * inspection, orbited and zoomed by the player, with cheap tool feedback.
 *
 * Reads game state in `sync`; never mutates it.
 *
 * Counter display scale: placeholder items are built at real size, and a 2 cm
 * ring on the mat is only ~8 px tall from the counter camera on a phone. On
 * the counter the item is scaled up so its largest side reads as ~9 cm
 * (factor clamped to 1.2–5×). In inspect it is shown at true size (the camera
 * comes close instead). Scripted glb models keep the same real-size convention.
 */
import * as THREE from 'three'
import { getItemDef } from '../data/items'
import { fakeProfileOf } from '../game/items/generate'
import type { Hotspot, ItemDef, ToolId } from '../game/schema/item'
import type { GameState } from '../game/state'
import { INSPECT_POINT, type CameraRig } from './camera'
import { ItemModels, proxyOf } from './items'
import type { GlbLoader } from './loaders'
import { contactShadowTexture } from './textures'

const COUNTER_READ_SIZE = 0.09
const ZOOM_MIN = 0.45
const ZOOM_MAX = 2.6
const PITCH_LIMIT = 1.35
const DEFAULT_YAW = -0.42
const DEFAULT_PITCH = -0.22

export interface HotspotScreen {
  id: string
  label: string
  x: number
  y: number
  /** In front of the camera and not hidden behind the item. */
  visible: boolean
}

interface ToolAnim {
  tool: ToolId
  t: number
  magnetic: boolean
}

export class ItemStage {
  readonly pivot = new THREE.Group()
  private readonly models: ItemModels
  private model: THREE.Group | null = null
  private def: ItemDef | null = null
  private visitId: string | null = null
  private size = 0.05
  private counterScale = 1
  private lift = 0
  private present = false
  private exit: { t: number; dir: number } | null = null
  private inspecting = false
  private yaw = DEFAULT_YAW
  private pitch = DEFAULT_PITCH
  private velYaw = 0
  private velPitch = 0
  private dragging = false
  private zoom = 1
  private anim: ToolAnim | null = null
  reduceMotion = false

  private readonly shadow: THREE.Mesh
  private readonly qCounter = new THREE.Quaternion()
  private readonly qFront = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
  private readonly qTmp = new THREE.Quaternion()
  private readonly qTmp2 = new THREE.Quaternion()
  private readonly vTmp = new THREE.Vector3()
  private readonly raycaster = new THREE.Raycaster()
  private readonly matPoint: THREE.Vector3

  constructor(scene: THREE.Scene, matPoint: THREE.Vector3, loadGlb?: GlbLoader) {
    this.models = new ItemModels(3, loadGlb)
    this.models.onSwap((defId) => {
      if (this.def?.id === defId) this.fit()
    })
    this.matPoint = matPoint.clone()
    // Lying flat, dial/screen up, its top (+Y) pointing away from the player (towards the customer).
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
    this.qCounter.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).multiply(flat)
    this.pivot.name = 'item-stage'
    this.pivot.visible = false
    scene.add(this.pivot)

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.7 }),
    )
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.position.copy(this.matPoint).add(new THREE.Vector3(0, 0.0015, 0))
    this.shadow.renderOrder = 1
    this.shadow.visible = false
    scene.add(this.shadow)
  }

  /** Is an item currently in hand (inspect mode)? */
  get isInspecting(): boolean {
    return this.inspecting
  }

  get hotspots(): readonly Hotspot[] {
    return this.def?.model.hotspots ?? []
  }

  sync(state: GameState): void {
    const c = state.current
    if (!c) {
      if (this.present && !this.exit) this.exit = { t: 0, dir: -1 }
      this.present = false
      this.inspecting = false
      return
    }
    if (c.visitId !== this.visitId) {
      this.visitId = c.visitId
      this.setItem(c.item.defId)
      this.yaw = DEFAULT_YAW
      this.pitch = DEFAULT_PITCH
      this.zoom = 1
      this.velYaw = this.velPitch = 0
      this.exit = null
    }
    this.present = true
    this.inspecting = c.phase === 'inspect'
    if (c.phase === 'resolved' && !this.exit) {
      // Bought: slide towards the player; otherwise back to the customer.
      this.exit = { t: 0, dir: c.outcome === 'bought' ? -1 : 1 }
      if (this.reduceMotion) this.exit.t = 1
    }
  }

  /** Start the cheap visual for a tool use. `magnetic` = does the item pull to the magnet? */
  playTool(tool: ToolId, state: GameState): void {
    const c = state.current
    let magnetic = false
    if (tool === 'magnet' && c) {
      try {
        const def = getItemDef(c.item.defId)
        magnetic = fakeProfileOf(def, c.item)?.magnetic ?? def.magnetic
      } catch {
        magnetic = false
      }
    }
    this.anim = { tool, t: 0, magnetic }
  }

  /** One-finger drag / mouse drag, in CSS pixels. */
  orbit(dx: number, dy: number): void {
    if (!this.inspecting) return
    const k = 0.0085
    this.yaw += dx * k
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -PITCH_LIMIT, PITCH_LIMIT)
    this.velYaw = dx * k * 60
    this.velPitch = -dy * k * 60
  }

  setDragging(on: boolean): void {
    this.dragging = on
    if (on || this.reduceMotion) this.velYaw = this.velPitch = 0
  }

  /** factor > 1 zooms in. */
  zoomBy(factor: number): void {
    if (!this.inspecting) return
    this.zoom = THREE.MathUtils.clamp(this.zoom / factor, ZOOM_MIN, ZOOM_MAX)
  }

  /** Camera distance for the inspect view, from model.inspectDistance (clamped to sane bounds). */
  private inspectDistance(): number {
    const authored = this.def?.model.inspectDistance ?? this.size * 4
    return THREE.MathUtils.clamp(authored, this.size * 0.5, this.size * 10) * this.zoom
  }

  update(dt: number, rig: CameraRig): void {
    rig.inspectDistance = this.inspectDistance()
    const model = this.model
    if (!model) return

    // Exit slide when the visit resolves / ends
    let exitK = 0
    if (this.exit) {
      this.exit.t = this.reduceMotion ? 1 : Math.min(1, this.exit.t + dt / 0.55)
      exitK = this.exit.t
    }
    const visible = (this.present || (this.exit !== null && this.exit.t < 1)) && exitK < 1
    this.pivot.visible = visible
    if (!visible) {
      this.shadow.visible = false
      return
    }

    // Inertia after a flick (not with reduce-motion)
    if (!this.dragging && !this.reduceMotion && this.inspecting) {
      const decay = Math.exp(-dt * 5)
      this.velYaw *= decay
      this.velPitch *= decay
      this.yaw += this.velYaw * dt * 0.25
      this.pitch = THREE.MathUtils.clamp(this.pitch + this.velPitch * dt * 0.25, -PITCH_LIMIT, PITCH_LIMIT)
    }

    const b = rig.inspectBlend
    // Counter pose
    const counterPos = this.vTmp.copy(this.matPoint)
    counterPos.y += this.lift * this.counterScale + 0.0015
    if (this.exit) counterPos.z += this.exit.dir * 0.35 * this.exit.t
    // Inspect pose: turntable yaw (world Y) then pitch (world X), front facing the camera
    const qYaw = this.qTmp.setFromAxisAngle(Y_AXIS, this.yaw)
    const qPitch = this.qTmp2.setFromAxisAngle(X_AXIS, this.pitch)
    const qInspect = qPitch.multiply(qYaw).multiply(this.qFront)

    this.pivot.position.copy(counterPos).lerp(INSPECT_POINT, b)
    this.pivot.quaternion.copy(this.qCounter).slerp(qInspect, b)
    const s = this.counterScale + (1 - this.counterScale) * b
    this.pivot.scale.setScalar(s * (1 - exitK * 0.7))

    // Tool feedback offsets (world space, small)
    if (this.anim) {
      const a = this.anim
      a.t += dt
      const dur = 1.1
      const k = Math.min(1, a.t / dur)
      const env = Math.sin(Math.PI * k)
      if (a.tool === 'scale') this.pivot.position.y -= env * this.size * 0.18
      if (a.tool === 'magnet' && a.magnetic) {
        // jerk towards the magnet (screen right = world −X from the inspect camera)
        const snap = k < 0.35 ? Math.min(1, (k - 0.2) / 0.08) : 1 - (k - 0.35) / 0.65
        this.pivot.position.x -= Math.max(0, snap) * this.size * 0.22
      }
      if (a.tool === 'loupe') this.pivot.scale.multiplyScalar(1 + env * 0.04)
      if (a.t >= dur) this.anim = null
    }

    // Contact shadow on the mat (only while resting there)
    const shadowK = (1 - b) * (1 - exitK)
    this.shadow.visible = shadowK > 0.05
    ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.7 * shadowK
    this.shadow.position.z = counterPos.z
  }

  /** Screen positions of the current item's hotspots (CSS px), with an occlusion test. */
  hotspotScreen(camera: THREE.Camera, width: number, height: number): HotspotScreen[] {
    const model = this.model
    const def = this.def
    if (!model || !def || !this.pivot.visible) return []
    this.pivot.updateMatrixWorld(true)
    const out: HotspotScreen[] = []
    const camPos = camera.getWorldPosition(new THREE.Vector3())
    for (const h of def.model.hotspots) {
      const world = new THREE.Vector3(...h.position)
      model.localToWorld(world)
      const dist = world.distanceTo(camPos)
      const ndc = world.clone().project(camera)
      let visible = ndc.z > -1 && ndc.z < 1
      if (visible) {
        this.raycaster.set(camPos, world.clone().sub(camPos).normalize())
        this.raycaster.near = 0
        this.raycaster.far = dist
        const hits = this.raycaster.intersectObject(proxyOf(model), true)
        const first = hits[0]
        if (first && first.distance < dist - this.size * 0.06) visible = false
      }
      out.push({
        id: h.id,
        label: h.label,
        x: ((ndc.x + 1) / 2) * width,
        y: ((1 - ndc.y) / 2) * height,
        visible,
      })
    }
    return out
  }

  private setItem(defId: string): void {
    if (this.model) this.pivot.remove(this.model)
    this.model = null
    this.def = null
    let def: ItemDef
    try {
      def = getItemDef(defId)
    } catch (err) {
      console.warn('[stage] unknown item def', defId, err)
      return
    }
    const model = this.models.get(def)
    model.position.set(0, 0, 0)
    model.quaternion.identity()
    this.pivot.add(model)
    this.model = model
    this.def = def
    this.fit()
  }

  /** Size, counter scale, lift and shadow from the model's bounds (again when a glb swaps in). */
  private fit(): void {
    const model = this.model
    if (!model) return
    // Measure in the model's own frame (it sits at the pivot's origin; its scale is `model.scale`).
    const parent = model.parent
    parent?.remove(model)
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model.getObjectByName('glb') ?? model, true)
    parent?.add(model)
    const size = box.getSize(new THREE.Vector3())
    this.size = Math.max(size.x, size.y, size.z, 0.005)
    this.counterScale = THREE.MathUtils.clamp(COUNTER_READ_SIZE / this.size, 1.2, 5)
    // Lying flat: model −Z points down, so lift by the depth below the origin.
    this.lift = -box.min.z
    // Footprint for the contact shadow: model X × Y on the mat.
    this.shadow.scale.set(size.x * this.counterScale * 1.5, size.y * this.counterScale * 1.5, 1)
  }

  dispose(): void {
    this.models.dispose()
    this.shadow.geometry.dispose()
    const m = this.shadow.material as THREE.MeshBasicMaterial
    m.map?.dispose()
    m.dispose()
  }
}

const X_AXIS = new THREE.Vector3(1, 0, 0)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
