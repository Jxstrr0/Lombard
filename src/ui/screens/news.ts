/**
 * The morning paper at day open (owner: content worker). Shown while
 * day.newsRead is false; "Open the door" dispatches news/dismiss.
 *
 * A folded copy of Вечерний Мостоград / Evening Mostograd: masthead, date line,
 * the lead story big, the rest in a column below. Portrait first; the page scrolls if
 * a long day's paper does not fit.
 */
import type { Action } from '../../game/actions'
import { BULLETIN, PAPER } from '../../data/news'
import { bulletinToday } from '../../game/crime/bulletin'
import type { GameState } from '../../game/state'
import type { NewsItem } from '../../game/types'
import { createButton, el, setText } from '../components/button'
import { longDate, WEEKDAYS } from '../format'

export class NewsScreen {
  readonly root: HTMLElement
  private readonly dateLine: HTMLElement
  private readonly stories: HTMLElement
  /** M5: the police's stolen-goods notice, on days it runs (crime/bulletin.ts). */
  private readonly bulletin: HTMLElement
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
    this.bulletin = el('aside', 'paper-bulletin')
    this.bulletin.dataset.id = 'news-bulletin'
    paper.append(mast, this.dateLine, this.stories, this.bulletin)
    scroll.append(paper)
    const footer = el('footer', 'news-actions actions')
    footer.append(createButton({ id: 'news-done', label: 'Open the door', variant: 'primary', icon: 'door', onPress: () => dispatch({ type: 'news/dismiss' }) }))
    root.append(scroll, footer)
    this.root = root
  }

  render(state: GameState): void {
    const lines = bulletinToday(state)
    const key = `${state.calendar.date}|${state.market.news.map((n) => n.id).join(',')}|${lines.map((b) => b.id).join(',')}`
    if (key === this.key) return
    this.key = key
    const { date, weekday, day } = state.calendar
    setText(this.dateLine, `${WEEKDAYS[weekday]}, ${longDate(date)} · No. ${day} · ${PAPER.price}`)
    this.stories.replaceChildren(...state.market.news.map((n, i) => story(n, i === 0)))
    this.bulletin.hidden = lines.length === 0
    const list = el('ul', 'bulletin-lines')
    for (const b of lines) {
      const li = el('li', '', b.text)
      li.dataset.id = `bulletin-${b.id}`
      list.append(li)
    }
    this.bulletin.replaceChildren(el('div', 'bulletin-cyr', BULLETIN.cyr), el('div', 'bulletin-title', BULLETIN.title), el('p', 'bulletin-intro', BULLETIN.intro), list)
    this.root.querySelector('.news-scroll')?.scrollTo(0, 0)
  }
}

function story(n: NewsItem, lead: boolean): HTMLElement {
  const s = el('section', lead ? 'paper-story is-lead' : 'paper-story')
  s.dataset.id = `news-${n.id}`
  s.append(el(lead ? 'h2' : 'h3', 'paper-headline', n.headline), el('p', 'paper-body', n.body))
  return s
}
