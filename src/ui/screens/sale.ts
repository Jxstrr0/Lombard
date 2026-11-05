/**
 * A walk-in buyer at the counter (owner: shop worker). They picked up one of
 * your displayed items and made an offer under your tag. Accept, counter
 * (number pad, between their offer and your tag), or refuse (counter/pass).
 *
 * Stub: their offer, Accept and Refuse. The shop worker builds the real screen.
 */
import type { Action } from '../../game/actions'
import type { GameState } from '../../game/state'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { archetypeLabel, itemNameOf, rub } from '../format'

export class SaleScreen {
  readonly root: HTMLElement
  readonly strip: HTMLElement
  private name: HTMLElement
  private tag: HTMLElement
  private item: HTMLElement
  private line: HTMLElement
  private accept: HTMLButtonElement

  constructor(dispatch: (a: Action) => void) {
    const root = el('section', 'screen counter-screen sale-screen')
    root.dataset.screen = 'sale'
    const strip = el('div', 'strip')
    const dialogue = el('div', 'dialogue')
    const speaker = el('div', 'speaker')
    this.name = el('span', 'speaker-name')
    this.tag = el('span', 'speaker-tag')
    speaker.append(this.name, this.tag)
    this.item = el('div', 'item-tag')
    this.item.dataset.id = 'sale-item'
    this.line = el('p', 'line')
    dialogue.append(speaker, this.item, this.line)
    const actions = el('div', 'actions counter-actions')
    const refuse = createButton({ id: 'sale-refuse', label: 'Refuse', onPress: () => dispatch({ type: 'counter/pass' }) })
    this.accept = createButton({ id: 'sale-accept', label: 'Accept', variant: 'primary', onPress: () => dispatch({ type: 'sale/accept' }) })
    actions.append(refuse, this.accept)
    strip.append(dialogue, actions)
    root.append(strip)
    this.root = root
    this.strip = strip
  }

  render(state: GameState): void {
    const c = state.current
    if (!c || !c.sale) return
    setText(this.name, c.customer.name)
    setText(this.tag, archetypeLabel(c.customer.archetype))
    setText(this.item, `${itemNameOf(c.item.defId)} · tag ${rub(c.sale.tag)}`)
    setText(this.line, `“${c.line}”`)
    setButtonLabel(this.accept, `Sell for ${rub(c.sale.offer)}`)
  }
}
