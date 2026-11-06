/**
 * Counter screen: the dialogue strip (customer name, archetype, line) and the
 * buttons that follow the day loop. Reads state and dispatches actions; never
 * mutates state.
 */
import { t, type PlainKey } from '../../data/strings'
import type { Action } from '../../game/actions'
import type { GameState } from '../../game/state'
import type { VisitOutcome } from '../../game/types'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { archetypeLabel, itemNameOf, rub } from '../format'
import type { IconName } from '../icons'
import '../story.css'

const LOOK_HINT_KEY = 'lombard.lookHintSeen'

function lookHintSeen(): boolean {
  try {
    return localStorage.getItem(LOOK_HINT_KEY) === '1'
  } catch {
    return false
  }
}

type Primary = 'counter/next' | 'day/close' | 'counter/inspect' | 'counter/dismiss' | 'scene/next'

const OUTCOME: Record<VisitOutcome, PlainKey> = {
  bought: 'outcome.bought',
  pawned: 'outcome.pawned',
  sold: 'outcome.sold',
  redeemed: 'outcome.redeemed',
  passed: 'outcome.passed',
  walked: 'outcome.walked',
  left: 'outcome.left',
  talked: 'outcome.talked',
}

export class CounterScreen {
  readonly root: HTMLElement
  readonly strip: HTMLElement
  private speaker: HTMLElement
  private name: HTMLElement
  private tag: HTMLElement
  private loanBadge: HTMLElement
  /** M4: shown for authored regulars (they remember you). */
  private regularBadge: HTMLElement
  /** M4: a specialist talking: "specialist" at the counter, "on the phone" on a call. */
  private specialistBadge: HTMLElement
  /** M4: a story scene's choices, on its last line. */
  private choices: HTMLElement
  private choiceKey = ''
  private readonly dispatch: (a: Action) => void
  private itemName: HTMLElement
  private line: HTMLElement
  private stamp: HTMLElement
  private primary: HTMLButtonElement
  private secondary: HTMLButtonElement
  private primaryAction: Primary = 'counter/next'
  /** One-time "drag to look around" hint, shown over the 3D view while nobody is at the counter. */
  private readonly lookHint: HTMLElement
  private lookHintDone = lookHintSeen()
  private lookHintShown = false

  constructor(
    dispatch: (a: Action) => void,
    openSettings: () => void,
    gear: (onPress: () => void) => HTMLButtonElement,
    /** Opens the shop sheet; shown only while nobody is at the counter. */
    private readonly shopButton?: HTMLButtonElement,
    /** `?lull=0` (review and screenshots): call each customer with a button instead of waiting out the lull. */
    private readonly manualNext = false,
  ) {
    this.dispatch = dispatch
    const root = el('section', 'screen counter-screen')
    root.dataset.screen = 'counter'
    const strip = el('div', 'strip')
    const dialogue = el('div', 'dialogue')
    dialogue.setAttribute('aria-live', 'polite')
    this.speaker = el('div', 'speaker')
    this.name = el('span', 'speaker-name')
    this.tag = el('span', 'speaker-tag')
    this.loanBadge = el('span', 'loan-badge', t('counter.badgeLoan'))
    this.loanBadge.dataset.id = 'loan-badge'
    this.regularBadge = el('span', 'regular-badge', t('counter.badgeRegular'))
    this.regularBadge.dataset.id = 'regular-badge'
    this.specialistBadge = el('span', 'specialist-badge', t('counter.badgeSpecialist'))
    this.specialistBadge.dataset.id = 'specialist-badge'
    this.speaker.append(this.name, this.tag, this.regularBadge, this.specialistBadge, this.loanBadge)
    this.itemName = el('div', 'item-tag')
    this.itemName.dataset.id = 'counter-item'
    this.line = el('p', 'line')
    this.line.dataset.id = 'counter-line'
    this.stamp = el('div', 'outcome-stamp')
    this.stamp.dataset.id = 'outcome'
    dialogue.append(this.speaker, this.itemName, this.line, this.stamp)

    this.choices = el('div', 'scene-choices')
    this.choices.dataset.id = 'scene-choices'
    this.choices.hidden = true
    const actions = el('div', 'actions counter-actions')
    this.secondary = createButton({ id: 'pass', label: t('common.pass'), onPress: () => dispatch({ type: 'counter/pass' }) })
    this.primary = createButton({
      id: 'next-customer',
      label: t('counter.next'),
      variant: 'primary',
      onPress: () => dispatch({ type: this.primaryAction }),
    })
    actions.append(gear(openSettings), ...(shopButton ? [shopButton] : []), this.secondary, this.primary)
    strip.append(dialogue, this.choices, actions)
    this.lookHint = el('p', 'look-hint', t('counter.lookHint'))
    this.lookHint.dataset.id = 'look-hint'
    this.lookHint.hidden = true
    root.append(this.lookHint, strip)
    this.root = root
    this.strip = strip
  }

