/**
 * Wires the store to the DOM: picks the screen for the current state and lets
 * each screen render itself. Screens read state and dispatch actions; they
 * never mutate state.
 *
 *   career intro pending   → intro
 *   day closed, no history → welcome
 *   day closed             → ledger
 *   today's paper unread   → news
 *   visit phase inspect    → inspect
 *   visit phase offer      → offer
 *   buyer at the counter   → sale (until resolved)
 *   pawner redeeming       → redeem (until resolved)
 *   otherwise              → counter (incl. the resolved outcome + Next)
 *
 * Between days (the ledger) a quiet banner may suggest a backup: once per
 * session, only with a finished day behind you, when there has never been a
 * backup on this device or the last one is 14+ days old.
 */
import type { SoundSettings } from '../audio/settings'
import type { Action } from '../game/actions'
import type { GameState } from '../game/state'
import type { Store } from '../game/store'
import type { KeyName } from '../input/keyboard'
import { backupAgeText, backupReminderDue, lastBackupAt } from '../persist/safety'
import { createButton, el } from './components/button'
import { Hud } from './components/hud'
import { CounterScreen } from './screens/counter'
import { InspectScreen, type HotspotView } from './screens/inspect'
import { IntroScreen } from './screens/intro'
import { LedgerScreen } from './screens/ledger'
import { NewsScreen } from './screens/news'
import { OfficeSheet } from './screens/office'
import { OfferScreen } from './screens/offer'
import { RedeemScreen } from './screens/redeem'
import { SaleScreen } from './screens/sale'
import { SettingsSheet, type GraphicsInfo, type GraphicsChoice } from './screens/settings'
import { ShopSheet } from './screens/shop'
import { WelcomeScreen } from './screens/welcome'

export type ScreenId = 'intro' | 'welcome' | 'news' | 'counter' | 'inspect' | 'offer' | 'sale' | 'redeem' | 'ledger'

/**
 * `arrived` false: the current customer is still walking in from the door
 * (render/scene.ts), so the counter shows the empty shop until they reach it.
 */
export function screenFor(state: GameState, arrived = true): ScreenId {
  if (state.meta.intro) return 'intro'
  if (state.day.phase === 'closed') return state.history.length > 0 ? 'ledger' : 'welcome'
  if (!state.day.newsRead) return 'news'
  const c = state.current
  if (c?.phase === 'present' && !arrived) return 'counter'
  if (c?.phase === 'inspect') return 'inspect'
  if (c?.phase === 'offer') return 'offer'
  if (c?.phase === 'present' && c.kind === 'buyer') return 'sale'
  if (c?.phase === 'present' && c.kind === 'redeem') return 'redeem'
  return 'counter'
}

export interface UiDeps {
  store: Store
  replaceState(state: GameState): void
  newCareer(): void
  setReduceMotion(on: boolean): void
  /** Device sound settings (not part of the career). */
  getSound(): SoundSettings
  setSound(patch: Partial<SoundSettings>): void
  /** Device graphics quality (localStorage, not the career). */
  getGraphics(): GraphicsInfo
  setGraphics(choice: GraphicsChoice): void
  /** `?lull=0`: a Next customer button instead of the lull between visitors. */
  manualNext: boolean
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
  private readonly intro: IntroScreen
  private readonly news: NewsScreen
  private readonly sale: SaleScreen
  private readonly redeem: RedeemScreen
  private readonly settings: SettingsSheet
  private readonly office: OfficeSheet
  private readonly shop: ShopSheet
  private readonly screens: Record<ScreenId, { root: HTMLElement }>
  private current: ScreenId | null = null
  private lastLayout: UiLayout | null = null
  private build!: HTMLElement
  /** False while the current customer is still walking to the counter. */
  private arrived = true
  private reminder: HTMLElement
  private reminderText: HTMLElement
  /** The backup reminder already had its one showing this session. */
  private reminderDone = false
  /** Called when the visible screen changes (main re-measures the camera layout). */
  onScreenChange: ((id: ScreenId) => void) | null = null

