/**
 * The ending sequence (M5, GDD § 12), shown for any ended career (`career.end`):
 *
 *   1. paper:   the last morning paper, Вечерний Мостоград's format (src/ui/screens/news.ts),
 *               with the title's lead story;
 *   2. cards:   "what became of them", one card at a time (Next / Skip);
 *   3. summary: the career's final ledger (days run, best deal, worst mistake, people helped
 *               and hurt, the title), with "Read it again" (the epilogue) and Main menu.
 *
 * Shop feel (newsprint, index cards, a receipt), like the paper and the ledger. Content
 * comes from src/game/endings/epilogue.ts; the screen only keeps which step is showing.
 * A career that ends while being played starts at the paper; one opened from the title
 * screen starts at its summary (the screen is told by Ui).
 */
import { PAPER } from '../../data/news'
import { t, type PlainKey } from '../../data/strings'
import { epilogueOf, type Epilogue, type EpilogueCardView, type EpilogueStory } from '../../game/endings/epilogue'
import type { CareerEndKind, GameState } from '../../game/state'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { count, fullDate, longDate, rub, signedRub } from '../format'

export type EndingStep = 'paper' | 'cards' | 'summary'

const HOW: Record<CareerEndKind, PlainKey> = {
  retired: 'ending.how.retired',
  evicted: 'ending.how.evicted',
  raided: 'ending.how.raided',
  pushedOut: 'ending.how.pushedOut',
}

export class EndingScreen {
  readonly root: HTMLElement
  private readonly scroll: HTMLElement
  private readonly paper: HTMLElement
  private readonly dateLine: HTMLElement
  private readonly stories: HTMLElement
  private readonly card: HTMLElement
  private readonly summary: HTMLElement
  private readonly back: HTMLButtonElement
  private readonly skip: HTMLButtonElement
  private readonly next: HTMLButtonElement
  private readonly again: HTMLButtonElement
  private readonly menu: HTMLButtonElement
  private step: EndingStep = 'paper'
  private cardIndex = 0
  private epilogue: Epilogue | null = null
  private state: GameState | null = null
  private key = ''

  constructor(mainMenu: () => void) {
    const root = el('section', 'screen ending-screen')
    root.dataset.screen = 'ending'
    this.scroll = el('div', 'ending-scroll')

    // 1. the paper
    this.paper = el('article', 'paper ending-paper')
    this.paper.dataset.id = 'ending-paper'
    const mast = el('header', 'paper-mast')
    mast.append(el('div', 'paper-cyr', PAPER.cyr), el('div', 'paper-name', PAPER.name), el('div', 'paper-motto', PAPER.motto))
    this.dateLine = el('div', 'paper-dateline')
    this.stories = el('div', 'paper-stories')
    this.paper.append(mast, this.dateLine, this.stories)

    // 2. a card
    this.card = el('article', 'epi-card')
    this.card.dataset.id = 'ending-card'

    // 3. the summary
    this.summary = el('article', 'receipt career-receipt')
    this.summary.dataset.id = 'ending-summary'

    this.scroll.append(this.paper, this.card, this.summary)

    const footer = el('footer', 'ending-actions actions')
    this.back = createButton({ id: 'ending-back', label: t('common.back'), icon: 'back', variant: 'ghost', onPress: () => this.go(-1) })
    this.skip = createButton({ id: 'ending-skip', label: t('common.skip'), variant: 'ghost', onPress: () => this.show('summary') })
    this.next = createButton({ id: 'ending-next', label: t('common.next'), variant: 'primary', onPress: () => this.go(1) })
    this.again = createButton({ id: 'ending-again', label: t('ending.again'), icon: 'doc', onPress: () => this.show('paper') })
    this.menu = createButton({ id: 'ending-menu', label: t('common.mainMenu'), variant: 'primary', onPress: mainMenu })
    footer.append(this.back, this.skip, this.again, this.next, this.menu)
    root.append(this.scroll, footer)
    this.root = root
  }

  /** Jump to a step (Ui: the paper for an ending just reached, the summary for one opened from the title). */
  show(step: EndingStep): void {
    this.step = step
    this.cardIndex = 0
    this.paint()
  }

  render(state: GameState): void {
    const end = state.career.end
    const key = `${state.meta.careerId}|${end?.kind}|${end?.day}|${end?.title}`
    this.state = state
    if (key === this.key) return
    this.key = key
    this.epilogue = epilogueOf(state)
    this.paint()
  }