  /** The player turned the head: the hint has done its job, for good. */
  lookUsed(): void {
    this.retireLookHint()
  }

  private retireLookHint(): void {
    this.lookHint.hidden = true
    if (this.lookHintDone) return
    this.lookHintDone = true
    try {
      localStorage.setItem(LOOK_HINT_KEY, '1')
    } catch {
      // storage blocked: the hint may show again next session
    }
  }

  /** `arrived` false: the current customer is still walking in; show the shop as empty until they reach the counter. */
  render(state: GameState, arrived = true): void {
    const c = state.current && (arrived || (state.current.phase !== 'present' && state.current.phase !== 'scene')) ? state.current : null
    const walking = !!state.current && !c
    if (!this.lookHintDone) {
      if (!c && state.day.phase === 'open') {
        this.lookHint.hidden = false
        this.lookHintShown = true
      } else if (this.lookHintShown) {
        this.retireLookHint()
      }
    }
    this.speaker.hidden = !c
    if (c) {
      setText(this.name, c.customer.name)
      setText(this.tag, archetypeLabel(c.customer.archetype))
      this.regularBadge.hidden = !c.customer.regularId
      this.specialistBadge.hidden = !c.customer.specialistId && !c.via
      setText(this.specialistBadge, c.via === 'phone' ? t('counter.badgePhone') : t('counter.badgeSpecialist'))
      this.loanBadge.hidden = !(c.kind === 'seller' && c.wants === 'pawn' && c.phase !== 'resolved' && c.phase !== 'scene')
      if (c.item) setText(this.itemName, itemNameOf(c.item.defId, t('counter.wrapped')))
    }
    this.itemName.hidden = !c?.item || c.phase === 'resolved'
    setText(this.line, c ? t('common.quote', { text: c.line }) : walking ? t('counter.doorOpens') : state.narration)
    this.line.classList.toggle('narration', !c)

    const resolved = c?.phase === 'resolved'
    // A story scene that ends in talk gets no stamp.
    this.stamp.hidden = !resolved || c?.outcome === 'talked'
    if (resolved && c.outcome) {
      const priced = (c.outcome === 'bought' || c.outcome === 'sold' || c.outcome === 'pawned' || c.outcome === 'redeemed') && c.price !== undefined
      const text = priced ? t('counter.stampPriced', { outcome: t(OUTCOME[c.outcome]), price: rub(c.price!) }) : t(OUTCOME[c.outcome])
      setText(this.stamp, text)
      this.stamp.dataset.outcome = c.outcome
    }

    this.secondary.hidden = !c || c.phase !== 'present'
    if (this.shopButton) this.shopButton.hidden = !!c || walking
    const scene = c?.phase === 'scene' ? c.scene : undefined
    const choosing = !!scene && !scene.chosen && scene.step >= scene.lines.length - 1 && scene.choices.length > 0
    this.renderChoices(choosing ? scene!.choices : [])
    // Between visitors the next person walks in by themselves (the lull); there is nothing to press.
    this.primary.hidden = walking || choosing || (!c && state.queue.length > 0 && !this.manualNext)
    if (scene) {
      this.setPrimary('scene/next', 'scene-next', t('counter.goOn'), undefined)
    } else if (!c) {
      if (state.queue.length > 0) this.setPrimary('counter/next', 'next-customer', t('counter.next'), 'person')
      else this.setPrimary('day/close', 'close-up', t('counter.closeUp'), 'door')
    } else if (c.phase === 'present') {
      this.setPrimary('counter/inspect', 'inspect', t('counter.inspect'), 'loupe')
    } else {
      this.setPrimary('counter/dismiss', 'dismiss', t('counter.done'), undefined)
    }
  }

  /** Story choices as buttons (rebuilt only when the set changes). */
  private renderChoices(choices: { id: string; label: string }[]): void {
    const key = choices.map((c) => c.id).join('|')
    this.choices.hidden = choices.length === 0
    if (key === this.choiceKey) return
    this.choiceKey = key
    this.choices.replaceChildren(
      ...choices.map((ch) =>
        createButton({ id: `choice-${ch.id}`, label: ch.label, className: 'btn-choice', onPress: () => this.dispatch({ type: 'scene/choose', choiceId: ch.id }) }),
      ),
    )
  }

  private setPrimary(action: Primary, id: string, label: string, icon: IconName | undefined): void {
    this.primaryAction = action
    this.primary.dataset.id = id
    setButtonLabel(this.primary, label, icon)
  }
}
