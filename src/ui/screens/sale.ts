/**
 * A walk-in buyer at the counter (owner: shop worker). They picked up one of
 * your displayed items and made an offer under your tag. Accept their offer,
 * counter on the number pad (between their offer and your tag), or refuse
 * (counter/pass). The resolved visit (sold / walked) shows on the counter
 * screen with its stamp.
 *
 * Local UI state (pad open, typed digits) lives here; game state only changes
 * through sale/accept, sale/counter and counter/pass.
 */
import type { Action } from '../../game/actions'
import type { GameState } from '../../game/state'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { NumPad } from '../components/numpad'
import { archetypeLabel, itemNameOf, rub } from '../format'
import './shop.css'

export class SaleScreen {
  readonly root: HTMLElement
  readonly strip: HTMLElement
  private name: HTMLElement
  private tag: HTMLElement
  private item: HTMLElement
  private line: HTMLElement
  private offerValue: HTMLElement
  private tagValue: HTMLElement
  private offerTrail: HTMLElement
  private actions: HTMLElement
  private accept: HTMLButtonElement
  private panel: HTMLElement
  private yourValue: HTMLElement
  private yourNote: HTMLElement
  private pad: NumPad
  private submit: HTMLButtonElement

  private visitId: string | null = null
  private rounds = 0
  private countering = false
  private amount = 0
  private state: GameState | null = null

  constructor(private readonly dispatch: (a: Action) => void) {
    const root = el('section', 'screen counter-screen sale-screen')
    root.dataset.screen = 'sale'
    const strip = el('div', 'strip')
    const dialogue = el('div', 'dialogue')
    dialogue.setAttribute('aria-live', 'polite')
    const speaker = el('div', 'speaker')
    this.name = el('span', 'speaker-name')
    this.tag = el('span', 'speaker-tag')
    speaker.append(this.name, this.tag)
    this.item = el('div', 'item-tag')
    this.item.dataset.id = 'sale-item'
    this.line = el('p', 'line')
    this.line.dataset.id = 'sale-line'
    dialogue.append(speaker, this.item, this.line)

    const offer = el('div', 'sale-offer')
    offer.dataset.id = 'sale-offer'
    const yours = el('div', 'sale-offer-col sale-offer-tag')
    this.tagValue = el('span', 'sale-tag-value')
    yours.append(el('span', 'sale-offer-label', 'Your tag'), this.tagValue)
    const theirs = el('div', 'sale-offer-col')
    this.offerValue = el('span', 'sale-offer-value')
    theirs.append(el('span', 'sale-offer-label', 'They offer'), this.offerValue)
    const offerMain = el('div', 'sale-offer-main')
    offerMain.append(yours, theirs)
    this.offerTrail = el('div', 'sale-offer-trail')
    offer.append(offerMain, this.offerTrail)

    this.actions = el('div', 'actions counter-actions')
    const refuse = createButton({ id: 'sale-refuse', label: 'Refuse', onPress: () => dispatch({ type: 'counter/pass' }) })
    const counter = createButton({ id: 'sale-counter', label: 'Counter', onPress: () => this.openPad() })
    this.accept = createButton({ id: 'sale-accept', label: 'Accept', variant: 'primary', onPress: () => dispatch({ type: 'sale/accept' }) })
    this.actions.append(refuse, counter, this.accept)

    // Counter pad
    this.panel = el('div', 'sale-pad')
    this.panel.dataset.id = 'sale-pad'
    const tag = el('div', 'price-tag')
    tag.dataset.id = 'sale-amount'
    this.yourValue = el('span', 'price-tag-value')
    this.yourNote = el('span', 'price-tag-note')
    tag.append(el('span', 'price-tag-label', 'Your price'), this.yourValue, this.yourNote)
    this.pad = new NumPad('sale', (v) => {
      this.amount = v
      this.refresh()
    })
    const padActions = el('div', 'actions')
    this.submit = createButton({ id: 'sale-ask', label: 'Ask', variant: 'primary', onPress: () => this.onSubmit() })
    padActions.append(createButton({ id: 'sale-back', label: 'Back', icon: 'back', ariaLabel: 'Back', onPress: () => this.closePad() }), this.submit)
    this.panel.append(tag, this.pad.root, padActions)

    strip.append(dialogue, offer, this.actions, this.panel)
    root.append(strip)
    this.root = root
    this.strip = strip
  }

