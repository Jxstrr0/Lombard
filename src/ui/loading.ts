/**
 * The loading screen. Its markup and style are written straight into
 * index.html (#loading), so it paints on the very first frame, before any
 * JavaScript arrives; this module only drives it once the bundle runs:
 * the progress bar, the fade-out when the first screen is ready, and the
 * error line with a Reload button if boot fails.
 */
import { t } from '../data/strings'

/** Fade length in ms; matches the transition in index.html. */
const FADE_MS = 400
/** Where the bar starts creeping by itself, and the most it creeps to. */
const CREEP_FROM = 0.9
const CREEP_TO = 0.99

export interface LoadingScreen {
  /** Move the bar to 0…1. It never goes backwards. */
  progress(fraction: number): void
  /** Fill the bar, fade out, then remove the screen from the page. */
  done(): void
  /** Swap the bar for a plain error line and a Reload button. */
  fail(message: string): void
  /** True while the screen is still on the page (not faded or removed). */
  readonly showing: boolean
}

export function bindLoadingScreen(doc: Document = document): LoadingScreen {
  const root = doc.getElementById('loading')
  const fill = root?.querySelector<HTMLElement>('.ld-fill') ?? null
  const bar = root?.querySelector<HTMLElement>('.ld-bar') ?? null
  const pct = root?.querySelector<HTMLElement>('.ld-pct') ?? null
  const footLabel = root?.querySelector<HTMLElement>('.ld-foot span') ?? null
  let shown = 0
  let finished = !root
  let creep = 0

  const set = (f: number) => {
    shown = Math.max(shown, Math.min(1, Math.max(0, f)))
    const whole = Math.round(shown * 100)
    // The bar is indeterminate (a sliding shimmer) until the first real number arrives.
    root?.classList.add('ld-known')
    if (fill) fill.style.transform = `scaleX(${shown})`
    if (pct) pct.textContent = t('fmt.percent', { n: whole })
    bar?.setAttribute('aria-valuenow', String(whole))
    // The last stretch (the canal outside, the first frames) reports no bytes, so the
    // bar used to sit at 90% and look frozen. From there it creeps on its own, slower
    // and slower, never reaching 100% until done().
    if (shown >= CREEP_FROM && !creep && !finished) {
      if (footLabel) footLabel.textContent = t('loading.last')
      creep = window.setInterval(() => {
        if (finished) return window.clearInterval(creep)
        set(shown + (CREEP_TO - shown) * 0.08)
      }, 400)
    }
  }

  return {
    get showing() {
      return !finished
    },
    progress(fraction) {
      if (finished || !Number.isFinite(fraction)) return
      set(fraction)
    },
    done() {
      if (finished || !root) return
      finished = true
      window.clearInterval(creep)
      set(1)
      root.classList.add('ld-out')
      root.setAttribute('aria-busy', 'false')
      // transitionend can be skipped (reduced motion, hidden tab), so a timer removes it too.
      let removed = false
      const remove = () => {
        if (removed) return
        removed = true
        root.remove()
      }
      root.addEventListener('transitionend', remove, { once: true })
      window.setTimeout(remove, FADE_MS + 100)
    },
    fail(message) {
      if (!root) {
        // No loading screen (it was already gone): still say something.
        const el = doc.createElement('div')
        el.className = 'fatal'
        el.textContent = message
        doc.body.appendChild(el)
        return
      }
      finished = true
      window.clearInterval(creep)
      root.classList.add('ld-failed')
      root.setAttribute('aria-busy', 'false')
      const err = root.querySelector<HTMLElement>('.ld-error')
      const text = root.querySelector<HTMLElement>('.ld-error-text')
      if (text) text.textContent = message
      if (err) err.hidden = false
      root.querySelector<HTMLButtonElement>('.ld-reload')?.focus()
    },
  }
}
