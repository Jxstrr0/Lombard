/**
 * Top HUD during the shop day: day + shop clock, the queue with a patience
 * gauge for the most impatient waiting customer, and cash.
 * The patience gauge uses length + a pattern + an alert icon when low, never colour alone.
 */
import { t } from '../../data/strings'
import { tuning } from '../../data/tuning'
import type { GameState } from '../../game/state'
import { rub, shopClock } from '../format'
import { icons } from '../icons'
import { el, setText } from './button'

/** Below this share of full patience the gauge shows the "leaving soon" state. */
const LOW_PATIENCE = 0.3

export class Hud {
  readonly root: HTMLElement
  private day: HTMLElement
  private clock: HTMLElement
  private queue: HTMLElement
  private queueCount: HTMLElement
  private gauge: HTMLElement
  private gaugeFill: HTMLElement
  private lowIcon: HTMLElement
  private cash: HTMLElement

  constructor() {
    const root = el('header', 'hud')
    root.dataset.id = 'hud'
    root.innerHTML = `
      <div class="hud-time">
        <span class="hud-day" data-ref="day"></span>
        <span class="hud-clock" data-ref="clock">${icons.clock}<span data-ref="clock-text"></span></span>
      </div>
      <div class="hud-queue" data-ref="queue" data-id="hud-queue" role="status">
        ${icons.person}<span class="hud-queue-count" data-ref="count"></span>
        <span class="patience" data-ref="gauge"><i data-ref="fill"></i></span>
        <span class="patience-low" data-ref="low">${icons.alert}<span data-ref="low-text"></span></span>
      </div>
      <div class="hud-cash" data-ref="cash" data-id="hud-cash"></div>`
    const q = (r: string) => root.querySelector<HTMLElement>(`[data-ref="${r}"]`)!
    this.root = root
    this.day = q('day')
    this.clock = q('clock-text')
    this.queue = q('queue')
    this.queueCount = q('count')
    this.gauge = q('gauge')
    this.gaugeFill = q('fill')
    this.lowIcon = q('low')
    this.cash = q('cash')
    q('low-text').textContent = t('hud.leaving')
  }

  render(state: GameState): void {
    setText(this.day, t('common.dayN', { day: state.calendar.day }))
    setText(this.clock, shopClock(state.day.clock))
    setText(this.cash, rub(state.cash))
    const open = state.day.phase === 'open'
    this.queue.hidden = !open
    const n = state.queue.length
    setText(this.queueCount, String(n))
    let minPatience = Infinity
    for (const v of state.queue) minPatience = Math.min(minPatience, v.patience)
    const frac = n > 0 ? Math.max(0, Math.min(1, minPatience / tuning.day.queuePatience[1])) : 0
    const low = n > 0 && frac < LOW_PATIENCE
    this.gauge.hidden = n === 0
    this.gaugeFill.style.width = `${Math.round(frac * 100)}%`
    this.gauge.classList.toggle('is-low', low)
    this.lowIcon.hidden = !low
    const label = n === 0 ? t('hud.nobody') : low ? t('hud.waitingLow', { count: n }) : t('hud.waiting', { count: n, pct: Math.round(frac * 100) })
    if (this.queue.getAttribute('aria-label') !== label) this.queue.setAttribute('aria-label', label)
  }
}
