/**
 * Wires the store to the DOM: picks the screen for the current state and lets
 * each screen render itself. Screens read state and dispatch actions; they
 * never mutate state.
 *
 *   career over (M5)       → ending (paper, cards, summary)
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
 * Before any of that, the title screen (M4): Ui starts in 'title' mode with
 * every game screen hidden; main switches it to 'game' once a slot is picked
 * and back from Settings → Main menu. body[data-screen] reads 'title' then.
 *
 * Between days (the ledger) a quiet banner may suggest a backup: once per
 * session, only with a finished day behind you, when there has never been a
 * backup on this device or the last one is 14+ days old.
 */
import type { SoundSettings } from '../audio/settings'
import type { Action } from '../game/actions'
import type { GameState } from '../game/state'
import type { Store } from '../game/store'
import { KEY_ORBIT, KEY_ZOOM } from '../input/gestures'
import { BUTTON_KEY_NAMES, type Command } from '../input/keymap'
import { applyKeyHints, pressKey } from './keys'
import './desktop.css'
import { backupAgeText, backupReminderDue, lastBackupAt } from '../persist/safety'
import { createButton, el } from './components/button'
import { Hud } from './components/hud'
import { CounterScreen } from './screens/counter'
import { EndingScreen, type EndingStep } from './screens/ending'
import { InspectScreen, type HotspotView } from './screens/inspect'
import { IntroScreen } from './screens/intro'
import { LedgerScreen } from './screens/ledger'
import { NewsScreen } from './screens/news'
import { OfficeSheet } from './screens/office'
import { OfferScreen } from './screens/offer'
import { RedeemScreen } from './screens/redeem'
import { SaleScreen } from './screens/sale'
import { SettingsSheet, type GraphicsInfo, type GraphicsChoice } from './screens/settings'
import { TitleScreen, type TitleDeps } from './screens/title'
import type { SlotView } from '../game/save/slots'
import { ShopSheet } from './screens/shop'
import { WelcomeScreen } from './screens/welcome'

/** The key name a command presses a button with (data-keys), or null for orbit / zoom / backspace. */
function keyName(c: Command): string | null {
  switch (c.kind) {
    case 'digit':
      return c.digit
    case 'confirm':
      return 'Enter'
    case 'back':
      return 'Escape'
    case 'letter':
      return BUTTON_KEY_NAMES[c.letter]
    default:
      return null
  }
}

export type ScreenId = 'intro' | 'welcome' | 'news' | 'counter' | 'inspect' | 'offer' | 'sale' | 'redeem' | 'ledger' | 'ending'

/**
 * `arrived` false: the current customer is still walking in from the door
 * (render/scene.ts), so the counter shows the empty shop until they reach it.
 */
export function screenFor(state: GameState, arrived = true): ScreenId {
  if (state.career.end) return 'ending'
  if (state.meta.intro) return 'intro'
  if (state.day.phase === 'closed') return state.history.length > 0 ? 'ledger' : 'welcome'
  if (!state.day.newsRead) return 'news'
  const c = state.current
  if ((c?.phase === 'present' || c?.phase === 'scene') && !arrived) return 'counter'
  if (c?.phase === 'inspect') return 'inspect'
  if (c?.phase === 'offer') return 'offer'
  if (c?.phase === 'present' && c.kind === 'buyer') return 'sale'
  if (c?.phase === 'present' && c.kind === 'redeem') return 'redeem'
  return 'counter'
}

