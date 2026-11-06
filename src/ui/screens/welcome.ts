/**
 * Day 1, before opening (after the career-start intro): the shop's name on the sign,
 * what the previous owner left in the safe, the till, and "Open shop".
 * Longlight palette. The premise was told in the intro; this card doesn't repeat it.
 */
import { t } from '../../data/strings'
import type { Action } from '../../game/actions'
import type { GameState } from '../../game/state'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { itemNameOf, rub } from '../format'

export class WelcomeScreen {
  readonly root: HTMLElement
  private open: HTMLButtonElement
  private name: HTMLElement
  private cash: HTMLElement
  private safe: HTMLElement
  private safeKey = ''

  constructor(dispatch: (a: Action) => void, openSettings: () => void, gear: (onPress: () => void) => HTMLButtonElement) {
    const root = el('section', 'screen welcome-screen')
    root.dataset.screen = 'welcome'
    const card = el('article', 'welcome-card menu')
    card.dataset.id = 'welcome'
    const sign = el('div', 'welcome-sign')
    this.name = el('h1', 'welcome-name')
    sign.append(el('span', 'welcome-cyr', t('welcome.kicker')), this.name)
    const p = el('p', 'welcome-text', t('welcome.text'))
    this.safe = el('ul', 'welcome-safe')
    this.safe.dataset.id = 'welcome-safe'
    this.cash = el('p', 'welcome-cash')
    const actions = el('div', 'actions welcome-actions')
    this.open = createButton({ id: 'open-shop', label: t('common.openShop'), variant: 'primary', icon: 'door', onPress: () => dispatch({ type: 'day/open' }) })
    actions.append(gear(openSettings), this.open)
    card.append(sign, p, el('h2', 'welcome-safe-h', t('welcome.safe')), this.safe, this.cash, actions, el('p', 'welcome-studio', t('common.studio')))
    root.append(card)
    this.root = root
  }

  render(state: GameState): void {
    setText(this.name, state.shop.name)
    setText(this.cash, t('welcome.cash', { cash: rub(state.cash), day: state.calendar.day }))
    setButtonLabel(this.open, t('common.openShop'), 'door')
    const key = state.inventory.map((i) => i.id).join(',')
    if (key === this.safeKey) return
    this.safeKey = key
    this.safe.replaceChildren()
    if (state.inventory.length === 0) this.safe.append(el('li', 'welcome-safe-empty', t('welcome.safeEmpty')))
    for (const item of state.inventory) this.safe.append(el('li', '', itemNameOf(item.defId)))
  }
}