  private go(dir: 1 | -1): void {
    const cards = this.epilogue?.cards.length ?? 0
    if (this.step === 'paper') {
      if (dir > 0) this.step = cards > 0 ? 'cards' : 'summary'
    } else if (this.step === 'cards') {
      const i = this.cardIndex + dir
      if (i < 0) this.step = 'paper'
      else if (i >= cards) this.step = 'summary'
      else this.cardIndex = i
    }
    this.paint()
  }

  private paint(): void {
    const e = this.epilogue
    const s = this.state
    if (!e || !s) return
    const cards = e.cards.length
    if (this.step === 'cards' && cards === 0) this.step = 'summary'
    this.paper.hidden = this.step !== 'paper'
    this.card.hidden = this.step !== 'cards'
    this.summary.hidden = this.step !== 'summary'
    this.root.dataset.step = this.step
    document.body.dataset.endingStep = this.step
    const onSummary = this.step === 'summary'
    this.again.hidden = !onSummary
    this.menu.hidden = !onSummary
    this.next.hidden = onSummary
    this.back.hidden = this.step !== 'cards'
    this.skip.hidden = onSummary
    if (this.step === 'paper') {
      setButtonLabel(this.next, cards > 0 ? t('ending.whatBecame') : t('ending.summary'))
      this.paintPaper(e.paper, s)
    } else if (this.step === 'cards') {
      const last = this.cardIndex >= cards - 1
      setButtonLabel(this.next, last ? t('ending.summary') : t('common.next'))
      this.paintCard(e.cards[this.cardIndex]!, this.cardIndex, cards)
    } else {
      this.paintSummary(e)
    }
    this.scroll.scrollTo(0, 0)
  }

  private paintPaper(stories: EpilogueStory[], s: GameState): void {
    setText(this.dateLine, t('ending.dateline', { date: fullDate(s.calendar.date), price: PAPER.price }))
    this.stories.replaceChildren(
      ...stories.map((n, i) => {
        const story = el('section', i === 0 ? 'paper-story is-lead' : 'paper-story')
        story.dataset.id = `ending-${n.id}`
        story.append(el(i === 0 ? 'h2' : 'h3', 'paper-headline', n.headline), el('p', 'paper-body', n.body))
        return story
      }),
    )
  }

  private paintCard(c: EpilogueCardView, i: number, n: number): void {
    this.card.dataset.card = c.id
    const head = el('header', 'epi-card-head')
    head.append(el('span', 'epi-card-count', t('ending.cardCount', { i: i + 1, n })), el('span', 'epi-card-kicker', t('ending.whatBecame')))
    this.card.replaceChildren(head, el('h2', 'epi-card-name', c.name), el('p', 'epi-card-role', c.role), el('p', 'epi-card-text', c.text))
  }

  private paintSummary(e: Epilogue): void {
    const m = e.summary
    const head = el('header', 'receipt-head')
    head.append(el('div', 'receipt-shop', m.shopName.toUpperCase()), el('div', 'receipt-cyr', t('common.cyrCity')), el('div', 'receipt-title', t('ending.ledgerTitle')))
    const title = el('div', 'career-title')
    title.dataset.id = 'ending-title'
    title.append(el('span', 'career-title-kicker', t('ending.kicker')), el('h2', 'career-title-name', m.titleName), el('p', 'career-title-strap', m.strap))
    const rows: [string, string, string?][] = [
      [t('ending.how'), t(HOW[m.kind])],
      [t('ending.daysRun'), count(m.daysRun)],
      [t('ending.lastDay'), longDate(m.endDate)],
      [t('ending.best'), m.bestDeal > 0 ? signedRub(m.bestDeal) : t('ending.bestNone')],
      [t('ending.worst'), m.worstDeal > 0 ? signedRub(-m.worstDeal) : t('ending.worstNone')],
      [t('ending.fakes'), count(m.fakesBought)],
      [t('ending.helped'), count(m.peopleHelped)],
      [t('ending.hurt'), count(m.peopleHurt)],
      [t('ending.worth'), rub(m.wealth), 'total'],
    ]
    const dl = el('dl', 'receipt-summary career-rows')
    for (const [k, v, cls] of rows) dl.append(el('dt', cls ?? '', k), el('dd', cls ?? '', v))
    this.summary.replaceChildren(head, title, dl, el('div', 'receipt-foot', t('ending.foot')))
  }
}
