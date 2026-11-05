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
 * across it as it turns. The inspect lens spans INSPECT_FOV_DEG (30°) across the
 * narrow side of the free area, so at `model.inspectDistance` = 3 × the item's
 * largest dimension the item fills ~60% of that side.
 *
 * Head look (counter view only): the eye stays at EYE, the player drags to turn
 * the head (src/input/look.ts). `headYaw` / `headPitch` are offsets from the
 * default look direction: positive yaw turns right (towards world −X, the
 * window side), positive pitch looks up. Yaw is free (full turn); the resulting
 * pitch is clamped to PITCH_MIN…PITCH_MAX from horizontal. The offset fades out
 * with the inspect blend, so the lift into inspect works from any heading.
 */
import * as THREE from 'three'

// Standing a step back from the counter, looking slightly down at the glass.
const EYE = new THREE.Vector3(0, 1.62, -3.2)
// Portrait looks further down: the counter sits just above the dialogue strip.
const LOOK_PORTRAIT = new THREE.Vector3(0, 0.62, -0.9)
// Landscape/desktop: the strip is docked bottom-left, so frame counter and customer together.
const LOOK_LANDSCAPE = new THREE.Vector3(0, 1.0, -0.9)
// Offer view (portrait): the number pad covers most of the screen, so look up at the customer.
const LOOK_OFFER = new THREE.Vector3(0, 1.35, -0.9)

/** Where the item floats while inspected: just in front of the player's eyes, over the counter. */
export const INSPECT_POINT = new THREE.Vector3(0, 1.5, -2.7)
/** Field of view across the narrow side of the free screen area in inspect mode. */
const INSPECT_FOV_DEG = 30

// --- head look feel (camera feel, not gameplay: kept here, not in tuning.ts) ---
const DEG = Math.PI / 180
/** Degrees of head turn per CSS px of drag. */
const LOOK_DEG_PER_PX = 0.3
/** Absolute pitch limits of the view direction (from horizontal). */
const PITCH_MIN = -55 * DEG
const PITCH_MAX = 50 * DEG
/** Inertia after a flick: velocity decays with this time constant, s. */
const LOOK_INERTIA_TAU = 0.11
/** Fastest flick carried into inertia, rad/s. */
const LOOK_MAX_SPEED = 360 * DEG
/** A drag released after holding still this long carries no inertia, s. */
const LOOK_HOLD_STILL = 0.08
/** Smooth recentre: duration grows with the angle to cover, s. */
const RECENTRE_MIN_S = 0.35
const RECENTRE_MAX_S = 0.8

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

