/**
 * Dev review careers for the endings (`?scenario=ending&kind=…`, `?scenario=retire`; main.ts).
 * Pure: a started career dressed up as a lived one, a few months in, with people met, arcs
 * played and the crime layer touched, so the epilogue paper and cards have something to say.
 * Never used in play.
 */
import { reducer } from '../actions'
import { addDays, createInitialState, seasonOf, weekdayOf, type CareerEndKind, type GameState } from '../state'
import type { DaySummary } from '../types'
import { endCareer } from './end'

const customer = (trust: number, visits: number) => ({ trust, flags: [], visits, lastDay: 100, nextDay: 0 })

/** A career on the morning after closing `day` − 1 (closed, with a ledger behind it). */
export function lateCareer(seed: number, careerId: string, day: number): GameState {
  const s = reducer(createInitialState(seed, careerId), { type: 'career/begin', shopName: '' })
  const date = addDays(s.calendar.date, day - 1)
  const summary: DaySummary = { day: day - 1, openingCash: 96_400, closingCash: 104_900, bought: 2, spent: 9_300, sold: 3, earned: 17_800, walkouts: 1, expenses: 0, loaned: 0, redeemed: 0 }
  return {
    ...s,
    calendar: { day, date, weekday: weekdayOf(date), season: seasonOf(date) },
    cash: summary.closingCash,
    history: [summary],
    day: { ...s.day, phase: 'closed', log: [{ kind: 'sell', amount: 17_800, text: 'Sold a Pobeda watch and two rings' }] },
  }
}

/** An ended career of this kind, with a lived-in state behind it. */
export function endingReview(seed: number, careerId: string, kind: CareerEndKind): GameState {
  let s = lateCareer(seed, careerId, 121)
  const flags = ['medals_conman_known', 'laptop_graduated', 'rolex_friends', 'heart.ilya_operation', 'protection.running']
  s = {
    ...s,
    customers: {
      ...s.customers,
      zinaida: customer(0.6, 7),
      fedya: customer(0.5, 6),
      edik: customer(0.1, 8),
      valentin: customer(0.45, 14),
      yevstafy: customer(-0.3, 9),
      margarita: customer(0, 11),
      zhora: customer(0, 2),
    },
    story: {
      ...s.story,
      flags: [...flags, ...(kind === 'pushedOut' ? ['protection.refused', 'protection.pushed_out'] : ['protection.paying'])],
      arcs: {
        ...s.story.arcs,
        protection: { beats: { 'protection.asking': { day: 4 }, 'protection.offer': { day: 12, choice: kind === 'pushedOut' ? 'refuse' : 'accept' } } },
        laptop: { beats: { 'laptop.renew': { day: 40, choice: 'waive' } }, ended: true },
      },
    },
    specialists: {
      watchmaker: { retained: true, relationship: 0.7, callsUsed: 0, sinceDay: 10, months: 3, events: {}, mods: {}, lowballed: [] },
      jeweler: { retained: false, relationship: 0.3, callsUsed: 0, sinceDay: 0, months: 2, events: {}, mods: {}, lowballed: [], releasedDay: 70 },
    },
    crime: {
      ...s.crime,
      heat: kind === 'raided' ? 2.4 : 0.2,
      volkova: { ...s.crime.volkova, met: true, trust: kind === 'raided' ? -0.5 : 0.5, caught: kind === 'raided' ? 1 : 0 },
      fence: { ...s.crime.fence, met: kind === 'raided', deals: kind === 'raided' ? 6 : 0 },
    },
    career: { ...s.career, axes: kind === 'raided' ? { clean: -5, heart: 3 } : { clean: 0, heart: kind === 'evicted' ? 9 : 12.5 } },
    reputation: {
      ...s.reputation,
      byGroup: { neighbourhood: kind === 'raided' ? 0.1 : 0.72, youth: 0.55, police: kind === 'raided' ? -0.6 : 0.2, mob: kind === 'pushedOut' ? -0.4 : 0.1, specialists: 0.5 },
    },
    stats: { ...s.stats, customersSeen: 905, itemsBought: 212, itemsSold: 188, bestDeal: 41_500, worstDeal: -18_200, fakesBought: 6, peopleHelped: 49, peopleHurt: kind === 'raided' ? 9 : 2 },
    cash: kind === 'evicted' ? -23_800 : kind === 'raided' ? 340_000 : 96_000,
  }
  if (kind === 'evicted') s = { ...s, story: { ...s.story, flags: [...s.story.flags, 'landlord.notice'] } }
  return endCareer(s, kind)
}
