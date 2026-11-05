/**
 * The morning paper at day open (owner: content worker). Shown while
 * day.newsRead is false; "Open the door" dispatches news/dismiss.
 *
 * Stub: headlines in a list. The content worker builds the real newspaper.
 */
import type { Action } from '../../game/actions'
import type { GameState } from '../../game/state'
import { createButton, el } from '../components/button'

export class NewsScreen {
  readonly root: HTMLElement
  private list: HTMLElement

  constructor(dispatch: (a: Action) => void) {
    const root = el('section', 'screen news-screen')
    root.dataset.screen = 'news'
    const card = el('article', 'welcome-card')
    this.list = el('div', 'news-list')
    const go = createButton({ id: 'news-done', label: 'Open the door', variant: 'primary', icon: 'door', onPress: () => dispatch({ type: 'news/dismiss' }) })
    card.append(this.list, go)
    root.append(card)
    this.root = root
  }

  render(state: GameState): void {
    this.list.replaceChildren(...state.market.news.map((n) => el('p', 'news-item', n.headline)))
  }
}
