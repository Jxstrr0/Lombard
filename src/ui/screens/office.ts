/**
 * Office sheet (Longlight palette, opened from the ledger while closed): bills
 * coming due, upgrades with costs and owned state, acid restock, cases and
 * security (with how many things sit on open shelves tonight), and the
 * specialists on retainer (retain / release, fees, calls left).
 *
 * M6 Staff: the second counter (an upgrade) and the appraiser: hire him, choose which
 * walk-ins he takes (the overflow, or only some categories), see his record, let him go.
 *
 * Release and letting him go ask for a second tap; everything else applies at once. The reducer only accepts these actions while closed.
 */
import { APPRAISER, APPRAISER_TEXT } from '../../data/appraiser'
import { SPAWN_DEFS } from '../../data/items'
import { getSpecialist, SPECIALISTS } from '../../data/specialists'
import { tuning } from '../../data/tuning'
import { UPGRADES } from '../../data/upgrades'
import type { Action } from '../../game/actions'
import { monthName, upcomingBills } from '../../game/economy/expenses'
import { callsLeft, monthlyCalls, retainCost } from '../../game/economy/specialists'
import { canRestockAcid, hasUpgrade, protectedAreas, upgradeStatus } from '../../game/economy/upgrades'
import { accuracyOf, hireStatus, wagesDue } from '../../game/staff/appraiser'
import { addDays, type GameState } from '../../game/state'
import { createButton, el, setText } from '../components/button'
import { rub } from '../format'
import { icons } from '../icons'

export interface OfficeDeps {
  getState(): GameState
  dispatch(a: Action): void
}

const CATEGORY_LABEL: Record<string, string> = {
  gold: 'gold & jewellery',
  coins: 'coins',
  watches: 'watches',
  militaria: 'medals & militaria',
  icons: 'icons',
  antiques: 'antiques & porcelain',
  instruments: 'instruments',
  phones: 'phones',
  cameras: 'cameras',
  electronics: 'electronics',
  media: 'records & media',
}

