/**
 * Ledger (day closed, after at least one day): the day's receipt with a
 * summary, today's log with signed amounts, the word on the street (reputation
 * by group as vague lines, never numbers), stock with what you paid and a
 * "Sell to dealer" button per item, then "Open shop — Day N".
 *
 * M5: while the landlord's final notice stands, a line under the summary says so. From
 * tuning.endings.retireDay a "Hand back the keys" section closes the receipt: Retire asks
 * for confirmation (a Longlight sheet), then dispatches career/retire.
 */
import { t, type PlainKey } from '../../data/strings'
import type { Action } from '../../game/actions'
import { canRetire, daysRun } from '../../game/endings/end'
import { hasNotice } from '../../game/endings/eviction'
import { LANDLORD } from '../../data/endings/landlord'
import { standingLines } from '../../game/reputation'
import { heatWords } from '../../data/police'
import { tuning } from '../../data/tuning'
import type { GameState } from '../../game/state'
import type { LedgerEntry } from '../../game/types'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { count, fullDate, itemNameOf, rub, signedRub } from '../format'
import { icons } from '../icons'
import { LedgerLoans } from './ledgerLoans'

const KIND_LABEL: Record<LedgerEntry['kind'], PlainKey> = {
  buy: 'ledger.kind.buy',
  sell: 'ledger.kind.sell',
  walkout: 'ledger.kind.walkout',
  pass: 'ledger.kind.pass',
  expense: 'ledger.kind.expense',
  loan: 'ledger.kind.loan',
  redeem: 'ledger.kind.redeem',
  forfeit: 'ledger.kind.forfeit',
  story: 'ledger.kind.story',
  theft: 'ledger.kind.theft',
  deterred: 'ledger.kind.deterred',
  staff: 'ledger.kind.staff',
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
  private notice: HTMLElement
  private retire: HTMLElement
  private retireText: HTMLElement
  private confirmRoot: HTMLElement
  private confirmText: HTMLElement
  private loans = new LedgerLoans()
  private key = ''
  private shopNameText = ''

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
    head.append(this.shopName, el('div', 'receipt-cyr', t('common.cyrCity')))
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
    this.notice = el('p', 'receipt-notice', LANDLORD.standing)
    this.notice.dataset.id = 'ledger-notice'
    this.notice.hidden = true
    // M5: retiring, from tuning.endings.retireDay.
    this.retire = el('section', 'receipt-retire')
    this.retire.dataset.id = 'ledger-retire'
    this.retire.hidden = true
    this.retireText = el('p', 'receipt-retire-text')
    this.retire.append(
      el('h3', 'receipt-h', t('ledger.hand')),
      this.retireText,
      createButton({ id: 'retire', label: t('common.retire'), className: 'btn-sell btn-retire', onPress: () => this.openConfirm() }),
    )
    this.police = el('ul', 'receipt-police')
    this.police.dataset.id = 'ledger-police'
    receipt.append(
      head,
      this.summary,
      this.notice,
      el('h3', 'receipt-h', t('ledger.today')),
      this.log,
      el('h3', 'receipt-h', t('ledger.street')),
      this.standing,
      el('h3', 'receipt-h', t('ledger.police')),
      this.police,
      el('h3', 'receipt-h', t('ledger.loans')),
      this.loans.root,
      el('h3', 'receipt-h', t('ledger.stock')),
      this.stock,
      this.retire,
      el('div', 'receipt-foot', t('ledger.foot')),
    )
    scroll.append(receipt)

    // Retire confirmation: a menu sheet (Longlight palette), because it ends the career.
    this.confirmRoot = el('div', 'overlay retire-overlay')
    this.confirmRoot.hidden = true
    this.confirmRoot.addEventListener('click', (e) => {
      if (e.target === this.confirmRoot) this.closeConfirm()
    })
    const sheet = el('section', 'sheet menu settings retire-sheet')
    sheet.dataset.id = 'retire-sheet'
    sheet.setAttribute('role', 'dialog')
    sheet.setAttribute('aria-modal', 'true')
    sheet.setAttribute('aria-label', t('common.retire'))
    const sec = el('div', 'settings-section')
    this.confirmText = el('p', 'settings-text')
    const acts = el('div', 'actions')
    acts.append(
      createButton({ id: 'retire-cancel', label: t('ledger.notYet'), onPress: () => this.closeConfirm() }),
      createButton({
        id: 'retire-confirm',
        label: t('common.retire'),
        variant: 'danger',
        onPress: () => {
          this.closeConfirm()
          dispatch({ type: 'career/retire' })
        },
      }),
    )
    sec.append(el('h2', 'retire-h', t('ledger.retireQ')), this.confirmText, acts)
    sheet.append(sec)
    this.confirmRoot.append(sheet)

    const footer = el('footer', 'ledger-actions actions')
    this.open = createButton({ id: 'open-shop', label: t('common.openShop'), variant: 'primary', icon: 'door', onPress: () => dispatch({ type: 'day/open' }) })
    footer.append(gear(openSettings))
    if (shopButton) footer.append(shopButton)
    if (openOffice) footer.append(createButton({ id: 'open-office', label: t('ledger.office'), icon: 'briefcase', className: 'btn-office', onPress: openOffice }))
    footer.append(this.open)
    root.append(scroll, footer, this.confirmRoot)
    this.root = root
  }

  get confirmOpen(): boolean {
    return !this.confirmRoot.hidden
  }

  private openConfirm(): void {
    this.confirmText.textContent = t('ledger.retireConfirm', { shop: this.shopNameText })
    this.confirmRoot.hidden = false
    this.confirmRoot.querySelector<HTMLButtonElement>('[data-id="retire-cancel"]')?.focus()
  }

  closeConfirm(): void {
    this.confirmRoot.hidden = true
  }

  render(state: GameState): void {
    setButtonLabel(this.open, t('ledger.openDay', { day: state.calendar.day }), 'door')
    this.loans.render(state)
    setText(this.shopName, state.shop.name.toUpperCase())
    this.shopNameText = state.shop.name
    this.notice.hidden = !hasNotice(state)
    const retire = canRetire(state)
    this.retire.hidden = !retire
    if (retire) setText(this.retireText, t('ledger.retireText', { days: daysRun(state) }))
    else this.closeConfirm()
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
    setText(this.title, t('ledger.title', { day: last.day }))
    setText(this.date, fullDate(iso))

    const rows: [string, string, string?][] = [
      [t('ledger.opening'), rub(last.openingCash)],
      [t('ledger.bought', { n: last.bought }), last.spent > 0 ? signedRub(-last.spent) : rub(0)],
      [t('ledger.sold', { n: last.sold }), last.earned > 0 ? signedRub(last.earned) : rub(0)],
      [t('ledger.walkouts'), count(last.walkouts)],
      ...(last.stolen ? [[t('ledger.stolen'), count(last.stolen)] as [string, string]] : []),
      ...(last.loaned > 0 ? [[t('ledger.lentPawns'), signedRub(-last.loaned)] as [string, string]] : []),
      ...(last.redeemed > 0 ? [[t('ledger.repaid'), signedRub(last.redeemed)] as [string, string]] : []),
      ...(last.expenses > 0 ? [[t('ledger.expenses'), signedRub(-last.expenses)] as [string, string]] : []),
      [t('ledger.closing'), rub(last.closingCash), 'total'],
    ]
    this.summary.replaceChildren()
    for (const [k, v, cls] of rows) {
      const dt = el('dt', cls ?? '', k)
      const dd = el('dd', cls ?? '', v)
      this.summary.append(dt, dd)
    }

    this.log.replaceChildren()
    if (state.day.log.length === 0) this.log.append(el('li', 'receipt-empty', t('ledger.quiet')))
    for (const e of state.day.log) {
      const li = el('li', `log-${e.kind}`)
      li.append(el('span', 'log-kind', t(KIND_LABEL[e.kind])), el('span', 'log-text', e.text), el('span', 'log-amt', e.amount === 0 ? t('common.dash') : signedRub(e.amount)))
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
    if (lines.length === 0) this.police.append(el('li', 'receipt-empty', t('ledger.nothingPosted')))
    for (const b of lines) {
      const li = el('li', 'police-line')
      li.dataset.id = `ledger-bulletin-${b.id}`
      li.append(el('span', 'police-day', t('common.dayN', { day: b.day })), el('span', 'police-text', b.text))
      this.police.append(li)
    }

    this.stock.replaceChildren()
    if (state.inventory.length === 0) this.stock.append(el('li', 'receipt-empty', t('ledger.bare')))
    for (const item of state.inventory) {
      const li = el('li', 'stock-row')
      li.dataset.id = `stock-${item.id}`
      const info = el('div', 'stock-info')
      info.append(el('span', 'stock-name', itemNameOf(item.defId)))
      const paid = state.paid[item.id]
      info.append(el('span', 'stock-paid', paid !== undefined ? t('ledger.paid', { amount: rub(paid) }) : t('ledger.oldStock')))
      const sell = createButton({ id: `sell-${item.id}`, label: t('ledger.sellDealer'), className: 'btn-sell', onPress: () => this.dispatch({ type: 'ledger/sell', itemId: item.id }) })
      sell.insertAdjacentHTML('afterbegin', icons.coins)
      li.append(info, sell)
      this.stock.append(li)
    }
  }
}