  constructor(
    private readonly mount: HTMLElement,
    private readonly deps: UiDeps,
  ) {
    const dispatch = (a: Action) => deps.store.dispatch(a)
    // When Settings closes, the backup reminder gets its chance (it waits while Settings is open).
    const openSettings = () => this.settings.open(() => this.current && this.updateReminder(deps.store.get(), this.current))
    const gear = (suffix: string) => (onPress: () => void) =>
      createButton({ id: `settings-${suffix}`, label: '', icon: 'gear', ariaLabel: 'Settings', className: 'btn-icon', onPress })

    this.shop = new ShopSheet({ getState: () => deps.store.get(), dispatch })
    const shopButton = (suffix: string) =>
      createButton({ id: `shop-${suffix}`, label: 'Shop', icon: 'tag', ariaLabel: 'Shop floor: display and price tags', className: 'btn-shop', onPress: () => this.shop.open() })

    this.counter = new CounterScreen(dispatch, openSettings, gear('counter'), shopButton('counter'), deps.manualNext)
    this.inspect = new InspectScreen(dispatch)
    this.offer = new OfferScreen(dispatch)
    this.office = new OfficeSheet({ getState: () => deps.store.get(), dispatch })
    this.ledger = new LedgerScreen(dispatch, openSettings, gear('ledger'), () => this.office.open(), shopButton('ledger'))
    this.welcome = new WelcomeScreen(dispatch, openSettings, gear('welcome'))
    this.intro = new IntroScreen(dispatch)
    this.news = new NewsScreen(dispatch)
    this.sale = new SaleScreen(dispatch)
    this.redeem = new RedeemScreen(dispatch)
    this.settings = new SettingsSheet({
      getState: () => deps.store.get(),
      dispatch,
      replaceState: deps.replaceState,
      newCareer: deps.newCareer,
      setReduceMotion: deps.setReduceMotion,
      getSound: deps.getSound,
      setSound: deps.setSound,
      getGraphics: deps.getGraphics,
      setGraphics: deps.setGraphics,
    })
    this.screens = {
      counter: this.counter,
      inspect: this.inspect,
      offer: this.offer,
      ledger: this.ledger,
      welcome: this.welcome,
      intro: this.intro,
      news: this.news,
      sale: this.sale,
      redeem: this.redeem,
    }
    for (const s of Object.values(this.screens)) {
      s.root.hidden = true
      mount.appendChild(s.root)
    }
    mount.appendChild(this.hud.root)
    mount.appendChild(this.shop.root)
    mount.appendChild(this.settings.root)
    mount.appendChild(this.office.root)

    // --- backup reminder (quiet, dismissible, never over play)
    const reminder = el('aside', 'backup-reminder menu')
    reminder.dataset.id = 'backup-reminder'
    reminder.hidden = true
    reminder.setAttribute('role', 'status')
    this.reminderText = el('p', 'backup-reminder-text')
    const reminderActions = el('div', 'actions')
    reminderActions.append(
      createButton({ id: 'backup-later', label: 'Not now', variant: 'ghost', onPress: () => this.hideReminder() }),
      createButton({
        id: 'backup-now',
        label: 'Back up',
        icon: 'doc',
        variant: 'primary',
        onPress: () => {
          this.hideReminder()
          openSettings()
        },
      }),
    )
    reminder.append(this.reminderText, reminderActions)
    mount.appendChild(reminder)
    this.reminder = reminder

    const build = el('div', 'build-number', `${__BUILD_SHA__} · ${__BUILD_DATE__}`)
    build.dataset.id = 'build'
    mount.appendChild(build)
    this.build = build
  }

  /** Appends which lightmap is live (preview / full bake) to the build number. */
  setBakeInfo(text: string): void {
    this.build.textContent = `${__BUILD_SHA__} · ${__BUILD_DATE__} · ${text}`
  }

  /** Same, without rendering (main renders right after). */
  setCustomerArrivedQuiet(arrived: boolean): void {
    this.arrived = arrived
  }

  /** The scene says whether the current customer has reached the counter; re-renders when that changes. */
  setCustomerArrived(arrived: boolean): void {
    if (arrived === this.arrived) return
    this.arrived = arrived
    const s = this.deps.store.get()
    this.render(s, s)
  }

  render(state: GameState, prev: GameState | null): void {
    document.documentElement.style.setProperty('--text-scale', String(state.settings.textScale))
    document.documentElement.classList.toggle('reduce-motion', state.settings.reduceMotion)
    const id = screenFor(state, this.arrived)
    const changed = id !== this.current
    if (id !== this.current) {
      if (this.current) this.screens[this.current].root.hidden = true
      this.screens[id].root.hidden = false
      this.current = id
      document.body.dataset.screen = id
    }
    this.hud.root.hidden = id === 'welcome' || id === 'ledger' || id === 'intro' || id === 'news'
    this.hud.render(state)
    switch (id) {
      case 'counter':
        this.counter.render(state, this.arrived)
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
      case 'intro':
        this.intro.render(state)
        break
      case 'news':
        this.news.render(state)
        break
      case 'sale':
        this.sale.render(state)
        break
      case 'redeem':
        this.redeem.render(state)
        break
    }
    if (this.shop.isOpen) this.shop.render(state)
    if (this.settings.isOpen) this.settings.render(state)
    if (this.office.isOpen) {
      if (id === 'ledger') this.office.render(state)
      else this.office.close()
    }
    this.updateReminder(state, id)
    if (changed) this.onScreenChange?.(id)
  }

  /** Show the backup reminder at a calm moment (the ledger, between days), at most once per session. */
  private updateReminder(state: GameState, id: ScreenId): void {
    if (id !== 'ledger') {
      if (!this.reminder.hidden) this.hideReminder()
      return
    }
    if (this.reminderDone || this.settings.isOpen) return
    const last = lastBackupAt()
    const now = Date.now()
    if (!backupReminderDue(state.history.length > 0, last, now)) {
      // Backed up from Settings while the banner was up: it has done its job.
      if (!this.reminder.hidden) this.hideReminder()
      return
    }
    if (!this.reminder.hidden) return
    this.reminderText.textContent =
      last === null
        ? 'No backup of this shop yet. If the phone runs low on space, the browser can clear saves. A backup file keeps it safe.'
        : `Last backup: ${backupAgeText(last, now)}. Make a fresh one to keep this shop safe.`
    this.reminder.hidden = false
  }

  private hideReminder(): void {
    this.reminder.hidden = true
    this.reminderDone = true
  }

  /** The player dragged to look around (retires the one-time hint). */
  lookUsed(): void {
    this.counter.lookUsed()
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
    const strip = this.current === 'counter' ? this.counter.strip : this.current === 'sale' ? this.sale.strip : this.current === 'redeem' ? this.redeem.strip : null
    if (strip) {
      const r = strip.getBoundingClientRect()
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
    if (this.office.isOpen) {
      if (k === 'Escape') this.office.close()
      return k === 'Escape'
    }
    if (this.shop.isOpen) return this.shop.keyPress(k)
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
      case 'sale':
        return this.sale.key(k)
      default:
        return false
    }
  }

  /** Elements whose size changes should re-frame the camera. */
  observed(): HTMLElement[] {
    return [this.counter.strip, this.sale.strip, this.redeem.strip, this.inspect.panel, this.inspect.header, this.offer.panel, this.mount]
  }
}