  render(state: GameState): void {
    this.state = state
    const c = state.current
    if (!c || !c.sale || !c.item) return
    if (c.visitId !== this.visitId) {
      this.visitId = c.visitId
      this.rounds = 0
      this.countering = false
      this.pad.set(0)
    }
    if (c.sale.history.length !== this.rounds) {
      // After each round the pad closes so their new offer and line are in view.
      this.rounds = c.sale.history.length
      this.countering = false
    }
    setText(this.name, c.customer.name)
    setText(this.tag, archetypeLabel(c.customer.archetype))
    setText(this.item, itemNameOf(c.item.defId))
    setText(this.tagValue, rub(c.sale.tag))
    setText(this.line, `“${c.line}”`)
    setText(this.offerValue, rub(c.sale.offer))
    const trail = c.sale.history.filter((h) => h.response.kind === 'counter').map((h) => `you ${rub(h.counter)} → ${rub(h.response.price)}`)
    setText(this.offerTrail, trail.length ? trail.join(' · ') : 'Their opening offer')
    setButtonLabel(this.accept, `Sell ${rub(c.sale.offer)}`)
    this.refresh()
  }

  /** Desktop keys: digits/Backspace/Enter on the pad, Esc closes it. */
  key(k: string): boolean {
    if (!this.countering) return false
    if (k === 'Escape') {
      this.closePad()
      return true
    }
    if (k === 'Enter') {
      this.onSubmit()
      return true
    }
    return this.pad.key(k)
  }

  private refresh(): void {
    const sale = this.state?.current?.sale
    if (!sale) return
    this.root.classList.toggle('is-countering', this.countering)
    this.actions.hidden = this.countering
    this.panel.hidden = !this.countering
    const v = this.amount
    setText(this.yourValue, v > 0 ? rub(v) : '— ₽')
    const over = v > sale.tag
    this.root.classList.toggle('is-over', over)
    setText(this.yourNote, over ? `Above your own tag (${rub(sale.tag)})` : `They offer ${rub(sale.offer)} · tag ${rub(sale.tag)}`)
    const mid = Math.round((sale.offer + sale.tag) / 2 / 100) * 100
    this.pad.setSideKeys([
      { id: 'sale-chip-tag', label: 'Tag', sub: rub(sale.tag), onPress: () => this.pad.set(sale.tag) },
      { id: 'sale-chip-split', label: 'Split', sub: rub(Math.max(sale.offer, mid)), onPress: () => this.pad.set(Math.max(sale.offer, mid)) },
      null,
      { id: 'sale-clear', label: 'Clear', onPress: () => this.pad.set(0) },
    ])
    this.submit.disabled = v <= 0 || over
    if (v > 0 && v <= sale.offer) setButtonLabel(this.submit, `Take ${rub(sale.offer)}`)
    else setButtonLabel(this.submit, v > 0 ? `Ask ${rub(v)}` : 'Ask')
  }

  private openPad(): void {
    const sale = this.state?.current?.sale
    if (!sale) return
    this.countering = true
    if (this.amount <= sale.offer || this.amount > sale.tag) this.pad.set(sale.tag)
    else this.refresh()
  }

  private closePad(): void {
    this.countering = false
    this.refresh()
  }

  private onSubmit(): void {
    if (this.submit.disabled) return
    this.dispatch({ type: 'sale/counter', amount: this.amount })
  }
}