export interface UiDeps {
  store: Store
  replaceState(state: GameState): void
  /** Settings → Main menu: save, then show the title screen. */
  mainMenu(): void
  /** "Slot 2", or null for an unsaved review career. */
  slotLabel(): string | null
  setReduceMotion(on: boolean): void
  setTextScale(scale: number): void
  /** Title screen actions (main does the storage work). */
  title: Omit<TitleDeps, 'openSettings'>
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
  /** Landscape / desktop: pixels covered by the side column on the right (counter, sale, redeem, offer). */
  counterRight: number
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
  private readonly ending: EndingScreen
  private readonly settings: SettingsSheet
  private readonly office: OfficeSheet
  private readonly shop: ShopSheet
  private readonly screens: Record<ScreenId, { root: HTMLElement }>
  private current: ScreenId | null = null
  readonly title: TitleScreen
  private _mode: 'title' | 'game' = 'title'
  private lastLayout: UiLayout | null = null
  private build!: HTMLElement
  /** False while the current customer is still walking to the counter. */
  private arrived = true
  /** Where the ending opens when it comes into view: the paper for an ending reached in play. */
  private endingStep: EndingStep = 'paper'
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
    this.ending = new EndingScreen(() => deps.mainMenu())
    this.settings = new SettingsSheet({
      getState: () => deps.store.get(),
      dispatch,
      replaceState: deps.replaceState,
      mainMenu: deps.mainMenu,
      slotLabel: deps.slotLabel,
      setReduceMotion: deps.setReduceMotion,
      setTextScale: deps.setTextScale,
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
      ending: this.ending,
    }
    for (const s of Object.values(this.screens)) {
      s.root.hidden = true
      mount.appendChild(s.root)
    }
    mount.appendChild(this.hud.root)
    this.title = new TitleScreen({ ...deps.title, openSettings: () => this.settings.open(undefined, 'title') })
    mount.appendChild(this.title.root)
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

    const build = el('div', 'build-number', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`)
    build.dataset.id = 'build'
    mount.appendChild(build)
    this.build = build
  }

  /** Appends which lightmap is live (preview / full bake) to the build number. */
  setBakeInfo(text: string): void {
    this.build.textContent = `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__} · ${text}`
  }

  get mode(): 'title' | 'game' {
    return this._mode
  }

  /** Title screen over the dimmed shop: hide every game screen and sheet. */
  showTitle(slots: SlotView[]): void {
    this._mode = 'title'
    if (this.current) this.screens[this.current].root.hidden = true
    this.current = null
    this.hud.root.hidden = true
    this.shop.close()
    this.office.close()
    this.settings.close()
    this.reminder.hidden = true
    this.title.render(slots)
    this.title.root.hidden = false
    applyKeyHints(this.title.root)
    document.body.dataset.screen = 'title'
    this.onScreenChange?.('counter')
  }

  /**
   * Back to the game screens for the store's (newly loaded) career. A career that has
   * already ended opens on its ending at `endingStep` (the summary from the title screen).
   */
  showGame(endingStep: EndingStep = 'summary'): void {
    this._mode = 'game'
    this.title.closeLoad()
    this.title.root.hidden = true
    this.endingStep = endingStep
    this.render(this.deps.store.get(), null)
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
    if (this._mode === 'title') {
      if (this.settings.isOpen) this.settings.render(state)
      return
    }
    const id = screenFor(state, this.arrived)
    const changed = id !== this.current
    if (id !== this.current) {
      if (this.current) this.screens[this.current].root.hidden = true
      this.screens[id].root.hidden = false
      this.current = id
      document.body.dataset.screen = id
    }
    this.hud.root.hidden = id === 'welcome' || id === 'ledger' || id === 'intro' || id === 'news' || id === 'ending'
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
      case 'ending':
        this.ending.render(state)
        if (changed) {
          this.ending.show(this.endingStep)
          this.shop.close()
          this.ledger.closeConfirm()
        }
        break
    }
    // An ending reached from here on (in play) opens on the paper.
    if (id !== 'ending') this.endingStep = 'paper'
    if (this.shop.isOpen) this.shop.render(state)
    if (this.settings.isOpen) this.settings.render(state)
    if (this.office.isOpen) {
      if (id === 'ledger') this.office.render(state)
      else this.office.close()
    }
    this.updateReminder(state, id)
    applyKeyHints(this.mount)
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
    let counterRight = this.lastLayout?.counterRight ?? 0
    // Landscape and desktop put the strip in a side column on the right (M6), so it covers no bottom band.
    const side = w > h && w >= 700
    const strip = this.current === 'counter' ? this.counter.strip : this.current === 'sale' ? this.sale.strip : this.current === 'redeem' ? this.redeem.strip : null
    if (strip) {
      const r = strip.getBoundingClientRect()
      if (r.height > 0) {
        counterBottom = side ? 0 : h - r.top
        counterRight = side ? Math.max(0, w - r.left) : 0
      }
    } else if (this.current === 'offer') {
      const r = this.offer.root.querySelector('.offer-bubble')!.getBoundingClientRect()
      if (r.height > 0) counterBottom = w > h ? 0 : h - r.top
      const p = this.offer.panel.getBoundingClientRect()
      counterRight = side && p.width > 0 ? Math.max(0, w - p.left) : 0
    } else if (this.current !== 'inspect') {
      counterRight = 0
    }
    let band = this.lastLayout
      ? { top: this.lastLayout.inspectTop, bottom: this.lastLayout.inspectBottom, left: this.lastLayout.inspectLeft, right: this.lastLayout.inspectRight }
      : null
    if (this.current === 'inspect' || !band) band = this.inspect.freeBand()
    const layout: UiLayout = {
      counterBottom,
      counterRight,
      inspectTop: band.top,
      inspectBottom: band.bottom,
      inspectLeft: band.left,
      inspectRight: band.right,
    }
    this.inspect.setItemCenter((band.left + band.right) / 2, (band.top + band.bottom) / 2)
    this.lastLayout = layout
    return layout
  }

  /**
   * Desktop keys (input/keymap.ts), routed to the topmost layer: Settings, the title's
   * load sheet, the office, the shop sheet, then the visible screen. Each layer's own
   * handlers go first (number pads, tools, the evidence picker); otherwise the key
   * presses the visible button marked for it (ui/keys.ts).
   */
  key(c: Command): boolean {
    const name = keyName(c)
    if (this.settings.isOpen) return c.kind === 'back' ? (this.settings.close(), true) : false
    if (this._mode === 'title') {
      if (this.title.loadOpen) return c.kind === 'back' ? (this.title.closeLoad(), true) : false
      return name !== null && pressKey(this.title.root, name)
    }
    if (this.office.isOpen) {
      if (c.kind === 'back' || (c.kind === 'letter' && c.letter === 'office')) {
        this.office.close()
        return true
      }
      return false
    }
    if (this.shop.isOpen) {
      if (c.kind === 'letter' && c.letter === 'shop') {
        this.shop.close()
        return true
      }
      const k = c.kind === 'digit' ? c.digit : c.kind === 'backspace' ? 'Backspace' : name
      return k !== null && this.shop.keyPress(k)
    }
    if (!this.current) return false
    const root = this.screens[this.current].root
    const s = this.deps.store
    switch (this.current) {
      case 'inspect':
        if (c.kind === 'orbit' || c.kind === 'zoom') {
          // The gesture layer's own handler (input/gestures.ts) drives the stage.
          this.inspect.gestureLayer.dispatchEvent(new CustomEvent(c.kind === 'orbit' ? KEY_ORBIT : KEY_ZOOM, { detail: c }))
          return true
        }
        if (c.kind === 'back' && this.inspect.findings.isExpanded) {
          this.inspect.findings.setExpanded(false)
          return true
        }
        if (c.kind === 'digit') return this.inspect.key(c.digit)
        break
      case 'offer':
        if (c.kind === 'back') {
          if (this.offer.closeOverlay()) return true
          s.dispatch({ type: 'inspect/back' })
          return true
        }
        if (c.kind === 'digit') return this.offer.key(c.digit)
        if (c.kind === 'backspace') return this.offer.key('Backspace')
        if (c.kind === 'confirm') return this.offer.key('Enter')
        break
      case 'sale': {
        const k = c.kind === 'digit' ? c.digit : c.kind === 'backspace' ? 'Backspace' : name
        if (k !== null && this.sale.key(k)) return true
        break
      }
    }
    return name !== null && pressKey(root, name)
  }

  /** Elements whose size changes should re-frame the camera. */
  observed(): HTMLElement[] {
    return [this.counter.strip, this.sale.strip, this.redeem.strip, this.inspect.panel, this.inspect.header, this.offer.panel, this.mount]
  }
}
