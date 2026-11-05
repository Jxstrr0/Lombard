/**
 * Shop sheet (GDD § Shop management): the counter case, wall shelves and back
 * shelf as slot grids, plus the safe. Tap an item, then tap an empty slot to
 * move it there; "To safe" takes it off display. "Price tag" opens a number
 * pad for the tag (chips are multiples of what you paid; the true value is
 * never shown). Opens from the ledger (closed) and from the counter when
 * nobody is there; closes itself if a customer steps up.
 *
 * Local UI state (selection, pad mode) lives here; the game only changes
 * through shop/place and shop/price.
 */
import { tuning } from '../../data/tuning'
import type { Action } from '../../game/actions'
import type { GameState, Slot, SlotArea } from '../../game/state'
import type { ItemInstance } from '../../game/types'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { NumPad, type SideKey } from '../components/numpad'
import { itemNameOf, rub } from '../format'
import './shop.css'

export interface ShopDeps {
  getState(): GameState
  dispatch(a: Action): void
}

const AREAS: { id: SlotArea; title: string; hint: string; cols: number }[] = [
  { id: 'counter', title: 'Counter case', hint: 'Everyone looks here', cols: 3 },
  { id: 'wall', title: 'Wall shelves', hint: 'Most people glance up', cols: 4 },
  { id: 'back', title: 'Back shelf', hint: 'Only browsers get this far', cols: 5 },
]

const AREA_NAME: Record<SlotArea, string> = { counter: 'Counter case', wall: 'Wall shelf', back: 'Back shelf' }

/** The shop can be rearranged while closed or when nobody is at the counter (mirrors the reducer). */
export function canArrange(state: GameState): boolean {
  return !state.meta.intro && (state.day.phase === 'closed' || state.current === null)
}

export class ShopSheet {
  readonly root: HTMLElement
  private sheet: HTMLElement
  private summary: HTMLElement
  private body: HTMLElement
  private grids = new Map<SlotArea, HTMLElement>()
  private safeList: HTMLElement
  private tray: HTMLElement
  private trayName: HTMLElement
  private trayWhere: HTMLElement
  private trayTag: HTMLElement
  private toSafe: HTMLButtonElement
  private priceBtn: HTMLButtonElement
  private pricer: HTMLElement
  private priceName: HTMLElement
  private priceValue: HTMLElement
  private priceNote: HTMLElement
  private pad: NumPad
  private setBtn: HTMLButtonElement
  private removeBtn: HTMLButtonElement

  private selected: string | null = null
  private pricing = false
  private amount = 0
  private key = ''
  private state: GameState | null = null

