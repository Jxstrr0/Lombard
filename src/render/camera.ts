/**
 * Camera rig: the fixed counter view (with idle sway) and the inspect view,
 * blended smoothly when the item lifts to eye level.
 *
 * Projection is built by hand (focal length in pixels + principal point) so
 * each view can centre its subject inside the part of the screen that the UI
 * leaves free: portrait first, the bottom of the screen is covered by panels.
 *
 * Inspect: the camera parks in front of INSPECT_POINT looking along +Z; the
 * item (not the camera) is orbited by the stage, so the lamp highlight moves
 * across it as it turns. The inspect lens is narrow (INSPECT_FOV_DEG across the
 * narrow side of the free area), so `model.inspectDistance` should be about
 * 4 × the item's largest dimension for the item to fill ~60% of that side.
 */
import * as THREE from 'three'

// Standing a step back from the counter, looking slightly down at the glass.
const EYE = new THREE.Vector3(0, 1.62, -3.2)
// Portrait looks further down: the counter sits just above the dialogue strip.
const LOOK_PORTRAIT = new THREE.Vector3(0, 0.62, -0.9)
// Landscape/desktop: the strip is docked bottom-left, so frame counter and customer together.
const LOOK_LANDSCAPE = new THREE.Vector3(0, 1.0, -0.9)
// Offer view (portrait): the number pad covers most of the screen, so look up at the customer.
const LOOK_OFFER = new THREE.Vector3(0, 1.18, -0.9)

/** Where the item floats while inspected: just in front of the player's eyes, over the counter. */
export const INSPECT_POINT = new THREE.Vector3(0, 1.5, -2.7)
/** Field of view across the narrow side of the free screen area in inspect mode. */
const INSPECT_FOV_DEG = 20

export interface ViewLayout {
  width: number
  height: number
  /** Pixels covered by UI at the bottom in the counter view. */
  counterBottom: number
  /** Free band for the inspected item, px from the top. */
  inspectTop: number
  inspectBottom: number
  inspectLeft: number
  inspectRight: number
}

interface Lens {
  /** focal length, px */
  f: number
  /** principal point, px from the left / top */
  cx: number
  cy: number
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera
  reduceMotion = false
  /** 0 = counter, 1 = inspect. */
  private blend = 0
  private blendTarget = 0
  private t = 0
  private layout: ViewLayout = { width: 1, height: 1, counterBottom: 0, inspectTop: 0, inspectBottom: 1, inspectLeft: 0, inspectRight: 1 }
  private offer = 0
  private offerTarget = 0
  private portrait = true
  private counterLens: Lens = { f: 1, cx: 0, cy: 0 }
  private inspectLens: Lens = { f: 1, cx: 0, cy: 0 }
  private counterLook = LOOK_PORTRAIT
  /** Camera distance from INSPECT_POINT, metres (set by the stage: inspectDistance × zoom). */
  inspectDistance = 0.3
  private readonly look = new THREE.Vector3()
  private readonly pos = new THREE.Vector3()
  private readonly tmp = new THREE.Vector3()

