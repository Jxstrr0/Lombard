/**
 * First launch (no days played yet): a short welcome card in the Longlight
 * palette with the premise and "Open shop". The name-your-shop screen is M2;
 * until then the shop is "Lombard No. 7".
 */
import type { Action } from '../../game/actions'
import type { GameState } from '../../game/state'
import { createButton, el, setButtonLabel } from '../components/button'
import { rub } from '../format'
import { SHOP_NAME } from './ledger'

export class WelcomeScreen {
  readonly root: HTMLElement
  private open: HTMLButtonElement
  private cash: HTMLElement

  constructor(dispatch: (a: Action) => void, openSettings: () => void, gear: (onPress: () => void) => HTMLButtonElement) {
    const root = el('section', 'screen welcome-screen')
    root.dataset.screen = 'welcome'
    const card = el('article', 'welcome-card menu')
    card.dataset.id = 'welcome'
    const sign = el('div', 'welcome-sign')
    sign.append(el('span', 'welcome-cyr', 'ЛОМБАРД'), el('h1', 'welcome-name', SHOP_NAME))
    const p = el(
      'p',
      'welcome-text',
      'You bought a failing pawn shop on a Mostograd canal for next to nothing. The last owner left town in a hurry. ' +
        'Every customer brings something: is it real, what is it worth, and are they telling the truth? ' +
        'Look closely, make an offer, and keep the shop afloat.',
    )
    this.cash = el('p', 'welcome-cash')
    const actions = el('div', 'actions welcome-actions')
    this.open = createButton({ id: 'open-shop', label: 'Open shop', variant: 'primary', icon: 'door', onPress: () => dispatch({ type: 'day/open' }) })
    actions.append(gear(openSettings), this.open)
    card.append(sign, p, this.cash, actions, el('p', 'welcome-studio', 'A Longlight Interactive game'))
    root.append(card)
    this.root = root
  }

  render(state: GameState): void {
    this.cash.textContent = `${rub(state.cash)} in the till. Day ${state.calendar.day}.`
    setButtonLabel(this.open, 'Open shop', 'door')
  }
}
