/**
 * The morning paper at day open (owner: content worker). Shown while
 * day.newsRead is false; "Open the door" dispatches news/dismiss.
 *
 * A folded copy of Вечерний Мостоград / Evening Mostograd: masthead, date line,
 * the lead story big, the rest in a column below. Portrait first; the page scrolls if
 * a long day's paper does not fit.
 */
import type { Action } from '../../game/actions'
import { PAPER } from '../../data/news'
import type { GameState } from '../../game/state'
import type { NewsItem } from '../../game/types'
import { createButton, el, setText } from '../components/button'
import { longDate, WEEKDAYS } from '../format'

export class NewsScreen {
  readonly root: HTMLElement
  private readonly dateLine: HTMLElement
  private readonly stories: HTMLElement
  private key = ''

  constructor(dispatch: (a: Action) => void) {
    const root = el('section', 'screen news-screen')
    root.dataset.screen = 'news'
    const scroll = el('div', 'news-scroll')
    const paper = el('article', 'paper')
    paper.dataset.id = 'news'
    const mast = el('header', 'paper-mast')
    mast.append(el('div', 'paper-cyr', PAPER.cyr), el('div', 'paper-name', PAPER.name), el('div', 'paper-motto', PAPER.motto))
    this.dateLine = el('div', 'paper-dateline')
    this.stories = el('div', 'paper-stories')
    paper.append(mast, this.dateLine, this.stories)
    scroll.append(paper)
    const footer = el('footer', 'news-actions actions')
    footer.append(createButton({ id: 'news-done', label: 'Open the door', variant: 'primary', icon: 'door', onPress: () => dispatch({ type: 'news/dismiss' }) }))
    root.append(scroll, footer)
    this.root = root
  }

  render(state: GameState): void {
    const key = `${state.calendar.date}|${state.market.news.map((n) => n.id).join(',')}`
    if (key === this.key) return
    this.key = key
    const { date, weekday, day } = state.calendar
    setText(this.dateLine, `${WEEKDAYS[weekday]}, ${longDate(date)} · No. ${day} · ${PAPER.price}`)
    this.stories.replaceChildren(...state.market.news.map((n, i) => story(n, i === 0)))
    this.root.querySelector('.news-scroll')?.scrollTo(0, 0)
  }
}

function story(n: NewsItem, lead: boolean): HTMLElement {
  const s = el('section', lead ? 'paper-story is-lead' : 'paper-story')
  s.dataset.id = `news-${n.id}`
  s.append(el(lead ? 'h2' : 'h3', 'paper-headline', n.headline), el('p', 'paper-body', n.body))
  return s
}
