/**
 * A pawner back to redeem their item (owner: loans worker): who, the item,
 * a pawn ticket with principal + interest = total, and "Take X ₽, hand it
 * over" (loan/return). After that the counter screen shows the Redeemed stamp
 * and their thank-you line.
 */
import { tuning } from '../../data/tuning'
import type { Action } from '../../game/actions'
import { amountDue } from '../../game/loans/loans'
import type { GameState } from '../../game/state'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { archetypeLabel, itemNameOf, rub } from '../format'
import { dayLabel, daysLabel, monthlyRateLabel } from '../loanFormat'
import '../loans.css'

export class RedeemScreen {
  readonly root: HTMLElement
  readonly strip: HTMLElement
  private name: HTMLElement
  private tag: HTMLElement
  private item: HTMLElement
  private line: HTMLElement
  private ticket: HTMLElement
  private give: HTMLButtonElement

  constructor(dispatch: (a: Action) => void) {
    const root = el('section', 'screen counter-screen redeem-screen')
    root.dataset.screen = 'redeem'
    const strip = el('div', 'strip')
    const dialogue = el('div', 'dialogue')
    dialogue.setAttribute('aria-live', 'polite')
    const speaker = el('div', 'speaker')
    this.name = el('span', 'speaker-name')
    this.tag = el('span', 'speaker-tag')
    speaker.append(this.name, this.tag, el('span', 'loan-badge', 'back for a loan'))
    this.item = el('div', 'item-tag')
    this.item.dataset.id = 'redeem-item'
    this.line = el('p', 'line')
    this.line.dataset.id = 'redeem-line'
    this.ticket = el('dl', 'pawn-ticket')
    this.ticket.dataset.id = 'redeem-ticket'
    dialogue.append(speaker, this.item, this.line, this.ticket)
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
    const today = state.calendar.day
    const due = amountDue(loan, today)
    const held = Math.max(0, today - loan.startDay)
    setText(this.name, c.customer.name)
    setText(this.tag, archetypeLabel(c.customer.archetype))
    setText(this.item, itemNameOf(loan.item.defId))
    setText(this.line, `“${c.line}”`)

    const late = today > loan.dueDay
    const rows: [string, string, string][] = [
      [`Lent ${dayLabel(state, loan.startDay)}`, rub(loan.principal), ''],
      [`Interest · ${daysLabel(held)} at ${monthlyRateLabel(loan.monthlyRate)}${held < tuning.loans.minInterestDays ? `, ${tuning.loans.minInterestDays}-day minimum` : ''}`, `+${rub(due - loan.principal)}`, ''],
      [late ? `Total · ${daysLabel(today - loan.dueDay)} late` : 'Total', rub(due), 'total'],
    ]
    this.ticket.replaceChildren()
    for (const [k, v, cls] of rows) this.ticket.append(el('dt', cls, k), el('dd', cls, v))
    setButtonLabel(this.give, `Take ${rub(due)}, hand it over`)
  }
}
