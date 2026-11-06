/**
 * Ledger (day closed, after at least one day): the day's receipt with a
 * summary, today's log with signed amounts, the word on the street (reputation
 * by group as vague lines, never numbers), stock with what you paid and a
 * "Sell to dealer" button per item, then "Open shop — Day N".
 */
import type { Action } from '../../game/actions'
import { standingLines } from '../../game/reputation'
import { heatWords } from '../../data/police'
import { tuning } from '../../data/tuning'
import type { GameState } from '../../game/state'
import type { LedgerEntry } from '../../game/types'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { itemNameOf, longDate, rub, signedRub, WEEKDAYS } from '../format'
import { icons } from '../icons'
import { LedgerLoans } from './ledgerLoans'

/** @deprecated The shop's name is state.shop.name (chosen at career start); kept for imports that predate it. */
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
  story: 'NOTE',
  theft: 'GONE',
  deterred: 'SEEN',
}


export class LedgerScreen {
  readonly root: HTMLElement
  private shopName: HTMLElement
  private title: HTMLElement
  private date: HTMLElement
  private summary: HTMLElement
  private log: HTMLElement
  private standing: HTMLElement
  private stock: HTMLElement
  /** M5: the word on heat and the bulletin lines still in force (crime/bulletin.ts). */
  private police: HTMLElement
  private open: HTMLButtonElement
  private loans = new LedgerLoans()
  private key = ''

  constructor(
    private readonly dispatch: (a: Action) => void,
    openSettings: () => void,
    gear: (onPress: () => void) => HTMLButtonElement,
    openOffice?: () => void,
    /** Opens the shop sheet (display and tags). */
    shopButton?: HTMLButtonElement,
  ) {
    const root = el('section', 'screen ledger-screen')
    root.dataset.screen = 'ledger'
    const scroll = el('div', 'ledger-scroll')
    const receipt = el('article', 'receipt')
    receipt.dataset.id = 'ledger'
    const head = el('header', 'receipt-head')
    this.shopName = el('div', 'receipt-shop')
    head.append(this.shopName, el('div', 'receipt-cyr', 'ЛОМБАРД · МОСТОГРАД'))
    this.title = el('div', 'receipt-title')
    this.date = el('div', 'receipt-date')
    head.append(this.title, this.date)
    this.summary = el('dl', 'receipt-summary')
    this.summary.dataset.id = 'ledger-summary'
    this.log = el('ul', 'receipt-log')
    this.log.dataset.id = 'ledger-log'
    this.standing = el('ul', 'receipt-standing')
    this.standing.dataset.id = 'ledger-standing'
    this.stock = el('ul', 'receipt-stock')
    this.stock.dataset.id = 'ledger-stock'
    this.police = el('ul', 'receipt-police')
    this.police.dataset.id = 'ledger-police'
    receipt.append(
      head,
      this.summary,
      el('h3', 'receipt-h', 'Today'),
      this.log,
      el('h3', 'receipt-h', 'Word on the street'),
      this.standing,
      el('h3', 'receipt-h', 'Police'),
      this.police,
      el('h3', 'receipt-h', 'Pawn loans'),
      this.loans.root,
      el('h3', 'receipt-h', 'In stock'),
      this.stock,
      el('div', 'receipt-foot', 'Thank you · Спасибо'),
    )
    scroll.append(receipt)

    const footer = el('footer', 'ledger-actions actions')
    this.open = createButton({ id: 'open-shop', label: 'Open shop', variant: 'primary', icon: 'door', onPress: () => dispatch({ type: 'day/open' }) })
    footer.append(gear(openSettings))
    if (shopButton) footer.append(shopButton)
    if (openOffice) footer.append(createButton({ id: 'open-office', label: 'Office', icon: 'briefcase', className: 'btn-office', onPress: openOffice }))
    footer.append(this.open)
    root.append(scroll, footer)
    this.root = root
  }

  render(state: GameState): void {
    setButtonLabel(this.open, `Open shop — Day ${state.calendar.day}`, 'door')
    this.loans.render(state)
    setText(this.shopName, state.shop.name.toUpperCase())
    const last = state.history[state.history.length - 1]
    const key = JSON.stringify([state.cash, state.day.log.length, state.inventory.map((i) => i.id), last, state.reputation.byGroup, state.crime.heat, state.crime.bulletin.map((b) => b.id)])
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
      ...(last.stolen ? [['Stolen', String(last.stolen)] as [string, string]] : []),
      ...(last.loaned > 0 ? [['Lent on pawns', signedRub(-last.loaned)] as [string, string]] : []),
      ...(last.redeemed > 0 ? [['Repaid', signedRub(last.redeemed)] as [string, string]] : []),
      ...(last.expenses > 0 ? [['Expenses', signedRub(-last.expenses)] as [string, string]] : []),
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

    this.standing.replaceChildren()
    for (const line of standingLines(state)) {
      const li = el('li', `standing-${line.group}`, line.text)
      li.dataset.id = `standing-${line.group}`
      this.standing.append(li)
    }

    this.police.replaceChildren()
    const band = tuning.police.heatBands.reduce((at, min, i) => (state.crime.heat >= min ? i : at), 0)
    const word = el('li', 'police-word', heatWords[Math.min(band, heatWords.length - 1)]!)
    word.dataset.id = 'ledger-heat'
    this.police.append(word)
    const lines = state.crime.bulletin.slice().sort((a, b) => b.day - a.day)
    if (lines.length === 0) this.police.append(el('li', 'receipt-empty', 'Nothing posted lately.'))
    for (const b of lines) {
      const li = el('li', 'police-line')
      li.dataset.id = `ledger-bulletin-${b.id}`
      li.append(el('span', 'police-day', `Day ${b.day}`), el('span', 'police-text', b.text))
      this.police.append(li)
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
