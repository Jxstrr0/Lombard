/**
 * Orbit / zoom gestures from Pointer Events (touch, mouse and pen share one path).
 * One pointer drags = orbit; two pointers pinch = zoom; the mouse wheel zooms.
 * Knows nothing about Three.js or game state: it only reports deltas.
 */
export interface GestureHandlers {
  /** Drag delta in CSS pixels. */
  orbit(dx: number, dy: number): void
  /** factor > 1 = zoom in. */
  zoom(factor: number): void
  /** Called when a drag starts (true) and ends (false). */
  dragging?(on: boolean): void
}

export class OrbitGestures {
  private pointers = new Map<number, { x: number; y: number }>()
  private pinchDist = 0
  private readonly abort = new AbortController()

  constructor(
    private readonly el: HTMLElement,
    private readonly handlers: GestureHandlers,
  ) {
    const opts = { signal: this.abort.signal }
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', this.onDown, opts)
    el.addEventListener('pointermove', this.onMove, opts)
    el.addEventListener('pointerup', this.onUp, opts)
    el.addEventListener('pointercancel', this.onUp, opts)
    el.addEventListener('lostpointercapture', this.onUp, opts)
    el.addEventListener('wheel', this.onWheel, { signal: this.abort.signal, passive: false })
  }

  dispose(): void {
    this.abort.abort()
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    this.el.setPointerCapture?.(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 1) this.handlers.dragging?.(true)
    if (this.pointers.size === 2) this.pinchDist = this.distance()
  }

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    if (this.pointers.size === 1) {
      this.handlers.orbit(dx, dy)
    } else if (this.pointers.size === 2) {
      const d = this.distance()
      if (this.pinchDist > 0 && d > 0) this.handlers.zoom(d / this.pinchDist)
      this.pinchDist = d
    }
  }

  private onUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return
    if (this.pointers.size < 2) this.pinchDist = 0
    if (this.pointers.size === 0) this.handlers.dragging?.(false)
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    this.handlers.zoom(Math.exp(-delta * 0.0015))
  }

  private distance(): number {
    const [a, b] = [...this.pointers.values()]
    if (!a || !b) return 0
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
}