/** Categories some item def belongs to (a specialist whose line never walks in yet says so). */
const STOCKED = new Set<string>(SPAWN_DEFS.map((d) => d.category))

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
  private staff: HTMLElement
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

    this.staff = el('ul', 'office-list')
    this.staff.dataset.id = 'office-staff'
    const staffSec = this.section('Staff', 'A second pair of hands for the line you can’t get to. His deals land in your books, and so do his mistakes.')
    staffSec.append(this.staff)

    sheet.append(head, this.cash, billsSec, upSec, secSec, staffSec, spSec)
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
    const key = JSON.stringify([state.cash, state.shop.upgrades, state.shop.acidCharges, state.shop.slots, state.specialists, state.calendar.date, state.staff, this.confirmRelease])
    if (key === this.key) return
    this.key = key
    setText(this.cash, `Cash in the till: ${rub(state.cash)}`)
    this.renderBills(state)
    this.renderUpgrades(state)
    this.renderSpecialists(state)
    this.renderStaff(state)
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
    this.staff.replaceChildren()
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
        const label = status === 'locked' ? (needs.length ? `Needs ${needs.join(', ')}` : `From day ${u.fromDay ?? ''}`) : status === 'short' ? 'Not enough cash' : `Buy — ${rub(u.cost)}`
        const b = createButton({ id: `buy-${u.id}`, label, variant: status === 'available' ? 'primary' : 'secondary', onPress: () => this.deps.dispatch({ type: 'upgrade/buy', id: u.id }) })
        b.disabled = status !== 'available'
        li.append(b)
      }
      const list = u.group === 'security' ? this.security : u.group === 'staff' ? this.staff : this.upgrades
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

  /** The appraiser's card (after the second counter's, which renderUpgrades puts in the same list). */
  private renderStaff(state: GameState): void {
    const status = hireStatus(state)
    const st = state.staff
    const A = tuning.appraiser
    const li = el('li', `office-card${status === 'hired' ? ' is-owned' : ''}`)
    li.dataset.id = 'staff-appraiser'
    const top = el('div', 'office-card-top')
    top.append(el('span', 'office-name', APPRAISER.name), el('span', 'office-amt', `${rub(A.salary)}/mo`))
    li.append(top, el('p', 'office-role', `Appraiser · eye ${Math.round(accuracyOf(state) * 100)}%`))
    if (status === 'gone') {
      li.append(el('p', 'office-quiet', st.gone === 'fired' ? APPRAISER_TEXT.fired : APPRAISER_TEXT.gone))
      this.staff.append(li)
      return
    }
    if (status !== 'hired') {
      li.append(el('p', 'office-blurb', APPRAISER_TEXT.pitch))
      li.append(el('p', 'office-terms', `Paid at month end with the rent, from the day he starts. He never spends the till below ${rub(A.cashFloor)}.`))
      const b = createButton({
        id: 'staff-hire',
        label: status === 'noCounter' ? 'Needs a second counter' : 'Hire — starts tomorrow',
        variant: 'primary',
        onPress: () => this.deps.dispatch({ type: 'staff/hire' }),
      })
      b.disabled = status !== 'available'
      li.append(b)
      this.staff.append(li)
      return
    }
    li.append(el('p', 'office-quote', APPRAISER_TEXT.hello))
    const r = st.record
    li.append(
      el(
        'p',
        'office-terms',
        `Served ${r.served} · bought ${r.bought} · lent on ${r.lent} · spent ${rub(r.spent)}${r.fakes ? ` · ${r.fakes} fake${r.fakes === 1 ? '' : 's'}` : ''}${r.insults ? ` · ${r.insults} insulted` : ''}. Owed so far this month: ${rub(wagesDue(state))}.`,
      ),
    )
    // Which walk-ins he takes.
    li.append(el('div', 'settings-label', 'He takes'))
    const rule = el('div', 'segmented office-rule')
    rule.setAttribute('role', 'radiogroup')
    rule.setAttribute('aria-label', 'Which walk-ins he takes')
    const modes = [
      { mode: 'next' as const, label: 'The overflow' },
      { mode: 'categories' as const, label: 'Only these' },
    ]
    for (const m of modes) {
      const b = el('button', `segment${st.mode === m.mode ? ' is-selected' : ''}`, m.label)
      b.type = 'button'
      b.dataset.id = `staff-mode-${m.mode}`
      b.setAttribute('role', 'radio')
      b.setAttribute('aria-checked', String(st.mode === m.mode))
      b.addEventListener('click', () => this.deps.dispatch({ type: 'staff/rule', mode: m.mode }))
      rule.append(b)
    }
    li.append(rule)
    li.append(
      el(
        'p',
        'office-quiet',
        st.mode === 'next'
          ? `When ${A.overflowAt} or more are waiting, he takes the next seller after the first in line. Never a regular, a story, a buyer or a pawner coming back.`
          : 'Any seller in line bringing one of these (after the first in line), however short the line.',
      ),
    )
    if (st.mode === 'categories') {
      const cats = el('div', 'office-cats')
      for (const c of [...STOCKED].sort()) {
        const on = st.categories.includes(c)
        const b = el('button', `segment${on ? ' is-selected' : ''}`, CATEGORY_LABEL[c] ?? c)
        b.type = 'button'
        b.dataset.id = `staff-cat-${c}`
        b.setAttribute('aria-pressed', String(on))
        b.addEventListener('click', () => {
          const next = on ? st.categories.filter((x) => x !== c) : [...st.categories, c]
          this.deps.dispatch({ type: 'staff/rule', mode: 'categories', categories: next })
        })
        cats.append(b)
      }
      li.append(cats)
    }
    const confirming = this.confirmRelease === 'staff'
    const fire = createButton({
      id: 'staff-fire',
      label: confirming ? 'Tap again to let him go (for good)' : 'Let him go',
      variant: confirming ? 'danger' : 'secondary',
      onPress: () => {
        if (this.confirmRelease === 'staff') {
          this.confirmRelease = null
          this.deps.dispatch({ type: 'staff/fire' })
        } else {
          this.confirmRelease = 'staff'
          this.key = ''
          this.render(this.deps.getState())
        }
      },
    })
    li.append(fire)
    this.staff.append(li)
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
      if (!def.categories.some((c) => STOCKED.has(c))) li.append(el('p', 'office-quiet', 'Nothing in this line has come through the door yet.'))
      const terms = `${monthlyCalls(state, def.id)} calls a month · extra calls ${rub(roster.perCall)}`
      if (sp?.retired) {
        // M4 arcs: gone for good (Faina gave up her bench, Ilya retired).
        li.append(el('p', 'office-quiet', 'Retired. No longer taking calls.'))
      } else if (retained) {
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
