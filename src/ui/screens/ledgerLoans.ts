/**
 * Ledger section: open pawn loans (owner: loans worker). Customer, item,
 * lent, owed today, due day and days left, plus today's lent/repaid totals.
 * Self-contained so the shared ledger screen only mounts it.
 */
import { amountDue, daysLeft, lastRedeemDay } from '../../game/loans/loans'
import { t } from '../../data/strings'
import type { GameState } from '../../game/state'
import { el } from '../components/button'
import { itemNameOf, rub, signedRub } from '../format'
import { dayLabel, daysLabel } from '../loanFormat'
import '../loans.css'

export class LedgerLoans {
  readonly root: HTMLElement
  private key = ''

  constructor() {
    this.root = el('div', 'ledger-loans')
    this.root.dataset.id = 'ledger-loans'
  }

  render(state: GameState): void {
    const last = state.history[state.history.length - 1]
    const key = JSON.stringify([state.calendar.day, state.loans.map((l) => l.id), last?.loaned, last?.redeemed])
    if (key === this.key) return
    this.key = key
    this.root.replaceChildren()

    if (last && (last.loaned > 0 || last.redeemed > 0)) {
      const totals = el('div', 'loan-totals')
      totals.append(
        el('span', '', t('loans.lentTotal', { amount: last.loaned > 0 ? signedRub(-last.loaned) : rub(0) })),
        el('span', '', t('loans.repaidTotal', { amount: last.redeemed > 0 ? signedRub(last.redeemed) : rub(0) })),
      )
      this.root.append(totals)
    }

    const list = el('ul', 'loan-list')
    if (state.loans.length === 0) list.append(el('li', 'receipt-empty', t('loans.none')))
    // The calendar already shows the next working day: "owes" is what they'd pay when you open.
    const today = state.calendar.day
    const sorted = [...state.loans].sort((a, b) => a.dueDay - b.dueDay || a.id.localeCompare(b.id))
    for (const loan of sorted) {
      const left = daysLeft(loan, today)
      const li = el('li', 'loan-row')
      li.dataset.id = `loan-${loan.id}`
      const head = el('div', 'loan-head')
      head.append(el('span', 'loan-who', loan.customer.name), el('span', 'loan-item', itemNameOf(loan.item.defId)))
      const money = el('div', 'loan-money')
      money.append(el('span', '', t('loans.lent', { amount: rub(loan.principal) })), el('span', 'loan-owed', t('loans.owes', { amount: rub(amountDue(loan, today)) })))
      let when: string
      let cls = 'loan-due'
      if (left > 0) when = t('loans.due', { date: dayLabel(state, loan.dueDay), days: daysLabel(left) })
      else if (left === 0) when = t('loans.dueToday', { date: dayLabel(state, loan.dueDay) })
      else {
        const grace = lastRedeemDay(loan) - today
        when = grace > 0 ? t('loans.overdue', { days: daysLabel(grace + 1) }) : t('loans.lastDay')
        cls += ' is-late'
      }
      li.append(head, money, el('div', cls, when))
      list.append(li)
    }
    this.root.append(list)
  }
}
