/**
 * Title screen (M4, Longlight palette): shown at boot, before the shop.
 *
 * Continue (the most recently played slot), three career slots (play, start a
 * new career in an empty one, delete with an inline confirm), Load save code
 * into a chosen slot (overwrite confirm), Settings (device settings only), the
 * GDD §11 backup reminder and a plain link to the Longlight hub. The shop
 * renders dimmed behind it.
 *
 * The screen holds no career state of its own: main passes the slot list in
 * and does the storage work behind the callbacks.
 *
 * M5: a slot whose career has ended shows its ending title; tapping it opens the
 * summary (main loads it; the ending screen takes over). It offers New career
 * (confirm, then the slot is overwritten) as well as Delete. Continue skips it.
 */
import type { PlainKey } from '../../data/strings'
import { t } from '../../data/strings'
import { decodeSaveCode, SaveCodeError } from '../../game/save/code'
import type { SlotNo, SlotView } from '../../game/save/slots'
import { mostRecentSlot } from '../../game/save/slots'
import type { CareerEndKind, GameState } from '../../game/state'
import { backupAgeText, backupReminderDue, lastBackupAt, readBackupFile } from '../../persist/safety'
import { createButton, el, setText } from '../components/button'
import { icons } from '../icons'
import { lastPlayedText, rub } from '../format'

export const HUB_URL = 'https://jxstrr0.github.io/Kelbo.Website/games.html'

export interface TitleDeps {
  play(slot: SlotNo): void
  newCareer(slot: SlotNo): void
  deleteSlot(slot: SlotNo): void
  loadCode(state: GameState, slot: SlotNo): void
  openSettings(): void
}

const END_LABEL: Record<CareerEndKind, PlainKey> = {
  retired: 'title.end.retired',
  evicted: 'title.end.evicted',
  raided: 'title.end.raided',
  pushedOut: 'title.end.pushedOut',
}

function shopLabel(c: NonNullable<SlotView['career']>): string {
  return c.intro ? t('title.newShop') : c.shopName
}

export class TitleScreen {
  readonly root: HTMLElement
  private slots: SlotView[] = []
  private readonly continueBtn: HTMLButtonElement
  private readonly continueSub: HTMLElement
  private readonly reminder: HTMLElement
  private readonly list: HTMLElement
  private readonly busy = new Set<SlotNo>()
  /** Slot whose delete (or, for an ended career, new career) confirm is open. */
  private confirm: { slot: SlotNo; what: 'delete' | 'new' } | null = null
  // load sheet
  private readonly loadRoot: HTMLElement
  private readonly loadSheet: HTMLElement
  private readonly loadInput: HTMLTextAreaElement
  private readonly loadError: HTMLElement
  private readonly fileInput: HTMLInputElement
  private readonly pick: HTMLElement
  private readonly pickText: HTMLElement
  private readonly pickSlots: HTMLElement
  private readonly replace: HTMLElement
  private readonly replaceText: HTMLElement
  private pending: GameState | null = null
  private pendingSlot: SlotNo | null = null

