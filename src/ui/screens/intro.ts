/**
 * Career start (owner: content worker): name your shop (default from tuning),
 * a short intro, then career/begin. Shown while meta.intro is true.
 *
 * Stub: a name field and Begin. The content worker builds the real intro.
 */
import type { Action } from '../../game/actions'
import { tuning } from '../../data/tuning'
import type { GameState } from '../../game/state'
import { createButton, el } from '../components/button'

export class IntroScreen {
  readonly root: HTMLElement

  constructor(dispatch: (a: Action) => void) {
    const root = el('section', 'screen welcome-screen intro-screen')
    root.dataset.screen = 'intro'
    const card = el('article', 'welcome-card menu')
    const input = el('input', 'shop-name-input')
    input.dataset.id = 'shop-name'
    input.maxLength = tuning.career.shopNameMaxLength
    input.placeholder = tuning.career.defaultShopName
    input.value = tuning.career.defaultShopName
    const begin = createButton({
      id: 'intro-begin',
      label: 'Begin',
      variant: 'primary',
      onPress: () => dispatch({ type: 'career/begin', shopName: input.value }),
    })
    card.append(el('h1', 'welcome-name', 'Name your shop'), input, begin)
    root.append(card)
    this.root = root
  }

  render(_state: GameState): void {}
}
