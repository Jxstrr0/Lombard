/**
 * Ledger (day closed, after at least one day): the day's receipt with a
 * summary, today's log with signed amounts, stock with what you paid and a
 * "Sell to dealer" button per item, then "Open shop — Day N".
 */
import type { Action } from '../../game/actions'
import type { GameState } from '../../game/state'
import type { LedgerEntry } from '../../game/types'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { itemNameOf, longDate, rub, signedRub, WEEKDAYS } from '../format'
import { icons } from '../icons'
import { LedgerLoans } from './ledgerLoans'

export const SHOP_NAME = 'Lombard No. 7'

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  buy: 'BUY',
  sell: 'SALE',
  walkout: 'LEFT',
  pass: 'PASS',
  expense: 'EXP',
  loan: 'LOAN',
  redeem: 'REDEEM',
  forfeit: 'KEPT',
}


export class LedgerScreen {
  readonly root: HTMLElement
  private title: HTMLElement
  private date: HTMLElement
  private summary: HTMLElement
  private log: HTMLElement
  private stock: HTMLElement
  private open: HTMLButtonElement
  private loans = new LedgerLoans()
  private key = ''

  constructor(
    private readonly dispatch: (a: Action) => void,
    openSettings: () => void,
    gear: (onPress: () => void) => HTMLButtonElement,
  ) {
    const root = el('section', 'screen ledger-screen')
    root.dataset.screen = 'ledger'
    const scroll = el('div', 'ledger-scroll')
    const receipt = el('article', 'receipt')
    receipt.dataset.id = 'ledger'
    const head = el('header', 'receipt-head')
    head.append(el('div', 'receipt-shop', SHOP_NAME.toUpperCase()), el('div', 'receipt-cyr', 'ЛОМБАРД № 7 · МОСТОГРАД'))
    this.title = el('div', 'receipt-title')
    this.date = el('div', 'receipt-date')
    head.append(this.title, this.date)
    this.summary = el('dl', 'receipt-summary')
    this.summary.dataset.id = 'ledger-summary'
    this.log = el('ul', 'receipt-log')
    this.log.dataset.id = 'ledger-log'
    this.stock = el('ul', 'receipt-stock')
    this.stock.dataset.id = 'ledger-stock'
    receipt.append(
      head,
      this.summary,
      el('h3', 'receipt-h', 'Today'),
      this.log,
      el('h3', 'receipt-h', 'Pawn loans'),
      this.loans.root,
      el('h3', 'receipt-h', 'In stock'),
      this.stock,
      el('div', 'receipt-foot', 'Thank you · Спасибо'),
    )
    scroll.append(receipt)

    const footer = el('footer', 'ledger-actions actions')
    this.open = createButton({ id: 'open-shop', label: 'Open shop', variant: 'primary', icon: 'door', onPress: () => dispatch({ type: 'day/open' }) })
    footer.append(gear(openSettings), this.open)
    root.append(scroll, footer)
    this.root = root
  }

  render(state: GameState): void {
    setButtonLabel(this.open, `Open shop — Day ${state.calendar.day}`, 'door')
    this.loans.render(state)
    const last = state.history[state.history.length - 1]
    const key = JSON.stringify([state.cash, state.day.log.length, state.inventory.map((i) => i.id), last])
    if (key === this.key) return
    this.key = key
    if (!last) return
    const closedDate = state.calendar.date
    // The calendar has already moved to tomorrow; the receipt is for the day just closed.
    const d = new Date(`${closedDate}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    const iso = d.toISOString().slice(0, 10)
    setText(this.title, `Day ${last.day} · closing ledger`)
    setText(this.date, `${WEEKDAYS[(state.calendar.weekday + 6) % 7]}, ${longDate(iso)}`)

    const rows: [string, string, string?][] = [
      ['Opening cash', rub(last.openingCash)],
      [`Bought (${last.bought})`, last.spent > 0 ? signedRub(-last.spent) : rub(0)],
      [`Sold (${last.sold})`, last.earned > 0 ? signedRub(last.earned) : rub(0)],
      ['Walkouts', String(last.walkouts)],
      ['Closing cash', rub(last.closingCash), 'total'],
    ]
    this.summary.replaceChildren()
    for (const [k, v, cls] of rows) {
      const dt = el('dt', cls ?? '', k)
      const dd = el('dd', cls ?? '', v)
      this.summary.append(dt, dd)
    }

    this.log.replaceChildren()
    if (state.day.log.length === 0) this.log.append(el('li', 'receipt-empty', 'Nothing happened. A quiet day.'))
    for (const e of state.day.log) {
      const li = el('li', `log-${e.kind}`)
      li.append(el('span', 'log-kind', KIND_LABEL[e.kind]), el('span', 'log-text', e.text), el('span', 'log-amt', e.amount === 0 ? '—' : signedRub(e.amount)))
      this.log.append(li)
    }

    this.stock.replaceChildren()
    if (state.inventory.length === 0) this.stock.append(el('li', 'receipt-empty', 'The shelves are bare.'))
    for (const item of state.inventory) {
      const li = el('li', 'stock-row')
      li.dataset.id = `stock-${item.id}`
      const info = el('div', 'stock-info')
      info.append(el('span', 'stock-name', itemNameOf(item.defId)))
      const paid = state.paid[item.id]
      info.append(el('span', 'stock-paid', paid !== undefined ? `paid ${rub(paid)}` : 'from the old stock'))
      const sell = createButton({ id: `sell-${item.id}`, label: 'Sell to dealer', className: 'btn-sell', onPress: () => this.dispatch({ type: 'ledger/sell', itemId: item.id }) })
      sell.insertAdjacentHTML('afterbegin', icons.coins)
      li.append(info, sell)
      this.stock.append(li)
    }
  }
}