  constructor(private readonly deps: TitleDeps) {
    const root = el('section', 'screen title-screen menu')
    root.dataset.screen = 'title'
    const scroll = el('div', 'title-scroll')
    const inner = el('div', 'title-inner')

    // --- brand
    const brand = el('header', 'title-brand')
    brand.append(
      el('span', 'title-studio', t('title.studio')),
      el('h1', 'title-name', t('title.name')),
      el('span', 'title-cyr', t('common.cyrCity')),
      el('p', 'title-tag', t('title.tag')),
    )

    // --- continue
    const cont = el('button', 'btn btn-primary title-continue')
    cont.type = 'button'
    cont.dataset.id = 'title-continue'
    const contLabel = el('span', 'title-continue-label', t('title.continue'))
    this.continueSub = el('span', 'title-continue-sub')
    cont.append(contLabel, this.continueSub)
    cont.addEventListener('click', () => {
      const s = mostRecentSlot(this.slots, true)
      if (s) this.deps.play(s.slot)
    })
    this.continueBtn = cont

    this.reminder = el('p', 'title-reminder')
    this.reminder.dataset.id = 'title-reminder'
    this.reminder.hidden = true

    // --- careers
    const careers = el('div', 'title-careers')
    careers.append(el('h2', 'title-h', t('title.careers')))
    this.list = el('ul', 'title-slots')
    careers.append(this.list)

    // --- actions
    const actions = el('div', 'actions title-actions')
    actions.append(
      createButton({ id: 'title-load', label: t('settings.loadCode'), icon: 'doc', onPress: () => this.openLoad() }),
      createButton({ id: 'title-settings', label: t('common.settings'), icon: 'gear', onPress: () => this.deps.openSettings() }),
    )

    const foot = el('footer', 'title-foot')
    const hub = el('a', 'title-hub', t('title.hub'))
    hub.href = HUB_URL
    hub.target = '_blank'
    hub.rel = 'noopener'
    hub.dataset.id = 'title-hub'
    foot.append(hub)

    inner.append(brand, cont, this.reminder, careers, actions, foot)
    scroll.append(inner)
    root.append(scroll)

    // --- load save code sheet
    const loadRoot = el('div', 'overlay title-load-overlay')
    loadRoot.hidden = true
    loadRoot.addEventListener('click', (e) => {
      if (e.target === loadRoot) this.closeLoad()
    })
    const sheet = el('section', 'sheet menu settings title-load')
    sheet.dataset.id = 'title-load-sheet'
    sheet.setAttribute('role', 'dialog')
    sheet.setAttribute('aria-modal', 'true')
    sheet.setAttribute('aria-label', t('settings.loadCode'))
    const head = el('div', 'sheet-head')
    head.append(
      el('h2', '', t('settings.loadCode')),
      createButton({ id: 'title-load-close', label: '', icon: 'close', variant: 'ghost', ariaLabel: t('common.close'), onPress: () => this.closeLoad() }),
    )
    const sec = el('div', 'settings-section')
    sec.append(el('p', 'settings-text', t('title.loadText')))
    this.loadInput = el('textarea', 'code-box')
    this.loadInput.dataset.id = 'title-code-input'
    this.loadInput.rows = 3
    this.loadInput.placeholder = t('settings.codePlaceholder')
    this.loadInput.spellcheck = false
    this.loadInput.autocapitalize = 'off'
    this.loadInput.setAttribute('aria-label', t('settings.codeAria'))
    this.loadError = el('p', 'settings-error')
    this.loadError.setAttribute('role', 'alert')
    this.fileInput = el('input', '')
    this.fileInput.type = 'file'
    this.fileInput.accept = '.txt,text/plain'
    this.fileInput.hidden = true
    this.fileInput.addEventListener('change', () => void this.loadFile())
    const row = el('div', 'actions')
    row.append(
      createButton({ id: 'title-code-read', label: t('common.load'), variant: 'primary', onPress: () => this.readCode(this.loadInput.value) }),
      createButton({ id: 'title-code-file', label: t('common.loadFile'), ariaLabel: t('common.loadFileAria'), icon: 'doc', onPress: () => this.fileInput.click() }),
    )
    sec.append(this.loadInput, this.loadError, row, this.fileInput)

    this.pick = el('div', 'settings-section title-pick')
    this.pick.hidden = true
    this.pickText = el('p', 'settings-text')
    this.pickSlots = el('div', 'title-pick-slots')
    this.replace = el('div', 'confirm')
    this.replace.hidden = true
    this.replaceText = el('p', '')
    const replaceActions = el('div', 'actions')
    replaceActions.append(
      createButton({ id: 'title-code-cancel', label: t('common.cancel'), onPress: () => this.cancelReplace() }),
      createButton({ id: 'title-code-replace', label: t('title.replace'), variant: 'danger', onPress: () => this.confirmReplace() }),
    )
    this.replace.append(this.replaceText, replaceActions)
    this.pick.append(el('h3', '', t('title.loadInto')), this.pickText, this.pickSlots, this.replace)
    sheet.append(head, sec, this.pick)
    loadRoot.append(sheet)
    this.loadRoot = loadRoot
    this.loadSheet = sheet
    root.append(loadRoot)
    this.root = root
  }

  get loadOpen(): boolean {
    return !this.loadRoot.hidden
  }

