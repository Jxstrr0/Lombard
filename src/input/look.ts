/**
 * Head-look gestures for the counter view, from Pointer Events on the 3D
 * canvas (touch, mouse and pen share one path). UI panels sit above the canvas
 * with their own pointer handling, so a drag can only start on the 3D view.
 *
 * - One pointer moved past DRAG_THRESHOLD_PX = a look drag (deltas in CSS px).
 * - A short press that never crossed the threshold = a tap; two taps close in
 *   time and place = a double tap (the first one still reports as a tap).
 * - A second pointer (pinch) cancels the drag and is otherwise ignored until
 *   every pointer is up.
 *
 * Knows nothing about Three.js or game state: it only reports gestures.
 */
export interface LookHandlers {
  /** Is head-look active right now (counter view, not inspect)? Checked on pointer down. */
  enabled(): boolean
  /** Drag delta in CSS pixels since the last call. */
  look(dx: number, dy: number): void
  /** A look drag started (true) or ended (false). */
  dragging(on: boolean): void
  /** Tap at client coordinates (CSS px). */
  tap(x: number, y: number): void
  doubleTap(x: number, y: number): void
}

/** Movement before a press becomes a drag: touch is coarser than a mouse. */
const DRAG_THRESHOLD_PX = { touch: 10, mouse: 4 }
/** Longest press that still counts as a tap. */
const TAP_MAX_MS = 600
/** Second tap within this time and distance of the first = double tap. */
const DOUBLE_TAP_MS = 320
const DOUBLE_TAP_PX = 36

interface Press {
  id: number
  startX: number
  startY: number
  x: number
  y: number
  t: number
  threshold: number
  dragging: boolean
}

export class LookGestures {
  private press: Press | null = null
  /** Extra pointers seen during this press (pinch): the gesture is void until all are up. */
  private extra = new Set<number>()
  private cancelled = false
  private lastTap: { x: number; y: number; t: number } | null = null
  private readonly abort = new AbortController()

  constructor(
    private readonly el: HTMLElement,
    private readonly handlers: LookHandlers,
  ) {
    const opts = { signal: this.abort.signal }
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', this.onDown, opts)
    el.addEventListener('pointermove', this.onMove, opts)
    el.addEventListener('pointerup', this.onUp, opts)
    el.addEventListener('pointercancel', this.onCancel, opts)
    el.addEventListener('lostpointercapture', this.onCancel, opts)
  }

  dispose(): void {
    this.abort.abort()
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (this.press) {
      // A second finger: pinch does nothing in the counter view.
      this.extra.add(e.pointerId)
      this.cancel()
      return
    }
    if (this.extra.size > 0 || !this.handlers.enabled()) return
    try {
      this.el.setPointerCapture?.(e.pointerId)
    } catch {
      // pointer already gone (synthetic or cancelled): track it without capture
    }
    this.cancelled = false
    this.press = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      threshold: e.pointerType === 'mouse' ? DRAG_THRESHOLD_PX.mouse : DRAG_THRESHOLD_PX.touch,
      dragging: false,
    }
  }

  private onMove = (e: PointerEvent) => {
    const p = this.press
    if (!p || p.id !== e.pointerId || this.cancelled) return
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < p.threshold) return
      if (!this.handlers.enabled()) return
      p.dragging = true
      this.el.classList.add('is-looking')
      this.handlers.dragging(true)
    }
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    this.handlers.look(dx, dy)
  }

  private onUp = (e: PointerEvent) => {
    if (this.extra.delete(e.pointerId)) return
    const p = this.press
    if (!p || p.id !== e.pointerId) return
    this.press = null
    if (p.dragging) {
      this.endDrag()
      return
    }
    if (this.cancelled || e.timeStamp - p.t > TAP_MAX_MS || !this.handlers.enabled()) return
    const last = this.lastTap
    if (last && e.timeStamp - last.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_TAP_PX) {
      this.lastTap = null
      this.handlers.doubleTap(e.clientX, e.clientY)
      return
    }
    this.lastTap = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    this.handlers.tap(e.clientX, e.clientY)
  }

  private onCancel = (e: PointerEvent) => {
    this.extra.delete(e.pointerId)
    if (this.press?.id !== e.pointerId) return
    if (this.press.dragging) this.endDrag()
    this.press = null
  }

  /** Void the current press (pinch started): stop any drag, no tap. */
  private cancel(): void {
    if (this.press?.dragging) this.endDrag()
    if (this.press) this.press.dragging = false
    this.cancelled = true
    this.lastTap = null
  }

  private endDrag(): void {
    this.el.classList.remove('is-looking')
    this.handlers.dragging(false)
  }
}
