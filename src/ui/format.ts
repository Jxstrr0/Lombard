/**
 * The one formatting module for the screens (M6): numbers, money, percentages
 * and the in-game calendar go through `Intl` in the strings' locale
 * (data/strings LOCALE), and the patterns around them ("12,500 ₽", "Thu 2 Apr",
 * "3 days") come from the string table. Pure functions, no DOM.
 */
import { archetypes } from '../data/customers/walkins'
import { getItemDef } from '../data/items'
import { LOCALE, t } from '../data/strings'
import type { ToolId } from '../game/schema/item'

const whole = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 })
/** Calendar dates are ISO days with no time zone: format them in UTC so the day never shifts. */
const longDateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', timeZone: 'UTC' })
const shortDayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayMonthFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', timeZone: 'UTC' })
/** Real-world times (the title's "last played"), in the player's own time zone. */
const clockFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' })
const shortDateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })

const isoDay = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** Plain grouped number without the currency sign: 12500 → "12,500". */
export function grouped(n: number): string {
  return whole.format(Math.round(n))
}

/** 12500 → "12,500 ₽" */
export function rub(n: number): string {
  return t('fmt.money', { amount: grouped(n) })
}

/** Signed ledger amount: "+12,500 ₽", "−4,000 ₽", "0 ₽". Uses a real minus sign. */
export function signedRub(n: number): string {
  const r = Math.round(n)
  if (r === 0) return t('fmt.zeroMoney')
  const amount = rub(Math.abs(r))
  return r > 0 ? t('fmt.plus', { amount }) : t('fmt.minus', { amount })
}

/** "+3,200 ₽" for an amount that only ever adds (interest on a ticket), "+0 ₽" included. */
export function plusRub(n: number): string {
  return t('fmt.plus', { amount: rub(n) })
}

/** 60 → "60%" (rounded to a whole percent). */
export function percent(n: number): string {
  return t('fmt.percent', { n: grouped(n) })
}

/** The shop opens at 10:00. */
export const OPENING_MINUTES = 10 * 60
/**
 * Shop-clock minutes shown per in-game second of `day.clock`. Presentation
 * only: a day of eight customers takes ~8–10 real minutes and the clock reads
 * it as a working day from 10:00 to about 18:00.
 */
export const CLOCK_MINUTES_PER_SECOND = 1

/** day.clock (in-game seconds since opening) → "HH:MM" (a 24-hour shop clock in every language). */
export function shopClock(clockSeconds: number): string {
  const total = OPENING_MINUTES + Math.floor(clockSeconds * CLOCK_MINUTES_PER_SECOND)
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function archetypeLabel(id: string): string {
  return archetypes.find((a) => a.id === id)?.label ?? id
}

export function toolLabel(tool: ToolId): string {
  return t(`tool.${tool}`)
}

/** "14 March 2014" from an ISO date. */
export function longDate(iso: string): string {
  return longDateFmt.format(isoDay(iso))
}

/** "Friday, 14 March 2014" from an ISO date. */
export function fullDate(iso: string): string {
  const d = isoDay(iso)
  return t('fmt.fullDate', { weekday: weekdayFmt.format(d), date: longDateFmt.format(d) })
}

/** "Thu 2 Apr" from an ISO date. */
export function shortDay(iso: string): string {
  return shortDayFmt.format(isoDay(iso))
}

/** "31 March" from an ISO date. */
export function dayMonth(iso: string): string {
  return dayMonthFmt.format(isoDay(iso))
}

/** 1 → "1 day", 5 → "5 days" */
export function daysLabel(n: number): string {
  return t('fmt.days', { count: n })
}

/** 0.1 → "10% a month" */
export function monthlyRateLabel(rate: number): string {
  return t('fmt.monthlyRate', { rate: oneDecimal.format(Math.round(rate * 1000) / 10) })
}

/** A count in running text: 1234 → "1,234". */
export function count(n: number): string {
  return whole.format(n)
}

/** "Today, 14:05", "Yesterday, 09:12" or "3 Nov 2026" (real time, the player's time zone). */
export function lastPlayedText(savedAt: number, now = Date.now()): string {
  const d = new Date(savedAt)
  const time = clockFmt.format(d)
  const day = (ms: number) => new Date(ms).toDateString()
  if (day(savedAt) === day(now)) return t('fmt.today', { time })
  if (day(savedAt) === day(now - 86_400_000)) return t('fmt.yesterday', { time })
  return shortDateFmt.format(d)
}

/** Item name for a def id, or a fallback when the def is unknown (e.g. data changed under a save). */
export function itemNameOf(defId: string, fallback = t('common.anItem')): string {
  try {
    return getItemDef(defId).name
  } catch {
    return fallback
  }
}