/** Wrap an angle to [−π, π). */
const wrapAngle = (a: number) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI))

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
  /** Head offset from the default look direction, radians (+yaw = right, +pitch = up). */
  private headYaw = 0
  private headPitch = 0
  /** Pitch of the default look direction last frame (for clamping the offset). */
  private basePitch = 0
  private lookDragging = false
  /** Drag input gathered since the last frame, radians. */
  private pendingYaw = 0
  private pendingPitch = 0
  private sinceInput = 0
  private velYaw = 0
  private velPitch = 0
  private recentring: { fromYaw: number; fromPitch: number; t: number; dur: number } | null = null

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
    if (on && this.offerTarget !== 1 && this.portrait) this.recentre()
    this.offerTarget = on ? 1 : 0
    if (this.reduceMotion) this.offer = this.offerTarget
  }

  setInspect(on: boolean): void {
    if (on && this.blendTarget !== 1) this.recentre()
    this.blendTarget = on ? 1 : 0
    if (this.reduceMotion) this.blend = this.blendTarget
  }

  /** Is the head offset from the default view (or still settling)? */
  get headTurned(): boolean {
    return this.headYaw !== 0 || this.headPitch !== 0
  }

  /** Can the player turn the head now? Only in the counter view, not while lifting into inspect. */
  get canLook(): boolean {
    return this.blendTarget === 0 && this.blend < 0.02
  }

  /** Drag to look, in CSS px (drag right = turn right, drag up = look up). */
  turnHead(dxPx: number, dyPx: number): void {
    if (!this.canLook) return
    this.recentring = null
    this.pendingYaw += dxPx * LOOK_DEG_PER_PX * DEG
    this.pendingPitch -= dyPx * LOOK_DEG_PER_PX * DEG
  }

  setLookDragging(on: boolean): void {
    this.lookDragging = on
    if (on) {
      this.recentring = null
      this.velYaw = this.velPitch = 0
      this.sinceInput = 0
    } else if (this.reduceMotion || this.sinceInput > LOOK_HOLD_STILL) {
      this.velYaw = this.velPitch = 0
    }
  }

  /** Set the head offset at once (?look= flag), degrees: +yaw = right, +pitch = up. */
  setHeadOffset(yawDeg: number, pitchDeg: number): void {
    this.recentring = null
    this.velYaw = this.velPitch = 0
    this.headYaw = wrapAngle(yawDeg * DEG)
    this.headPitch = pitchDeg * DEG
  }

  /** Turn the head back to the default view: smoothly, or at once with reduce-motion. */
  recentre(): void {
    this.velYaw = this.velPitch = 0
    this.pendingYaw = this.pendingPitch = 0
    this.headYaw = wrapAngle(this.headYaw)
    if (!this.headTurned) {
      this.recentring = null
      return
    }
    if (this.reduceMotion) {
      this.headYaw = this.headPitch = 0
      this.recentring = null
      return
    }
    const angle = Math.hypot(this.headYaw, this.headPitch)
    const dur = THREE.MathUtils.clamp(RECENTRE_MIN_S + (angle / Math.PI) * (RECENTRE_MAX_S - RECENTRE_MIN_S), RECENTRE_MIN_S, RECENTRE_MAX_S)
    this.recentring = { fromYaw: this.headYaw, fromPitch: this.headPitch, t: 0, dur }
  }

  /** Head offset after this frame's drag, inertia or recentre. */
  private updateHead(dt: number): void {
    if (this.recentring) {
      const r = this.recentring
      r.t = Math.min(r.dur, r.t + dt)
      const k = 1 - ease(r.t / r.dur)
      this.headYaw = r.fromYaw * k
      this.headPitch = r.fromPitch * k
      if (r.t >= r.dur) {
        this.headYaw = this.headPitch = 0
        this.recentring = null
      }
      return
    }
    if (this.lookDragging) {
      this.sinceInput = this.pendingYaw !== 0 || this.pendingPitch !== 0 ? 0 : this.sinceInput + dt
      if (dt > 0) {
        // Smoothed drag speed, carried into inertia on release.
        const a = 1 - Math.exp(-dt / 0.05)
        const cap = (v: number) => THREE.MathUtils.clamp(v, -LOOK_MAX_SPEED, LOOK_MAX_SPEED)
        this.velYaw += (cap(this.pendingYaw / dt) - this.velYaw) * a
        this.velPitch += (cap(this.pendingPitch / dt) - this.velPitch) * a
      }
      this.headYaw += this.pendingYaw
      this.headPitch += this.pendingPitch
    } else {
      this.headYaw += this.pendingYaw
      this.headPitch += this.pendingPitch
      if (!this.reduceMotion && (this.velYaw !== 0 || this.velPitch !== 0)) {
        this.headYaw += this.velYaw * dt
        this.headPitch += this.velPitch * dt
        const decay = Math.exp(-dt / LOOK_INERTIA_TAU)
        this.velYaw *= decay
        this.velPitch *= decay
        if (Math.abs(this.velYaw) + Math.abs(this.velPitch) < 0.002) this.velYaw = this.velPitch = 0
      }
    }
    this.pendingYaw = this.pendingPitch = 0
    this.headYaw = wrapAngle(this.headYaw)
    // Clamp the offset so the absolute pitch stays in range (no wind-up past the limit).
    const p = THREE.MathUtils.clamp(this.headPitch, PITCH_MIN - this.basePitch, PITCH_MAX - this.basePitch)
    if (p !== this.headPitch) this.velPitch = 0
    this.headPitch = p
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

    // Head look: turn the (blended) view direction by the head offset, which fades
    // out with the inspect blend. Turning in angle space (not lerping look points)
    // keeps the lift into inspect smooth even from a head turned all the way round.
    const v = this.tmp.subVectors(this.look, this.pos)
    const r = v.length()
    const yaw0 = Math.atan2(v.x, v.z)
    const pitch0 = Math.atan2(v.y, Math.hypot(v.x, v.z))
    this.basePitch = pitch0
    this.updateHead(dt)
    const hk = 1 - b
    if (hk > 0 && this.headTurned) {
      // +headYaw turns right; the camera looks along +Z, so screen right is world −X.
      const yaw = yaw0 - this.headYaw * hk
      const pitch = pitch0 + this.headPitch * hk
      const cp = Math.cos(pitch)
      this.look.set(this.pos.x + Math.sin(yaw) * cp * r, this.pos.y + Math.sin(pitch) * r, this.pos.z + Math.cos(yaw) * cp * r)
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