  constructor() {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 40)
    this.camera.position.copy(EYE)
    this.camera.lookAt(LOOK_PORTRAIT)
  }

  /** Eased blend 0..1 between counter and inspect (for lights, vignette, stage). */
  get inspectBlend(): number {
    return ease(this.blend)
  }

  /** Offer view: frame the customer above the tall number pad (portrait only). */
  setOfferFocus(on: boolean): void {
    this.offerTarget = on ? 1 : 0
    if (this.reduceMotion) this.offer = this.offerTarget
  }

  setInspect(on: boolean): void {
    this.blendTarget = on ? 1 : 0
    if (this.reduceMotion) this.blend = this.blendTarget
  }

  resize(layout: ViewLayout): void {
    this.layout = layout
    const { width: w, height: h } = layout
    const portrait = h > w
    this.portrait = portrait
    this.counterLook = portrait ? LOOK_PORTRAIT : LOOK_LANDSCAPE
    if (portrait) {
      // ~36° horizontal; the look target sits a bit below the centre of the free area.
      const free = Math.max(h * 0.3, h - layout.counterBottom)
      this.counterLens = { f: w / 2 / Math.tan(THREE.MathUtils.degToRad(18)), cx: w / 2, cy: free * 0.6 }
    } else {
      this.counterLens = { f: h / 2 / Math.tan(THREE.MathUtils.degToRad(25)), cx: w / 2, cy: h / 2 }
    }
    const top = layout.inspectTop
    const bottom = Math.max(top + 120, layout.inspectBottom)
    const left = layout.inspectLeft
    const right = Math.max(left + 120, layout.inspectRight)
    const narrow = Math.min(right - left, bottom - top)
    this.inspectLens = {
      f: narrow / 2 / Math.tan(THREE.MathUtils.degToRad(INSPECT_FOV_DEG / 2)),
      cx: (left + right) / 2,
      cy: (top + bottom) / 2,
    }
    this.camera.aspect = w / h
  }

  update(dt: number): void {
    this.t += dt
    const step = dt / 0.65
    if (this.reduceMotion) this.blend = this.blendTarget
    else if (this.blend < this.blendTarget) this.blend = Math.min(this.blendTarget, this.blend + step)
    else if (this.blend > this.blendTarget) this.blend = Math.max(this.blendTarget, this.blend - step)
    const b = this.inspectBlend
    const ostep = dt / 0.5
    if (this.reduceMotion) this.offer = this.offerTarget
    else if (this.offer < this.offerTarget) this.offer = Math.min(this.offerTarget, this.offer + ostep)
    else if (this.offer > this.offerTarget) this.offer = Math.max(this.offerTarget, this.offer - ostep)
    const o = this.portrait ? ease(this.offer) : 0

    // Counter pose (with idle sway unless reduce-motion)
    let sx = 0
    let sy = 0
    let ly = 0
    if (!this.reduceMotion) {
      const t = this.t
      sy = Math.sin(t * 1.1) * 0.006
      sx = Math.sin(t * 0.23) * 0.018 + Math.sin(t * 0.61) * 0.004
      ly = Math.sin(t * 0.37) * 0.01
    }
    const swayK = 1 - b
    this.pos.set(EYE.x + sx * swayK, EYE.y + sy * swayK, EYE.z)
    const lookY = this.counterLook.y + (LOOK_OFFER.y - this.counterLook.y) * o
    this.look.set(this.counterLook.x + sx * 0.4 * swayK, lookY + (sy * 0.5 + ly) * swayK, this.counterLook.z)

    if (b > 0) {
      this.tmp.set(INSPECT_POINT.x, INSPECT_POINT.y, INSPECT_POINT.z - this.inspectDistance)
      this.pos.lerp(this.tmp, b)
      this.look.lerp(INSPECT_POINT, b)
    }
    const cam = this.camera
    cam.position.copy(this.pos)
    cam.lookAt(this.look)

    // Lens blend: interpolate focal length and principal point.
    const c = this.counterLens
    const i = this.inspectLens
    const near = b > 0.01 ? 0.008 : 0.05
    this.applyLens(
      { f: c.f + (i.f - c.f) * b, cx: c.cx + (i.cx - c.cx) * b, cy: c.cy + (i.cy - c.cy) * b },
      near,
    )
  }

  private applyLens(lens: Lens, near: number): void {
    const { width: w, height: h } = this.layout
    const cam = this.camera
    const far = 40
    const k = near / lens.f
    const left = -lens.cx * k
    const right = (w - lens.cx) * k
    const top = lens.cy * k
    const bottom = -(h - lens.cy) * k
    cam.near = near
    cam.far = far
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(h / 2 / lens.f))
    cam.projectionMatrix.makePerspective(left, right, top, bottom, near, far)
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert()
  }
}
