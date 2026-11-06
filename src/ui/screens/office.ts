/**
 * Office sheet (Longlight palette, opened from the ledger while closed): bills
 * coming due, upgrades with costs and owned state, acid restock, cases and
 * security (with how many things sit on open shelves tonight), and the
 * specialists on retainer (retain / release, fees, calls left).
 *
 * Release asks for a second tap (no refund for the month); everything else
 * applies at once. The reducer only accepts these actions while closed.
 */
import { getSpecialist, SPECIALISTS } from '../../data/specialists'
import { tuning } from '../../data/tuning'
import { UPGRADES } from '../../data/upgrades'
import type { Action } from '../../game/actions'
import { monthName, upcomingBills } from '../../game/economy/expenses'
import { callsLeft, retainCost } from '../../game/economy/specialists'
import { canRestockAcid, hasUpgrade, protectedAreas, upgradeStatus } from '../../game/economy/upgrades'
import { addDays, type GameState } from '../../game/state'
import { createButton, el, setText } from '../components/button'
import { rub } from '../format'
import { icons } from '../icons'

export interface OfficeDeps {
  getState(): GameState
  dispatch(a: Action): void
}

const CATEGORY_LABEL: Record<string, string> = { gold: 'gold & jewellery', coins: 'coins', watches: 'watches' }

function due(inDays: number): string {
  if (inDays <= 0) return 'tonight'
  return inDays === 1 ? 'in 1 day' : `in ${inDays} days`
}

export class OfficeSheet {
  readonly root: HTMLElement
  private sheet: HTMLElement
  private cash: HTMLElement
  private bills: HTMLElement
  private billsDue: HTMLElement
  private upgrades: HTMLElement
  private security: HTMLElement
  private exposure: HTMLElement
  private acid: HTMLElement
  private specialists: HTMLElement
  private confirmRelease: string | null = null
  private key = ''