  /** Show the current slots. `now` is for the backup reminder. */
  render(slots: SlotView[], now = Date.now()): void {
    this.slots = slots
    this.busy.clear()
    const recent = mostRecentSlot(slots, true)
    this.continueBtn.hidden = !recent
    if (recent?.career) setText(this.continueSub, t('title.continueSub', { slot: recent.slot, shop: shopLabel(recent.career), day: recent.career.day }))

    const last = lastBackupAt()
    const due = backupReminderDue(slots.some((s) => s.career?.progress), last, now)
    this.reminder.hidden = !due
    if (due) {
      setText(this.reminder, last === null ? t('title.reminderNever') : t('title.reminderLast', { age: backupAgeText(last, now) }))
    }

    this.list.replaceChildren(...slots.map((s) => this.card(s, now)))
    if (this.loadOpen && this.pending) this.renderPick()
  }

  private card(view: SlotView, now: number): HTMLElement {
    const { slot, career } = view
    const li = el('li', 'slot-card')
    li.dataset.id = `slot-${slot}`
    const main = el('button', 'slot-main')
    main.type = 'button'
    const no = el('span', 'slot-no', t('common.slotN', { slot }))
    if (career?.end) {
      li.classList.add('is-ended')
      main.dataset.id = `slot-ending-${slot}`
      main.setAttribute('aria-label', t('title.endedAria', { slot, shop: shopLabel(career), title: career.end.title }))
      main.append(
        no,
        el('span', 'slot-shop', shopLabel(career)),
        el('span', 'slot-title', career.end.title),
        el('span', 'slot-when', t('title.ended', { count: career.end.daysRun, how: t(END_LABEL[career.end.kind]) })),
      )
      main.addEventListener('click', () => this.once(slot, () => this.deps.play(slot)))
    } else if (career) {
      main.dataset.id = `slot-play-${slot}`
      main.setAttribute('aria-label', t('title.playAria', { slot, shop: shopLabel(career), day: career.day }))
      main.append(
        no,
        el('span', 'slot-shop', shopLabel(career)),
        el('span', 'slot-stats', t('title.stats', { day: career.day, cash: rub(career.cash) })),
        el('span', 'slot-when', t('title.lastPlayed', { when: lastPlayedText(career.savedAt, now) })),
      )
      main.addEventListener('click', () => this.once(slot, () => this.deps.play(slot)))
    } else if (view.damaged) {
      li.classList.add('is-damaged')
      main.disabled = true
      main.append(no, el('span', 'slot-shop', t('title.unreadable')), el('span', 'slot-when', t('title.unreadableHint')))
    } else {
      li.classList.add('is-empty')
      main.dataset.id = `slot-new-${slot}`
      main.setAttribute('aria-label', t('title.emptyAria', { slot }))
      const plus = el('span', 'slot-plus')
      plus.innerHTML = icons.plus
      main.append(no, el('span', 'slot-shop', t('title.empty')), plus)
      main.addEventListener('click', () => this.once(slot, () => this.deps.newCareer(slot)))
    }
    li.append(main)
    const redraw = () => this.list.replaceChildren(...this.slots.map((s) => this.card(s, now)))
    const ask = (what: 'delete' | 'new') => {
      this.confirm = { slot, what }
      redraw()
      this.list.querySelector<HTMLButtonElement>(`[data-id="slot-confirm-cancel-${slot}"]`)?.focus()
    }
    if (career || view.damaged) {
      const side = el('div', 'slot-side')
      if (career?.end) {
        side.append(
          createButton({ id: `slot-renew-${slot}`, label: t('title.newCareer'), variant: 'ghost', className: 'slot-delete slot-renew', ariaLabel: t('title.renewAria', { slot }), onPress: () => ask('new') }),
        )
      }
      side.append(
        createButton({ id: `slot-delete-${slot}`, label: t('common.delete'), variant: 'ghost', className: 'slot-delete', ariaLabel: t('title.deleteAria', { slot }), onPress: () => ask('delete') }),
      )
      li.append(side)
      if (this.confirm?.slot === slot) {
        const what = this.confirm.what
        const confirm = el('div', 'confirm slot-confirm')
        const text = !career
          ? t('title.deleteUnreadable')
          : what === 'new'
            ? t('title.renewConfirm', { slot, shop: shopLabel(career) })
            : career.end
              ? t('title.deleteEnded', { shop: shopLabel(career), title: career.end.title })
              : t('title.deleteCareer', { shop: shopLabel(career), day: career.day, cash: rub(career.cash) })
        confirm.append(el('p', '', text))
        const acts = el('div', 'actions')
        acts.append(
          createButton({
            id: `slot-confirm-cancel-${slot}`,
            label: t('common.cancel'),
            onPress: () => {
              this.confirm = null
              redraw()
            },
          }),
          createButton({
            id: what === 'new' ? `slot-renew-confirm-${slot}` : `slot-delete-confirm-${slot}`,
            label: t(what === 'new' ? 'title.newCareer' : 'common.delete'),
            variant: 'danger',
            onPress: () => {
              this.confirm = null
              this.once(slot, () => (what === 'new' ? this.deps.newCareer(slot) : this.deps.deleteSlot(slot)))
            },
          }),
        )
        confirm.append(acts)
        li.append(confirm)
      }
    }
    return li
  }

