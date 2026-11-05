/**
 * Counter screen: the dialogue strip (customer name, archetype, line) and the
 * buttons that follow the day loop. Reads state and dispatches actions; never
 * mutates state.
 */
import type { Action } from '../../game/actions'
import type { GameState } from '../../game/state'
import type { VisitOutcome } from '../../game/types'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { archetypeLabel, itemNameOf, rub } from '../format'
import type { IconName } from '../icons'

type Primary = 'counter/next' | 'day/close' | 'counter/inspect' | 'counter/dismiss'

const OUTCOME: Record<VisitOutcome, string> = {
  bought: 'Bought',
  passed: 'Passed',
  walked: 'Walked out',
  left: 'Left',
}

export class CounterScreen {
  readonly root: HTMLElement
  readonly strip: HTMLElement
  private speaker: HTMLElement
  private name: HTMLElement
  private tag: HTMLElement
  private itemName: HTMLElement
  private line: HTMLElement
  private stamp: HTMLElement
  private primary: HTMLButtonElement
  private secondary: HTMLButtonElement
  private primaryAction: Primary = 'counter/next'

  constructor(dispatch: (a: Action) => void, openSettings: () => void, gear: (onPress: () => void) => HTMLButtonElement) {
    const root = el('section', 'screen counter-screen')
    root.dataset.screen = 'counter'
    const strip = el('div', 'strip')
    const dialogue = el('div', 'dialogue')
    dialogue.setAttribute('aria-live', 'polite')
    this.speaker = el('div', 'speaker')
    this.name = el('span', 'speaker-name')
    this.tag = el('span', 'speaker-tag')
    this.speaker.append(this.name, this.tag)
    this.itemName = el('div', 'item-tag')
    this.itemName.dataset.id = 'counter-item'
    this.line = el('p', 'line')
    this.line.dataset.id = 'counter-line'
    this.stamp = el('div', 'outcome-stamp')
    this.stamp.dataset.id = 'outcome'
    dialogue.append(this.speaker, this.itemName, this.line, this.stamp)

    const actions = el('div', 'actions counter-actions')
    this.secondary = createButton({ id: 'pass', label: 'Pass', onPress: () => dispatch({ type: 'counter/pass' }) })
    this.primary = createButton({
      id: 'next-customer',
      label: 'Next customer',
      variant: 'primary',
      onPress: () => dispatch({ type: this.primaryAction }),
    })
    actions.append(gear(openSettings), this.secondary, this.primary)
    strip.append(dialogue, actions)
    root.append(strip)
    this.root = root
    this.strip = strip
  }

  render(state: GameState): void {
    const c = state.current
    this.speaker.hidden = !c
    if (c) {
      setText(this.name, c.customer.name)
      setText(this.tag, archetypeLabel(c.customer.archetype))
      setText(this.itemName, itemNameOf(c.item.defId, 'Something wrapped in a cloth'))
    }
    this.itemName.hidden = !c || c.phase === 'resolved'
    setText(this.line, c ? `“${c.line}”` : state.narration)
    this.line.classList.toggle('narration', !c)

    const resolved = c?.phase === 'resolved'
    this.stamp.hidden = !resolved
    if (resolved && c.outcome) {
      const text = c.outcome === 'bought' && c.price !== undefined ? `${OUTCOME.bought} · ${rub(c.price)}` : OUTCOME[c.outcome]
      setText(this.stamp, text)
      this.stamp.dataset.outcome = c.outcome
    }

    this.secondary.hidden = !c || c.phase !== 'present'
    if (!c) {
      if (state.queue.length > 0) this.setPrimary('counter/next', 'next-customer', 'Next customer', 'person')
      else this.setPrimary('day/close', 'close-up', 'Close up', 'door')
    } else if (c.phase === 'present') {
      this.setPrimary('counter/inspect', 'inspect', 'Inspect', 'loupe')
    } else {
      this.setPrimary('counter/dismiss', 'dismiss', state.queue.length > 0 ? 'Next' : 'Done', undefined)
    }
  }

  private setPrimary(action: Primary, id: string, label: string, icon: IconName | undefined): void {
    this.primaryAction = action
    this.primary.dataset.id = id
    setButtonLabel(this.primary, label, icon)
  }
}
