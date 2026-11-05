/**
 * A pawner back to redeem their item (owner: loans worker): what they owe
 * (principal + interest) and "Hand it over" (loan/return).
 *
 * Stub: one line and the button. The loans worker builds the real screen.
 */
import type { Action } from '../../game/actions'
import { amountDue } from '../../game/loans/loans'
import type { GameState } from '../../game/state'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { itemNameOf, rub } from '../format'

export class RedeemScreen {
  readonly root: HTMLElement
  readonly strip: HTMLElement
  private line: HTMLElement
  private give: HTMLButtonElement

  constructor(dispatch: (a: Action) => void) {
    const root = el('section', 'screen counter-screen redeem-screen')
    root.dataset.screen = 'redeem'
    const strip = el('div', 'strip')
    const dialogue = el('div', 'dialogue')
    this.line = el('p', 'line')
    dialogue.append(this.line)
    const actions = el('div', 'actions counter-actions')
    this.give = createButton({ id: 'redeem-return', label: 'Hand it over', variant: 'primary', onPress: () => dispatch({ type: 'loan/return' }) })
    actions.append(this.give)
    strip.append(dialogue, actions)
    root.append(strip)
    this.root = root
    this.strip = strip
  }

  render(state: GameState): void {
    const c = state.current
    const loan = c && state.loans.find((l) => l.id === c.loanId)
    if (!c || !loan) return
    setText(this.line, `${c.customer.name} is back for the ${itemNameOf(loan.item.defId)}.`)
    setButtonLabel(this.give, `Take ${rub(amountDue(loan, state.calendar.day))}, hand it over`)
  }
}