  constructor(private readonly deps: ShopDeps) {
    const root = el('div', 'overlay shop-overlay')
    root.hidden = true
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close()
    })
    const sheet = el('section', 'sheet shop-sheet')
    sheet.dataset.id = 'shop'
    sheet.setAttribute('role', 'dialog')
    sheet.setAttribute('aria-modal', 'true')
    sheet.setAttribute('aria-label', 'Shop floor')

    const head = el('div', 'sheet-head')
    const titles = el('div', 'shop-titles')
    this.summary = el('div', 'shop-summary')
    this.summary.dataset.id = 'shop-summary'
    titles.append(el('h2', '', 'Shop floor'), this.summary)
    head.append(titles, createButton({ id: 'shop-close', label: '', icon: 'close', variant: 'ghost', ariaLabel: 'Close shop', onPress: () => this.close() }))

    // --- arrange view
    this.body = el('div', 'shop-body')
    this.body.append(el('p', 'shop-help', 'Buyers ask about tagged items on display. No tag, or in the safe: not for sale.'))
    for (const a of AREAS) {
      const sec = el('section', `shop-area area-${a.id}`)
      const h = el('h3', 'shop-area-h')
      h.append(el('span', '', a.title), el('span', 'shop-area-hint', a.hint))
      const grid = el('div', 'slot-grid')
      grid.style.setProperty('--cols', String(a.cols))
      grid.dataset.id = `grid-${a.id}`
      sec.append(h, grid)
      this.grids.set(a.id, grid)
      this.body.append(sec)
    }
    const safe = el('section', 'shop-area area-safe')
    const sh = el('h3', 'shop-area-h')
    sh.append(el('span', '', 'Safe'), el('span', 'shop-area-hint', 'Not for sale'))
    this.safeList = el('div', 'safe-list')
    this.safeList.dataset.id = 'safe'
    safe.append(sh, this.safeList)
    this.body.append(safe)

    // --- selection tray
    this.tray = el('div', 'shop-tray')
    this.tray.dataset.id = 'shop-tray'
    const info = el('div', 'tray-info')
    this.trayName = el('div', 'tray-name')
    this.trayWhere = el('div', 'tray-where')
    info.append(this.trayName, this.trayWhere)
    this.trayTag = el('div', 'tray-tag')
    const trayTop = el('div', 'tray-top')
    trayTop.append(info, this.trayTag)
    const trayActions = el('div', 'actions')
    this.toSafe = createButton({ id: 'shop-to-safe', label: 'To safe', onPress: () => this.place(null) })
    this.priceBtn = createButton({ id: 'shop-price', label: 'Price tag', icon: 'tag', variant: 'primary', onPress: () => this.openPricer() })
    trayActions.append(this.toSafe, this.priceBtn)
    this.tray.append(trayTop, trayActions)

    // --- price view
    this.pricer = el('div', 'shop-pricer')
    this.pricer.dataset.id = 'shop-pricer'
    this.priceName = el('div', 'pricer-name')
    const tag = el('div', 'price-tag')
    tag.dataset.id = 'tag-amount'
    this.priceValue = el('span', 'price-tag-value')
    this.priceNote = el('span', 'price-tag-note')
    tag.append(el('span', 'price-tag-label', 'Tag price'), this.priceValue, this.priceNote)
    this.pad = new NumPad('tag', (v) => {
      this.amount = v
      this.refreshPricer()
    })
    const priceActions = el('div', 'actions')
    priceActions.append(
      createButton({ id: 'tag-back', label: 'Back', icon: 'back', ariaLabel: 'Back to the shop floor', onPress: () => this.closePricer() }),
      (this.removeBtn = createButton({ id: 'tag-remove', label: 'No tag', onPress: () => this.setTag(0) })),
      (this.setBtn = createButton({ id: 'tag-set', label: 'Set tag', variant: 'primary', onPress: () => this.setTag(this.amount) })),
    )
    this.pricer.append(this.priceName, tag, this.pad.root, priceActions)

    sheet.append(head, this.body, this.tray, this.pricer)
    root.append(sheet)
    this.root = root
    this.sheet = sheet
  }

  get isOpen(): boolean {
    return !this.root.hidden
  }

  open(): void {
    const s = this.deps.getState()
    if (!canArrange(s)) return
    this.selected = null
    this.pricing = false
    this.key = ''
    this.root.hidden = false
    this.render(s)
    this.body.scrollTop = 0
    this.sheet.querySelector<HTMLButtonElement>('[data-id="shop-close"]')?.focus()
  }

  close(): void {
    this.root.hidden = true
    this.pricing = false
  }

  /** Keyboard: digits/Backspace/Enter on the price pad, Esc steps back. */
  keyPress(k: string): boolean {
    if (k === 'Escape') {
      if (this.pricing) this.closePricer()
      else if (this.selected) this.select(null)
      else this.close()
      return true
    }
    if (!this.pricing) return false
    if (k === 'Enter') {
      if (!this.setBtn.disabled) this.setTag(this.amount)
      return true
    }
    return this.pad.key(k)
  }

  render(state: GameState): void {
    this.state = state
    if (!canArrange(state)) {
      this.close()
      return
    }
    if (this.selected && !state.inventory.some((i) => i.id === this.selected)) {
      this.selected = null
      this.pricing = false
    }
    const key = JSON.stringify([state.shop.slots, state.shop.prices, state.inventory.map((i) => i.id), this.selected, this.pricing])
    if (key === this.key) return
    this.key = key

    const items = new Map(state.inventory.map((i) => [i.id, i]))
    const onDisplay = new Set(state.shop.slots.map((s) => s.itemId).filter((x): x is string => !!x))
    const inSafe = state.inventory.filter((i) => !onDisplay.has(i.id))
    const tagged = state.shop.slots.filter((s) => s.itemId && (state.shop.prices[s.itemId] ?? 0) > 0).length
    setText(this.summary, `${onDisplay.size} on display · ${tagged} tagged · ${inSafe.length} in the safe`)

    for (const a of AREAS) {
      const grid = this.grids.get(a.id)!
      grid.replaceChildren(...state.shop.slots.filter((s) => s.area === a.id).map((s) => this.slotButton(state, s, s.itemId ? items.get(s.itemId) : undefined)))
    }
    this.safeList.replaceChildren()
    if (inSafe.length === 0) this.safeList.append(el('p', 'safe-empty', state.inventory.length === 0 ? 'Nothing in stock yet. Buy something.' : 'Empty. Everything is out on display.'))
    for (const it of inSafe) this.safeList.append(this.safeButton(state, it))

    this.body.hidden = this.pricing
    this.pricer.hidden = !this.pricing
    this.tray.hidden = this.pricing || !this.selected
    this.sheet.classList.toggle('has-selection', !!this.selected)
    this.sheet.classList.toggle('is-pricing', this.pricing)
    if (this.selected) this.renderTray(state, this.selected)
    if (this.pricing) this.refreshPricer()
  }

  private slotButton(state: GameState, slot: Slot, item: ItemInstance | undefined): HTMLButtonElement {
    const b = el('button', 'slot')
    b.type = 'button'
    b.dataset.id = `slot-${slot.id}`
    const n = slot.id.split('-')[1] ?? ''
    if (!item) {
      b.classList.add('is-empty')
      if (this.selected) b.classList.add('is-target')
      b.append(el('span', 'slot-num', n))
      b.setAttribute('aria-label', `${AREA_NAME[slot.area]} ${n}, empty${this.selected ? ', tap to move here' : ''}`)
      b.addEventListener('click', () => {
        if (this.selected) this.place(slot.id)
      })
      return b
    }
    const price = state.shop.prices[item.id]
    b.classList.toggle('is-selected', item.id === this.selected)
    b.classList.toggle('no-tag', !price)
    b.append(el('span', 'slot-name', itemNameOf(item.defId)), el('span', 'slot-price', price ? rub(price) : 'no tag'))
    b.setAttribute('aria-label', `${AREA_NAME[slot.area]} ${n}: ${itemNameOf(item.defId)}, ${price ? `tagged ${rub(price)}` : 'no tag'}`)
    b.setAttribute('aria-pressed', String(item.id === this.selected))
    b.addEventListener('click', () => this.select(item.id === this.selected ? null : item.id))
    return b
  }

  private safeButton(state: GameState, item: ItemInstance): HTMLButtonElement {
    const b = el('button', 'safe-item')
    b.type = 'button'
    b.dataset.id = `safe-${item.id}`
    b.classList.toggle('is-selected', item.id === this.selected)
    b.setAttribute('aria-pressed', String(item.id === this.selected))
    const price = state.shop.prices[item.id]
    b.append(el('span', 'safe-name', itemNameOf(item.defId)), el('span', 'safe-paid', paidText(state, item.id)), el('span', 'slot-price', price ? rub(price) : 'no tag'))
    b.addEventListener('click', () => this.select(item.id === this.selected ? null : item.id))
    return b
  }

  private renderTray(state: GameState, id: string): void {
    const item = state.inventory.find((i) => i.id === id)
    if (!item) return
    const slot = state.shop.slots.find((s) => s.itemId === id)
    const price = state.shop.prices[id]
    setText(this.trayName, itemNameOf(item.defId))
    const where = slot ? `${AREA_NAME[slot.area]} ${slot.id.split('-')[1]}` : 'In the safe'
    setText(this.trayWhere, `${where} · ${paidText(state, id)} · tap an empty slot to move it`)
    setText(this.trayTag, price ? rub(price) : 'no tag')
    this.trayTag.classList.toggle('no-tag', !price)
    this.toSafe.disabled = !slot
    setButtonLabel(this.priceBtn, price ? 'Change tag' : 'Price tag', 'tag')
  }

  private select(id: string | null): void {
    this.selected = id
    this.pricing = false
    if (this.state) this.render(this.state)
  }

  private place(slotId: string | null): void {
    if (!this.selected) return
    this.deps.dispatch({ type: 'shop/place', itemId: this.selected, slotId })
  }

  private openPricer(): void {
    const s = this.state
    if (!s || !this.selected) return
    this.pricing = true
    this.pad.set(s.shop.prices[this.selected] ?? 0)
    this.render(s)
  }

  private closePricer(): void {
    this.pricing = false
    if (this.state) this.render(this.state)
  }

  private setTag(price: number): void {
    if (!this.selected) return
    this.deps.dispatch({ type: 'shop/price', itemId: this.selected, price })
    this.pricing = false
    if (this.state) this.render(this.deps.getState())
  }

  private refreshPricer(): void {
    const s = this.state
    const id = this.selected
    if (!s || !id) return
    const item = s.inventory.find((i) => i.id === id)
    if (!item) return
    const paid = s.paid[id] ?? 0
    const current = s.shop.prices[id]
    setText(this.priceName, itemNameOf(item.defId))
    setText(this.priceValue, this.amount > 0 ? rub(this.amount) : '— ₽')
    setText(this.priceNote, `${paidText(s, id)}${current ? ` · tag now ${rub(current)}` : ' · no tag yet'}`)
    const chips: (SideKey | null)[] = tuning.shop.tagChips.map((m) => ({
      id: `tag-x${String(m).replace('.', '_')}`,
      label: `×${m}`,
      sub: paid > 0 ? rub(roundTag(paid * m)) : 'paid',
      disabled: paid <= 0,
      onPress: () => this.pad.set(roundTag(paid * m)),
    }))
    this.pad.setSideKeys([...chips, { id: 'tag-clear', label: 'Clear', onPress: () => this.pad.set(0) }])
    this.setBtn.disabled = this.amount <= 0 || this.amount === current
    setButtonLabel(this.setBtn, this.amount > 0 ? `Tag ${rub(this.amount)}` : 'Set tag')
    this.removeBtn.disabled = !current
  }
}

function paidText(state: GameState, id: string): string {
  const paid = state.paid[id]
  if (paid === undefined) return 'forfeited pledge'
  return paid > 0 ? `paid ${rub(paid)}` : 'old stock'
}

/** Chip prices land on tidy hundreds (tens under 1,000 ₽). */
function roundTag(x: number): number {
  const step = x >= 1000 ? 100 : 10
  return Math.max(step, Math.round(x / step) * step)
}
