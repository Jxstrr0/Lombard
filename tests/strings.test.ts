/**
 * M6, localization-ready strings: the t() lookup, plural forms (English and a
 * Russian-shaped table), the table's own consistency, and the formatting
 * module reading exactly as the code it replaced.
 */
import { describe, expect, it } from 'vitest'
import { en } from '../src/data/strings/en'
import { holesOf, interpolate, makeT, t, type Entry, type StringKey, type Translation } from '../src/data/strings'
import { addDays, weekdayOf } from '../src/game/state'
import { count, daysLabel, fullDate, grouped, longDate, monthlyRateLabel, plusRub, rub, shortDay, signedRub } from '../src/ui/format'

describe('t()', () => {
  it('looks up plain strings and fills {name} holes', () => {
    expect(t('common.pass')).toBe('Pass')
    expect(t('fmt.money', { amount: '12,500' })).toBe('12,500 ₽')
    expect(t('common.slotN', { slot: 2 })).toBe('Slot 2')
  })

  it('picks English plural forms by count', () => {
    expect(t('fmt.days', { count: 1 })).toBe('1 day')
    expect(t('fmt.days', { count: 0 })).toBe('0 days')
    expect(t('fmt.days', { count: 5 })).toBe('5 days')
    expect(t('backup.age.days', { count: 21 })).toBe('21 days ago')
  })

  it('leaves a hole it has no value for as written, and fills every copy of one it has', () => {
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}')
    expect(interpolate('{a}{a}', { a: 'x' })).toBe('xx')
    expect(holesOf('Day {day} · {cash}')).toEqual(['day', 'cash'])
  })

  it('works for a language with one / few / many forms (Russian)', () => {
    // A Russian table needs every key; reuse English and override the one under test.
    const ru: Translation = { ...en, 'fmt.days': { one: '{count} день', few: '{count} дня', many: '{count} дней', other: '{count} дня' } }
    const tr = makeT(ru, 'ru')
    expect(tr('fmt.days', { count: 1 })).toBe('1 день')
    expect(tr('fmt.days', { count: 3 })).toBe('3 дня')
    expect(tr('fmt.days', { count: 5 })).toBe('5 дней')
    expect(tr('fmt.days', { count: 11 })).toBe('11 дней')
    expect(tr('fmt.days', { count: 21 })).toBe('21 день')
    expect(tr('fmt.days', { count: 24 })).toBe('24 дня')
    expect(tr('fmt.days', { count: 1.5 })).toBe('1.5 дня')
  })

  it('is typed: a missing key or a missing parameter fails the typecheck (npm run lint)', () => {
    // Never run; only typechecked. tsc --noEmit checks tests too, so if t() stopped
    // rejecting these calls the @ts-expect-error marks would be unused and lint would fail.
    const typeChecks = () => [
      // @ts-expect-error: no such key
      t('no.such.key'),
      // @ts-expect-error: the key needs { amount }
      t('fmt.money'),
      // @ts-expect-error: wrong parameter name
      t('fmt.money', { sum: 1 }),
      // @ts-expect-error: a plural key needs { count }
      t('fmt.days', {}),
      // @ts-expect-error: a plain key takes no parameters
      t('common.pass', { x: 1 }),
    ]
    expect(typeChecks).toBeTypeOf('function')
    const key: StringKey = 'common.pass'
    expect(en[key]).toBe('Pass')
  })
})

describe('the English table', () => {
  const entries = Object.entries(en) as [string, Entry][]

  it('has stable dotted ids', () => {
    for (const [key] of entries) expect(key).toMatch(/^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/)
  })

  it('uses only {name} holes: no ${…}, {{…}}, %s or stray braces', () => {
    for (const [key, entry] of entries) {
      const texts = typeof entry === 'string' ? [entry] : Object.values(entry)
      for (const text of texts) {
        expect(text, key).not.toMatch(/\$\{|\{\{|%[sd]/)
        expect(text.replace(/\{\w+\}/g, ''), key).not.toMatch(/[{}]/)
      }
    }
  })

  it('gives every plural entry an `other` form, a {count}, and the same other holes in each form', () => {
    for (const [key, entry] of entries) {
      if (typeof entry === 'string') continue
      expect(entry.other, key).toBeTypeOf('string')
      const forms = Object.values(entry)
      const holes = (s: string) => [...new Set(holesOf(s))].sort().join(',')
      for (const f of forms) {
        expect(holesOf(f), key).toContain('count')
        expect(holes(f), key).toBe(holes(entry.other))
      }
    }
  })
})

// The code these replaced (pre-M6 ui/format.ts and ui/loanFormat.ts), kept here to
// prove the English output is unchanged.
const oldNum = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const old = {
  rub: (n: number) => `${oldNum.format(Math.round(n))} ₽`,
  signedRub: (n: number) => {
    const r = Math.round(n)
    if (r === 0) return '0 ₽'
    return `${r > 0 ? '+' : '−'}${oldNum.format(Math.abs(r))} ₽`
  },
  longDate: (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  fullDate: (iso: string) =>
    `${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekdayOf(iso)]}, ${old.longDate(iso)}`,
  shortDay: (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`)
    const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
    return `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekdayOf(iso)]} ${d.getUTCDate()} ${month}`
  },
  monthlyRateLabel: (rate: number) => `${Math.round(rate * 1000) / 10}% a month`,
  daysLabel: (n: number) => `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`,
}

describe('format.ts reads exactly as before in English', () => {
  const amounts = [0, 0.4, 0.6, 1, 7, 99, 999, 1000, 1234.5, 12_500, 99_999, 1_000_000, 123_456_789]

  it('money', () => {
    for (const n of [...amounts, ...amounts.map((a) => -a)]) {
      expect(rub(n)).toBe(old.rub(n))
      expect(signedRub(n)).toBe(old.signedRub(n))
    }
    expect(plusRub(3200)).toBe('+3,200 ₽')
    expect(plusRub(0)).toBe('+0 ₽')
    expect(grouped(12_500)).toBe('12,500')
    expect(count(48_211)).toBe('48,211')
  })

  it('calendar dates, every day for two years', () => {
    for (let i = 0; i < 731; i++) {
      const iso = addDays('2014-01-01', i)
      expect(longDate(iso)).toBe(old.longDate(iso))
      expect(fullDate(iso)).toBe(old.fullDate(iso))
      expect(shortDay(iso)).toBe(old.shortDay(iso))
    }
  })

  it('days and monthly rates', () => {
    for (const n of [-2, -1, 0, 1, 2, 7, 30, 31]) expect(daysLabel(n)).toBe(old.daysLabel(n))
    for (const r of [0, 0.05, 0.08, 0.1, 0.125, 0.15, 0.2, 0.333]) expect(monthlyRateLabel(r)).toBe(old.monthlyRateLabel(r))
  })
})
