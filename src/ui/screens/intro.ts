/**
 * Career start (owner: content worker): name your shop (default from tuning),
 * three short cards (GDD § Setting: a failing shop bought cheap, an owner who left
 * in a hurry, what's in the safe), then Begin → career/begin. Shown while meta.intro is true.
 *
 * Longlight palette. Tap the card or Next to go on; Skip jumps straight to Begin.
 * The step is UI state only (like an unsent draft): it resets for every new career.
 */
import type { Action } from '../../game/actions'
import { INTRO_CARDS, NAME_STEP } from '../../data/intro'
import { tuning } from '../../data/tuning'
import type { GameState } from '../../game/state'
import { createButton, el, setButtonLabel, setText } from '../components/button'

export class IntroScreen {
  readonly root: HTMLElement
  private step = 0
  private careerId = ''
  private readonly card: HTMLElement
  private readonly kicker: HTMLElement
  private readonly title: HTMLElement
  private readonly body: HTMLElement
  private readonly input: HTMLInputElement
  private readonly dots: HTMLElement
  private readonly skip: HTMLButtonElement
  private readonly next: HTMLButtonElement

  constructor(private readonly dispatch: (a: Action) => void) {
    const root = el('section', 'screen welcome-screen intro-screen')
    root.dataset.screen = 'intro'
    const card = el('article', 'welcome-card menu intro-card')
    card.dataset.id = 'intro-card'
    this.card = card
    this.kicker = el('span', 'welcome-cyr intro-kicker')
    this.title = el('h1', 'welcome-name')
    this.body = el('p', 'welcome-text intro-body')
    const input = el('input', 'shop-name-input')
    input.dataset.id = 'shop-name'
    input.type = 'text'
    input.maxLength = tuning.career.shopNameMaxLength
    input.placeholder = tuning.career.defaultShopName
    input.value = tuning.career.defaultShopName
    input.autocomplete = 'off'
    input.spellcheck = false
    input.setAttribute('aria-label', 'Shop name')
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur()
        this.advance()
      }
    })
    this.input = input
    this.dots = el('div', 'intro-dots')
    this.dots.setAttribute('aria-hidden', 'true')
    for (let i = 0; i <= INTRO_CARDS.length; i++) this.dots.append(el('span', 'intro-dot'))
    const actions = el('div', 'actions intro-actions')
    this.skip = createButton({ id: 'intro-skip', label: 'Skip', variant: 'ghost', onPress: () => this.begin() })
    this.next = createButton({ id: 'intro-next', label: 'Next', variant: 'primary', onPress: () => this.advance() })
    actions.append(this.skip, this.next)
    card.append(this.kicker, this.title, this.body, input, this.dots, actions, el('p', 'welcome-studio', 'A Longlight Interactive game'))
    // A tap anywhere on a story card (not its buttons or the name field) turns the page.
    // Use the event path, not target.closest(): a button's label swap can detach the
    // tapped span before the click bubbles here, which would turn two pages at once.
    card.addEventListener('click', (e) => {
      if (this.step === 0) return
      if (e.composedPath().some((n) => n instanceof HTMLButtonElement || n instanceof HTMLInputElement)) return
      this.advance()
    })
    root.append(card)
    this.root = root
    this.show()
  }

  render(state: GameState): void {
    if (state.meta.careerId !== this.careerId) {
      this.careerId = state.meta.careerId
      this.step = 0
      this.input.value = state.shop.name || tuning.career.defaultShopName
      this.show()
    }
  }

  private get last(): boolean {
    return this.step >= INTRO_CARDS.length
  }

  private advance(): void {
    if (this.last) return this.begin()
    this.step++
    this.show()
  }

  private begin(): void {
    this.dispatch({ type: 'career/begin', shopName: this.input.value })
  }

  private show(): void {
    const s = this.step
    const card = s === 0 ? NAME_STEP : INTRO_CARDS[s - 1]!
    setText(this.kicker, card.kicker)
    setText(this.title, card.title)
    setText(this.body, card.body)
    this.card.dataset.step = s === 0 ? 'name' : INTRO_CARDS[s - 1]!.id
    this.card.classList.toggle('is-story', s > 0)
    this.input.hidden = s !== 0
    this.dots.querySelectorAll('.intro-dot').forEach((d, i) => d.classList.toggle('is-on', i === s))
    this.skip.hidden = this.last
    // The last card's button is Begin (its own data-id, so scripts can find it).
    this.next.dataset.id = this.last ? 'intro-begin' : 'intro-next'
    setButtonLabel(this.next, this.last ? 'Begin' : 'Next', this.last ? 'door' : undefined)
  }
}
