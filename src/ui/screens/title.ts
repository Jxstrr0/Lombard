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
import { decodeSaveCode, SaveCodeError } from '../../game/save/code'
import type { SlotNo, SlotView } from '../../game/save/slots'
import { mostRecentSlot } from '../../game/save/slots'
import type { CareerEndKind, GameState } from '../../game/state'
import { backupAgeText, backupReminderDue, lastBackupAt, readBackupFile } from '../../persist/safety'
import { createButton, el, setText } from '../components/button'
import { icons } from '../icons'
import { rub } from '../format'

export const HUB_URL = 'https://jxstrr0.github.io/Kelbo.Website/games.html'

export interface TitleDeps {
  play(slot: SlotNo): void
  newCareer(slot: SlotNo): void
  deleteSlot(slot: SlotNo): void
  loadCode(state: GameState, slot: SlotNo): void
  openSettings(): void
}

/** "Today, 14:05", "Yesterday, 09:12" or "3 Nov 2026". */
export function lastPlayedText(savedAt: number, now = Date.now()): string {
  const d = new Date(savedAt)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const day = (t: number) => new Date(t).toDateString()
  if (day(savedAt) === day(now)) return `Today, ${time}`
  if (day(savedAt) === day(now - 86_400_000)) return `Yesterday, ${time}`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const END_LABEL: Record<CareerEndKind, string> = { retired: 'retired', evicted: 'evicted', raided: 'shut down', pushedOut: 'pushed out' }

function shopLabel(c: NonNullable<SlotView['career']>): string {
  return c.intro ? 'New shop (not named yet)' : c.shopName
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
      el('span', 'title-studio', 'Longlight Interactive'),
      el('h1', 'title-name', 'Lombard'),
      el('span', 'title-cyr', 'ЛОМБАРД · МОСТОГРАД'),
      el('p', 'title-tag', 'A pawn shop on the canals of Mostograd.'),
    )

    // --- continue
    const cont = el('button', 'btn btn-primary title-continue')
    cont.type = 'button'
    cont.dataset.id = 'title-continue'
    const contLabel = el('span', 'title-continue-label', 'Continue')
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
    careers.append(el('h2', 'title-h', 'Careers'))
    this.list = el('ul', 'title-slots')
    careers.append(this.list)

    // --- actions
    const actions = el('div', 'actions title-actions')
    actions.append(
      createButton({ id: 'title-load', label: 'Load save code', icon: 'doc', onPress: () => this.openLoad() }),
      createButton({ id: 'title-settings', label: 'Settings', icon: 'gear', onPress: () => this.deps.openSettings() }),
    )

    const foot = el('footer', 'title-foot')
    const hub = el('a', 'title-hub', 'More from Longlight')
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
    sheet.setAttribute('aria-label', 'Load save code')
    const head = el('div', 'sheet-head')
    head.append(
      el('h2', '', 'Load save code'),
      createButton({ id: 'title-load-close', label: '', icon: 'close', variant: 'ghost', ariaLabel: 'Close', onPress: () => this.closeLoad() }),
    )
    const sec = el('div', 'settings-section')
    sec.append(el('p', 'settings-text', 'Paste a save code from another device (or choose a backup file), then pick a slot for it.'))
    this.loadInput = el('textarea', 'code-box')
    this.loadInput.dataset.id = 'title-code-input'
    this.loadInput.rows = 3
    this.loadInput.placeholder = 'LMB1.…'
    this.loadInput.spellcheck = false
    this.loadInput.autocapitalize = 'off'
    this.loadInput.setAttribute('aria-label', 'Save code to load')
    this.loadError = el('p', 'settings-error')
    this.loadError.setAttribute('role', 'alert')
    this.fileInput = el('input', '')
    this.fileInput.type = 'file'
    this.fileInput.accept = '.txt,text/plain'
    this.fileInput.hidden = true
    this.fileInput.addEventListener('change', () => void this.loadFile())
    const row = el('div', 'actions')
    row.append(
      createButton({ id: 'title-code-read', label: 'Load', variant: 'primary', onPress: () => this.readCode(this.loadInput.value) }),
      createButton({ id: 'title-code-file', label: 'Load file', ariaLabel: 'Load backup file', icon: 'doc', onPress: () => this.fileInput.click() }),
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
      createButton({ id: 'title-code-cancel', label: 'Cancel', onPress: () => this.cancelReplace() }),
      createButton({ id: 'title-code-replace', label: 'Replace', variant: 'danger', onPress: () => this.confirmReplace() }),
    )
    this.replace.append(this.replaceText, replaceActions)
    this.pick.append(el('h3', '', 'Load into'), this.pickText, this.pickSlots, this.replace)
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
    if (recent?.career) setText(this.continueSub, `Slot ${recent.slot} · ${shopLabel(recent.career)} · Day ${recent.career.day}`)

    const last = lastBackupAt()
    const due = backupReminderDue(slots.some((s) => s.career?.progress), last, now)
    this.reminder.hidden = !due
    if (due) {
      setText(
        this.reminder,
        `${last === null ? 'No backup yet.' : `Last backup: ${backupAgeText(last, now)}.`} If the browser clears its storage, a save code is the way back: in a career, open Settings → Save code.`,
      )
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
    const no = el('span', 'slot-no', `Slot ${slot}`)
    if (career?.end) {
      li.classList.add('is-ended')
      main.dataset.id = `slot-ending-${slot}`
      main.setAttribute('aria-label', `Slot ${slot}: ${shopLabel(career)}, ended: ${career.end.title}. View the summary`)
      main.append(
        no,
        el('span', 'slot-shop', shopLabel(career)),
        el('span', 'slot-title', career.end.title),
        el('span', 'slot-when', `Ended after ${career.end.daysRun} day${career.end.daysRun === 1 ? '' : 's'} · ${END_LABEL[career.end.kind]}`),
      )
      main.addEventListener('click', () => this.once(slot, () => this.deps.play(slot)))
    } else if (career) {
      main.dataset.id = `slot-play-${slot}`
      main.setAttribute('aria-label', `Play slot ${slot}: ${shopLabel(career)}, day ${career.day}`)
      main.append(
        no,
        el('span', 'slot-shop', shopLabel(career)),
        el('span', 'slot-stats', `Day ${career.day} · ${rub(career.cash)}`),
        el('span', 'slot-when', `Last played ${lastPlayedText(career.savedAt, now)}`),
      )
      main.addEventListener('click', () => this.once(slot, () => this.deps.play(slot)))
    } else if (view.damaged) {
      li.classList.add('is-damaged')
      main.disabled = true
      main.append(no, el('span', 'slot-shop', 'This save can’t be read'), el('span', 'slot-when', 'Delete it to free the slot.'))
    } else {
      li.classList.add('is-empty')
      main.dataset.id = `slot-new-${slot}`
      main.setAttribute('aria-label', `Slot ${slot}: empty. Start a new career`)
      const plus = el('span', 'slot-plus')
      plus.innerHTML = icons.plus
      main.append(no, el('span', 'slot-shop', 'Empty — new career'), plus)
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
          createButton({ id: `slot-renew-${slot}`, label: 'New career', variant: 'ghost', className: 'slot-delete slot-renew', ariaLabel: `Start a new career in slot ${slot}`, onPress: () => ask('new') }),
        )
      }
      side.append(
        createButton({ id: `slot-delete-${slot}`, label: 'Delete', variant: 'ghost', className: 'slot-delete', ariaLabel: `Delete the career in slot ${slot}`, onPress: () => ask('delete') }),
      )
      li.append(side)
      if (this.confirm?.slot === slot) {
        const what = this.confirm.what
        const confirm = el('div', 'confirm slot-confirm')
        const text = !career
          ? 'Delete this unreadable save?'
          : what === 'new'
            ? `Start a new career in slot ${slot}? ${shopLabel(career)}’s ending and summary will be gone unless you kept its save code.`
            : career.end
              ? `Delete ${shopLabel(career)} (${career.end.title})? It can’t be undone unless you kept its save code.`
              : `Delete ${shopLabel(career)} (Day ${career.day}, ${rub(career.cash)})? It can’t be undone unless you kept its save code.`
        confirm.append(el('p', '', text))
        const acts = el('div', 'actions')
        acts.append(
          createButton({
            id: `slot-confirm-cancel-${slot}`,
            label: 'Cancel',
            onPress: () => {
              this.confirm = null
              redraw()
            },
          }),
          createButton({
            id: what === 'new' ? `slot-renew-confirm-${slot}` : `slot-delete-confirm-${slot}`,
            label: what === 'new' ? 'New career' : 'Delete',
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
      this.readCode(await readBackupFile(file), 'That file is empty. Choose a Lombard backup file.')
    } catch (err) {
      this.pending = null
      this.pick.hidden = true
      this.loadError.textContent = (err as Error).message || 'That file could not be read.'
    }
  }

  private readCode(input: string, emptyMessage = 'Paste a save code first.'): void {
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
      this.loadError.textContent = err instanceof SaveCodeError ? err.message : 'That save code could not be loaded. Check that you copied all of it.'
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
      `This code holds ${s.meta.intro ? 'a new shop' : s.shop.name}: Day ${s.calendar.day}, ${rub(s.cash)}, ${s.inventory.length} item${s.inventory.length === 1 ? '' : 's'} in stock. Which slot?`,
    )
    this.pickSlots.replaceChildren(
      ...this.slots.map((v) => {
        const b = el('button', 'segment title-pick-slot')
        b.type = 'button'
        b.dataset.id = `title-code-slot-${v.slot}`
        b.classList.toggle('is-selected', this.pendingSlot === v.slot)
        b.append(
          el('span', 'title-pick-no', `Slot ${v.slot}`),
          el('span', 'title-pick-what', v.career ? `${shopLabel(v.career)} · Day ${v.career.day}` : v.damaged ? 'Unreadable save' : 'Empty'),
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
      ? `Replace ${shopLabel(v.career)} (Day ${v.career.day}, ${rub(v.career.cash)}) in slot ${v.slot}? It’s gone unless you kept its save code.`
      : `Replace the unreadable save in slot ${v.slot}?`
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