  /** One storage action per slot at a time (a double tap must not start two careers). */
  private once(slot: SlotNo, fn: () => void): void {
    if (this.busy.has(slot)) return
    this.busy.add(slot)
    fn()
  }

  // --- load save code ---------------------------------------------------------

  private openLoad(): void {
    this.loadInput.value = ''
    this.loadError.textContent = ''
    this.pending = null
    this.pendingSlot = null
    this.pick.hidden = true
    this.replace.hidden = true
    this.loadRoot.hidden = false
    this.loadSheet.scrollTop = 0
    this.loadInput.focus()
  }

  closeLoad(): void {
    this.loadRoot.hidden = true
    this.pending = null
    this.pendingSlot = null
  }

  private async loadFile(): Promise<void> {
    const file = this.fileInput.files?.[0]
    this.fileInput.value = ''
    if (!file) return
    try {
      this.readCode(await readBackupFile(file), t('settings.fileEmpty'))
    } catch (err) {
      this.pending = null
      this.pick.hidden = true
      this.loadError.textContent = (err as Error).message || t('settings.fileUnreadable')
    }
  }

  private readCode(input: string, emptyMessage = t('settings.pasteFirst')): void {
    const code = input.trim()
    this.loadError.textContent = ''
    this.pick.hidden = true
    this.pending = null
    if (!code) {
      this.loadError.textContent = emptyMessage
      return
    }
    try {
      this.pending = decodeSaveCode(code)
    } catch (err) {
      this.loadError.textContent = err instanceof SaveCodeError ? err.message : t('settings.codeBad')
      return
    }
    this.pendingSlot = null
    this.renderPick()
    this.pick.hidden = false
    this.pick.scrollIntoView({ block: 'nearest' })
  }

  private renderPick(): void {
    const s = this.pending
    if (!s) return
    setText(
      this.pickText,
      t('title.pick', { shop: s.meta.intro ? t('title.aNewShop') : s.shop.name, day: s.calendar.day, cash: rub(s.cash), count: s.inventory.length }),
    )
    this.pickSlots.replaceChildren(
      ...this.slots.map((v) => {
        const b = el('button', 'segment title-pick-slot')
        b.type = 'button'
        b.dataset.id = `title-code-slot-${v.slot}`
        b.classList.toggle('is-selected', this.pendingSlot === v.slot)
        b.append(
          el('span', 'title-pick-no', t('common.slotN', { slot: v.slot })),
          el('span', 'title-pick-what', v.career ? t('title.pickCareer', { shop: shopLabel(v.career), day: v.career.day }) : t(v.damaged ? 'title.pickUnreadable' : 'title.pickEmpty')),
        )
        b.addEventListener('click', () => this.choose(v))
        return b
      }),
    )
  }

  private choose(v: SlotView): void {
    if (!this.pending) return
    if (!v.career && !v.damaged) {
      this.finishLoad(v.slot)
      return
    }
    this.pendingSlot = v.slot
    this.renderPick()
    this.replaceText.textContent = v.career
      ? t('title.replaceCareer', { shop: shopLabel(v.career), day: v.career.day, cash: rub(v.career.cash), slot: v.slot })
      : t('title.replaceUnreadable', { slot: v.slot })
    this.replace.hidden = false
    this.replace.querySelector<HTMLButtonElement>('[data-id="title-code-cancel"]')?.focus()
  }

  private cancelReplace(): void {
    this.pendingSlot = null
    this.replace.hidden = true
    this.renderPick()
  }

  private confirmReplace(): void {
    if (this.pendingSlot) this.finishLoad(this.pendingSlot)
  }

  private finishLoad(slot: SlotNo): void {
    const s = this.pending
    if (!s) return
    this.closeLoad()
    this.deps.loadCode(s, slot)
  }
}
