/**
 * Counter camera: fixed at the player's eye behind the counter, with a slow
 * idle sway (breathing) that reduce-motion turns off.
 *
 * Portrait first: the bottom third of the screen is covered by the dialogue
 * strip, so the view is shifted up with a view offset to keep the counter
 * and customer in the visible upper part.
 */
import * as THREE from 'three'

// Standing a step back from the counter, looking slightly down at the glass.
const EYE = new THREE.Vector3(0, 1.62, -3.2)
// Portrait looks further down: the counter sits just above the dialogue strip.
const LOOK_PORTRAIT = new THREE.Vector3(0, 0.62, -0.9)
// Landscape/desktop: the strip is docked bottom-left, so frame counter and customer together.
const LOOK_LANDSCAPE = new THREE.Vector3(0, 1.0, -0.9)

export class CounterCamera {
  readonly camera: THREE.PerspectiveCamera
  reduceMotion = false
  private t = 0
  private readonly look = new THREE.Vector3()
  private base = LOOK_PORTRAIT

  constructor() {
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 40)
    this.camera.position.copy(EYE)
    this.camera.lookAt(this.base)
  }

  /**
   * @param width CSS pixels
   * @param height CSS pixels
   * @param overlayFraction share of the screen height covered by the bottom UI
   */
  resize(width: number, height: number, overlayFraction: number): void {
    const cam = this.camera
    cam.aspect = width / height
    const portrait = height > width
    // Portrait needs a much wider vertical FOV to get a usable horizontal one
    // (at 390x844, 78° vertical is ~41° horizontal).
    cam.fov = portrait ? 78 : 50
    this.base = portrait ? LOOK_PORTRAIT : LOOK_LANDSCAPE
    // Portrait: push the image up by half the strip so the scene centres in the free area.
    const shift = portrait ? Math.round(height * overlayFraction * 0.5) : 0
    if (shift > 0) cam.setViewOffset(width, height + shift, 0, shift, width, height)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
  }

  update(dt: number): void {
    this.t += dt
    const cam = this.camera
    if (this.reduceMotion) {
      cam.position.copy(EYE)
      cam.lookAt(this.base)
      return
    }
    // Two slow incommensurate sines: breathing and a lazy weight shift.
    const t = this.t
    const breathe = Math.sin(t * 1.1) * 0.006
    const shiftX = Math.sin(t * 0.23) * 0.018 + Math.sin(t * 0.61) * 0.004
    cam.position.set(EYE.x + shiftX, EYE.y + breathe, EYE.z)
    this.look.set(this.base.x + shiftX * 0.4, this.base.y + breathe * 0.5 + Math.sin(t * 0.37) * 0.01, this.base.z)
    cam.lookAt(this.look)
  }
}
