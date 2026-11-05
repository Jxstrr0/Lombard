/**
 * Wires the store to the DOM: picks the screen for the current state and lets
 * each screen render itself. Screens read state and dispatch actions; they
 * never mutate state.
 *
 *   day closed, no history → welcome
 *   day closed             → ledger
 *   visit phase inspect    → inspect
 *   visit phase offer      → offer
 *   otherwise              → counter (incl. the resolved outcome + Next)
 */
import type { Action } from '../game/actions'
import type { GameState } from '../game/state'
import type { Store } from '../game/store'
import type { KeyName } from '../input/keyboard'
import { createButton, el } from './components/button'
import { Hud } from './components/hud'
import { CounterScreen } from './screens/counter'
import { InspectScreen, type HotspotView } from './screens/inspect'
import { LedgerScreen } from './screens/ledger'
import { OfferScreen } from './screens/offer'
import { SettingsSheet } from './screens/settings'
import { WelcomeScreen } from './screens/welcome'

export type ScreenId = 'welcome' | 'counter' | 'inspect' | 'offer' | 'ledger'

export function screenFor(state: GameState): ScreenId {
  if (state.day.phase === 'closed') return state.history.length > 0 ? 'ledger' : 'welcome'
  const phase = state.current?.phase
  if (phase === 'inspect') return 'inspect'
  if (phase === 'offer') return 'offer'
  return 'counter'
}

export interface UiDeps {
  store: Store
  replaceState(state: GameState): void
  newCareer(): void
  setReduceMotion(on: boolean): void
}

export interface UiLayout {
  /** Pixels covered by UI at the bottom of the counter view. */
  counterBottom: number
  inspectTop: number
  inspectBottom: number
  inspectLeft: number
  inspectRight: number
}

export class Ui {
  readonly inspect: InspectScreen
  private readonly hud = new Hud()
  private readonly counter: CounterScreen
  private readonly offer: OfferScreen
  private readonly ledger: LedgerScreen
  private readonly welcome: WelcomeScreen
  private readonly settings: SettingsSheet
  private readonly screens: Record<ScreenId, { root: HTMLElement }>
  private current: ScreenId | null = null
  private lastLayout: UiLayout | null = null
  /** Called when the visible screen changes (main re-measures the camera layout). */
  onScreenChange: ((id: ScreenId) => void) | null = null

  constructor(
    private readonly mount: HTMLElement,
    private readonly deps: UiDeps,
  ) {
    const dispatch = (a: Action) => deps.store.dispatch(a)
    const openSettings = () => this.settings.open()
    const gear = (suffix: string) => (onPress: () => void) =>
      createButton({ id: `settings-${suffix}`, label: '', icon: 'gear', ariaLabel: 'Settings', className: 'btn-icon', onPress })

    this.counter = new CounterScreen(dispatch, openSettings, gear('counter'))
    this.inspect = new InspectScreen(dispatch)
    this.offer = new OfferScreen(dispatch)
    this.ledger = new LedgerScreen(dispatch, openSettings, gear('ledger'))
    this.welcome = new WelcomeScreen(dispatch, openSettings, gear('welcome'))
    this.settings = new SettingsSheet({
      getState: () => deps.store.get(),
      dispatch,
      replaceState: deps.replaceState,
      newCareer: deps.newCareer,
      setReduceMotion: deps.setReduceMotion,
    })
    this.screens = {
      counter: this.counter,
      inspect: this.inspect,
      offer: this.offer,
      ledger: this.ledger,
      welcome: this.welcome,
    }
    for (const s of Object.values(this.screens)) {
      s.root.hidden = true
      mount.appendChild(s.root)
    }
    mount.appendChild(this.hud.root)
    mount.appendChild(this.settings.root)

    const build = el('div', 'build-number', `${__BUILD_SHA__} · ${__BUILD_DATE__}`)
    build.dataset.id = 'build'
    mount.appendChild(build)
  }

  render(state: GameState, prev: GameState | null): void {
    document.documentElement.style.setProperty('--text-scale', String(state.settings.textScale))
    document.documentElement.classList.toggle('reduce-motion', state.settings.reduceMotion)
    const id = screenFor(state)
    if (id !== this.current) {
      if (this.current) this.screens[this.current].root.hidden = true
      this.screens[id].root.hidden = false
      this.current = id
      document.body.dataset.screen = id
    }
    this.hud.root.hidden = id === 'welcome' || id === 'ledger'
    this.hud.render(state)
    switch (id) {
      case 'counter':
        this.counter.render(state)
        break
      case 'inspect':
        this.inspect.render(state, prev)
        break
      case 'offer':
        this.offer.render(state)
        break
      case 'ledger':
        this.ledger.render(state)
        break
      case 'welcome':
        this.welcome.render(state)
        break
    }
    if (this.settings.isOpen) this.settings.render(state)
    if (prev === null || screenFor(prev) !== id) this.onScreenChange?.(id)
  }

  /** Per-frame: hotspot markers follow the turning item. */
  frame(hotspots: HotspotView[]): void {
    if (this.current === 'inspect') this.inspect.updateHotspots(hotspots)
  }

  /** Measure what the visible UI covers so the camera can frame the free area. */
  layout(): UiLayout {
    const h = window.innerHeight
    const w = window.innerWidth
    let counterBottom = this.lastLayout?.counterBottom ?? h * 0.33
    if (this.current === 'counter') {
      const r = this.counter.strip.getBoundingClientRect()
      if (r.height > 0) counterBottom = w > h && w >= 700 ? 0 : h - r.top
    } else if (this.current === 'offer') {
      const r = this.offer.root.querySelector('.offer-bubble')!.getBoundingClientRect()
      if (r.height > 0) counterBottom = w > h ? 0 : h - r.top
    }
    let band = this.lastLayout
      ? { top: this.lastLayout.inspectTop, bottom: this.lastLayout.inspectBottom, left: this.lastLayout.inspectLeft, right: this.lastLayout.inspectRight }
      : null
    if (this.current === 'inspect' || !band) band = this.inspect.freeBand()
    const layout: UiLayout = {
      counterBottom,
      inspectTop: band.top,
      inspectBottom: band.bottom,
      inspectLeft: band.left,
      inspectRight: band.right,
    }
    this.inspect.setItemCenter((band.left + band.right) / 2, (band.top + band.bottom) / 2)
    this.lastLayout = layout
    return layout
  }

  /** Desktop keys, routed to the visible screen / overlay. */
  key(k: KeyName): boolean {
    if (this.settings.isOpen) {
      if (k === 'Escape') {
        this.settings.close()
        return true
      }
      return false
    }
    const s = this.deps.store
    switch (this.current) {
      case 'inspect':
        if (k === 'Escape') return this.inspect.findings.isExpanded ? (this.inspect.findings.setExpanded(false), true) : false
        return this.inspect.key(k)
      case 'offer':
        if (k === 'Escape') {
          if (this.offer.closeOverlay()) return true
          s.dispatch({ type: 'inspect/back' })
          return true
        }
        return this.offer.key(k)
      default:
        return false
    }
  }

  /** Elements whose size changes should re-frame the camera. */
  observed(): HTMLElement[] {
    return [this.counter.strip, this.inspect.panel, this.inspect.header, this.offer.panel, this.mount]
  }
}