  constructor(private readonly deps: OfficeDeps) {
    const root = el('div', 'overlay office-overlay')
    root.hidden = true
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close()
    })
    const sheet = el('section', 'sheet menu settings office')
    sheet.dataset.id = 'office'
    sheet.setAttribute('role', 'dialog')
    sheet.setAttribute('aria-modal', 'true')
    sheet.setAttribute('aria-label', 'Office')

    const head = el('div', 'sheet-head')
    head.append(
      el('h2', '', 'Office'),
      createButton({ id: 'office-close', label: '', icon: 'close', variant: 'ghost', ariaLabel: 'Close office', onPress: () => this.close() }),
    )
    this.cash = el('p', 'office-cash')
    this.cash.dataset.id = 'office-cash'

    this.bills = el('ul', 'office-list')
    this.bills.dataset.id = 'office-bills'
    const billsSec = this.section('Bills', '')
    this.billsDue = el('p', 'settings-text')
    this.billsDue.dataset.id = 'office-due'
    billsSec.append(this.billsDue, this.bills)

    this.upgrades = el('ul', 'office-list')
    this.upgrades.dataset.id = 'office-upgrades'
    const upSec = this.section('Upgrades', '')
    this.acid = el('div', 'office-acid')
    this.acid.dataset.id = 'office-acid'
    upSec.append(this.upgrades, this.acid)

    this.security = el('ul', 'office-list')
    this.security.dataset.id = 'office-security'
    const secSec = this.section('Cases and security', '')
    this.exposure = el('p', 'settings-text')
    this.exposure.dataset.id = 'office-exposure'
    secSec.append(this.exposure, this.security)

    this.specialists = el('ul', 'office-list')
    this.specialists.dataset.id = 'office-specialists'
    const spSec = this.section('Specialists on retainer', 'A monthly fee buys a few calls; extra calls cost more. Retaining mid-month charges the rest of the month.')
    spSec.append(this.specialists)

    sheet.append(head, this.cash, billsSec, upSec, secSec, spSec)
    root.append(sheet)
    this.root = root
    this.sheet = sheet
  }

  get isOpen(): boolean {
    return !this.root.hidden
  }

  open(): void {
    this.confirmRelease = null
    this.key = ''
    this.render(this.deps.getState())
    this.root.hidden = false
    this.sheet.scrollTop = 0
    this.sheet.querySelector<HTMLButtonElement>('[data-id="office-close"]')?.focus()
  }

  close(): void {
    this.root.hidden = true
  }

  render(state: GameState): void {
    const key = JSON.stringify([state.cash, state.shop.upgrades, state.shop.acidCharges, state.shop.slots, state.specialists, state.calendar.date, this.confirmRelease])
    if (key === this.key) return
    this.key = key
    setText(this.cash, `Cash in the till: ${rub(state.cash)}`)
    this.renderBills(state)
    this.renderUpgrades(state)
    this.renderSpecialists(state)
  }

  private section(title: string, text: string): HTMLElement {
    const s = el('div', 'settings-section')
    s.append(el('h3', '', title))
    if (text) s.append(el('p', 'settings-text', text))
    return s
  }

  private renderBills(state: GameState): void {
    this.bills.replaceChildren()
    const bills = upcomingBills(state)
    // Every M2 bill falls on the same night: the last day of the month.
    const inDays = bills[0]?.inDays ?? 0
    const end = addDays(state.calendar.date, inDays)
    setText(this.billsDue, `Due at closing on ${Number(end.slice(8, 10))} ${monthName(end)}, ${due(inDays)}.`)
    for (const b of bills) {
      const li = el('li', 'office-row office-bill')
      li.append(el('span', 'office-name', b.label), el('span', 'office-amt', rub(b.amount)))
      this.bills.append(li)
    }
    const total = bills.reduce((a, b) => a + b.amount, 0)
    const li = el('li', 'office-row office-bill office-total')
    li.append(el('span', 'office-name', 'Total'), el('span', 'office-amt', rub(total)), el('span', 'office-when', state.cash < total ? 'more than you have' : ''))
    this.bills.append(li)
  }

  private renderUpgrades(state: GameState): void {
    this.upgrades.replaceChildren()
    this.security.replaceChildren()
    const shielded = protectedAreas(state)
    const open = state.shop.slots.filter((sl) => sl.itemId && sl.area !== 'counter' && !shielded.has(sl.area)).length
    setText(
      this.exposure,
      open === 0
        ? 'Nothing on the open shelves tonight. The counter case is behind glass.'
        : `${open} thing${open === 1 ? '' : 's'} on the open shelves tonight, within reach of anyone. The counter case is behind glass.`,
    )
    for (const u of UPGRADES) {
      const status = upgradeStatus(state, u.id)
      const li = el('li', `office-card is-${status}`)
      li.dataset.id = `upgrade-${u.id}`
      const top = el('div', 'office-card-top')
      top.append(el('span', 'office-name', u.name), el('span', 'office-amt', status === 'owned' ? 'owned' : rub(u.cost)))
      li.append(top, el('p', 'office-blurb', u.blurb))
      if (status === 'owned') {
        const tag = el('span', 'office-owned')
        tag.innerHTML = icons.check
        tag.append(el('span', '', 'In the shop'))
        li.append(tag)
      } else {
        const needs = u.requires.filter((r) => !hasUpgrade(state, r)).map((r) => UPGRADES.find((x) => x.id === r)?.name ?? r)
        const label = status === 'locked' ? `Needs ${needs.join(', ')}` : status === 'short' ? 'Not enough cash' : `Buy — ${rub(u.cost)}`
        const b = createButton({ id: `buy-${u.id}`, label, variant: status === 'available' ? 'primary' : 'secondary', onPress: () => this.deps.dispatch({ type: 'upgrade/buy', id: u.id }) })
        b.disabled = status !== 'available'
        li.append(b)
      }
      const list = u.group === 'security' ? this.security : this.upgrades
      list.append(li)
    }

    this.acid.replaceChildren()
    if (hasUpgrade(state, 'acid_kit')) {
      const u = tuning.upgrades
      const full = state.shop.acidCharges >= u.acidMaxCharges
      this.acid.append(el('p', 'settings-text', `Acid kit: ${state.shop.acidCharges} test${state.shop.acidCharges === 1 ? '' : 's'} left${full ? ' (full)' : ''}.`))
      const b = createButton({
        id: 'acid-restock',
        label: `Refill +${u.acidRestockCharges} — ${rub(u.acidRestockCost)}`,
        onPress: () => this.deps.dispatch({ type: 'acid/restock' }),
      })
      b.disabled = !canRestockAcid(state)
      this.acid.append(b)
    }
  }

  private renderSpecialists(state: GameState): void {
    this.specialists.replaceChildren()
    for (const def of SPECIALISTS) {
      const roster = tuning.specialists.roster[def.id]
      if (!roster) continue
      const sp = state.specialists[def.id]
      const retained = !!sp?.retained
      const li = el('li', `office-card${retained ? ' is-owned' : ''}`)
      li.dataset.id = `specialist-${def.id}`
      const top = el('div', 'office-card-top')
      top.append(el('span', 'office-name', def.name), el('span', 'office-amt', `${rub(roster.fee)}/mo`))
      const covers = def.categories.map((c) => CATEGORY_LABEL[c] ?? c).join(', ')
      li.append(top, el('p', 'office-role', `${def.role} · ${covers}`), el('p', 'office-blurb', def.blurb))
      const terms = `${roster.calls} calls a month · extra calls ${rub(roster.perCall)}`
      if (retained) {
        li.append(el('p', 'office-terms', `${terms}. ${callsLeft(state, def.id)} call${callsLeft(state, def.id) === 1 ? '' : 's'} left this month.`))
        li.append(el('p', 'office-quote', getSpecialist(def.id)?.hello ?? ''))
        const confirming = this.confirmRelease === def.id
        const b = createButton({
          id: `release-${def.id}`,
          label: confirming ? 'Tap again to release (no refund)' : 'Release',
          variant: confirming ? 'danger' : 'secondary',
          onPress: () => {
            if (this.confirmRelease === def.id) {
              this.confirmRelease = null
              this.deps.dispatch({ type: 'specialist/release', id: def.id })
            } else {
              this.confirmRelease = def.id
              this.key = ''
              this.render(this.deps.getState())
            }
          },
        })
        li.append(b)
      } else {
        const cost = retainCost(state, def.id)!
        li.append(el('p', 'office-terms', `${terms}. This month: ${rub(cost.fee)} for ${cost.calls} call${cost.calls === 1 ? '' : 's'}.`))
        const b = createButton({
          id: `retain-${def.id}`,
          label: state.cash < cost.fee ? 'Not enough cash' : `Retain — ${rub(cost.fee)}`,
          variant: 'primary',
          onPress: () => this.deps.dispatch({ type: 'specialist/retain', id: def.id }),
        })
        b.disabled = state.cash < cost.fee
        li.append(b)
      }
      this.specialists.append(li)
    }
  }
}
