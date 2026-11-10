/**
 * Top HUD during the shop day: day + shop clock, the queue with a patience
 * gauge for the most impatient waiting customer, and cash.
 * The patience gauge uses length + a pattern + an alert icon when low, never colour alone.
 * Tapping the queue opens a small list with one patience bar per waiting
 * customer and roughly how many shop minutes each will still wait.
 */
import { t } from '../../data/strings'
import { tuning } from '../../data/tuning'
import type { GameState } from '../../game/state'
import { CLOCK_MINUTES_PER_SECOND, rub, shopClock } from '../format'
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
  /** The drop-down list of waiting customers, one bar each. */
  private list: HTMLElement
  /** Last rendered state and bar scale, so a tap can fill the list at once. */
  private last: { state: GameState; full: number } | null = null

  constructor() {
    const root = el('header', 'hud')
    root.dataset.id = 'hud'
    root.innerHTML = `
      <div class="hud-time">
        <span class="hud-day" data-ref="day"></span>
        <span class="hud-clock" data-ref="clock">${icons.clock}<span data-ref="clock-text"></span></span>
      </div>
      <div class="hud-queue" data-ref="queue" data-id="hud-queue" role="button" tabindex="0" aria-expanded="false">
        ${icons.person}<span class="hud-queue-count" data-ref="count"></span>
        <span class="patience" data-ref="gauge"><i data-ref="fill"></i></span>
        <span class="patience-low" data-ref="low">${icons.alert}<span data-ref="low-text"></span></span>
      </div>
      <div class="hud-cash" data-ref="cash" data-id="hud-cash"></div>
      <ol class="hud-waitlist" data-ref="list" data-id="hud-waitlist" hidden></ol>`
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
    this.list = q('list')
    q('low-text').textContent = t('hud.leaving')
    const toggle = () => {
      this.list.hidden = !this.list.hidden
      this.queue.setAttribute('aria-expanded', String(!this.list.hidden))
      if (this.last) this.renderList(this.last.state, this.last.full)
    }
    this.queue.addEventListener('click', toggle)
    this.queue.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggle()
      }
    })
  }

  /** One row per waiting customer: place in line, a bar, and about how long they'll still wait. */
  private renderList(state: GameState, full: number): void {
    if (state.queue.length === 0) this.list.hidden = true
    if (this.list.hidden) return
    const rows = state.queue.map((v, i) => {
      const frac = Math.max(0, Math.min(1, v.patience / full))
      const low = frac < LOW_PATIENCE
      const who = i === 0 ? t('hud.next') : t('hud.nth', { n: i + 1 })
      const mins = t('hud.waitMins', { mins: Math.max(1, Math.round(v.patience * CLOCK_MINUTES_PER_SECOND)) })
      return `<li><span class="hud-wl-who">${who}</span><span class="patience${low ? ' is-low' : ''}"><i style="width:${Math.round(frac * 100)}%"></i></span><span class="hud-wl-mins">${mins}</span></li>`
    })
    const html = rows.join('')
    if (this.list.innerHTML !== html) this.list.innerHTML = html
  }

  render(state: GameState): void {
    setText(this.day, t('common.dayN', { day: state.calendar.day }))
    setText(this.clock, shopClock(state.day.clock))
    setText(this.cash, rub(state.cash))
    const open = state.day.phase === 'open'
    this.queue.hidden = !open
    if (!open) this.list.hidden = true
    const n = state.queue.length
    setText(this.queueCount, String(n))
    let minPatience = Infinity
    for (const v of state.queue) minPatience = Math.min(minPatience, v.patience)
    // Fullest bar = the longest a walk-in can start out waiting (regulars wait longer and simply sit at full).
    const full = tuning.day.queuePatience[1] * tuning.day.queuePatienceScale
    const frac = n > 0 ? Math.max(0, Math.min(1, minPatience / full)) : 0
    const low = n > 0 && frac < LOW_PATIENCE
    this.gauge.hidden = n === 0
    this.gaugeFill.style.width = `${Math.round(frac * 100)}%`
    this.gauge.classList.toggle('is-low', low)
    this.lowIcon.hidden = !low
    const label = n === 0 ? t('hud.nobody') : low ? t('hud.waitingLow', { count: n }) : t('hud.waiting', { count: n, pct: Math.round(frac * 100) })
    if (this.queue.getAttribute('aria-label') !== label) this.queue.setAttribute('aria-label', label)
    this.last = { state, full }
    this.renderList(state, full)
  }
}
