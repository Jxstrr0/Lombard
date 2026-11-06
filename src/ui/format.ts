/** Display formatting shared by the screens. Pure functions, no DOM. */
import { archetypes } from '../data/customers/walkins'
import { getItemDef } from '../data/items'
import type { ToolId } from '../game/schema/item'

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** 12500 → "12,500 ₽" */
export function rub(n: number): string {
  return `${num.format(Math.round(n))} ₽`
}

/** Signed ledger amount: "+12,500 ₽", "−4,000 ₽", "0 ₽". Uses a real minus sign. */
export function signedRub(n: number): string {
  const r = Math.round(n)
  if (r === 0) return '0 ₽'
  return `${r > 0 ? '+' : '−'}${num.format(Math.abs(r))} ₽`
}

/** Plain grouped number without the currency sign. */
export function grouped(n: number): string {
  return num.format(Math.round(n))
}

/** The shop opens at 10:00. */
export const OPENING_MINUTES = 10 * 60
/**
 * Shop-clock minutes shown per in-game second of `day.clock`. Presentation
 * only: a day of eight customers takes ~8–10 real minutes and the clock reads
 * it as a working day from 10:00 to about 18:00.
 */
export const CLOCK_MINUTES_PER_SECOND = 1

/** day.clock (in-game seconds since opening) → "HH:MM". */
export function shopClock(clockSeconds: number): string {
  const total = OPENING_MINUTES + Math.floor(clockSeconds * CLOCK_MINUTES_PER_SECOND)
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function archetypeLabel(id: string): string {
  return archetypes.find((a) => a.id === id)?.label ?? id
}

export const TOOL_LABEL: Record<ToolId, string> = {
  loupe: 'Loupe',
  scale: 'Scale',
  magnet: 'Magnet',
  uv: 'UV light',
  acid: 'Acid kit',
  reference: 'Reference',
  phone: 'Phone',
  specialist: 'Specialist',
  passport: 'Passport',
}

/** "14 March 2014" style date from an ISO date. */
export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/** Item name for a def id, or a fallback when the def is unknown (e.g. data changed under a save). */
export function itemNameOf(defId: string, fallback = 'an item'): string {
  try {
    return getItemDef(defId).name
  } catch {
    return fallback
  }
}
