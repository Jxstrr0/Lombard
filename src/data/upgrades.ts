/**
 * M2 upgrades and reference book editions, validated at import time.
 * Costs and effect sizes come from tuning.upgrades.
 *
 * The basic reference book (tier 1) is not an upgrade: every shop has it from
 * day 1 (GDD § 7), so the owned tier is max(1, best owned refTier).
 */
import { ReferenceBook, UpgradeDef } from '../game/schema/economy'
import { tuning } from './tuning'

const u = tuning.upgrades

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'acid_kit',
    name: 'Acid test kit',
    blurb: 'Touchstone, needle and nitric acid. Tells gold from plate, scratch by scratch.',
    cost: u.cost.acid_kit,
    effects: { unlockTool: 'acid', toolCategories: ['gold', 'coins'], acidCharges: u.acidKitCharges },
  },
  {
    id: 'reference_2',
    name: 'Price guide, 2013 edition',
    blurb: 'Newer models, tighter ranges. Phones and electronics finally in it.',
    cost: u.cost.reference_2,
    effects: { refTier: 2 },
  },
  {
    id: 'reference_3',
    name: 'Dealer’s auction catalogue',
    blurb: 'What things actually sold for last season. Narrow, current, expensive.',
    cost: u.cost.reference_3,
    requires: ['reference_2'],
    effects: { refTier: 3 },
  },
  {
    id: 'case_counter',
    name: 'Better counter case',
    blurb: 'Lit glass with a lock. Buyers notice what’s in it, thieves less so.',
    cost: u.cost.case_counter,
    effects: { visibility: { counter: u.caseCounterVisibility }, security: u.caseCounterSecurity },
  },
].map((raw) => UpgradeDef.parse(raw))

export const REFERENCE_BOOKS: readonly ReferenceBook[] = [
  { tier: 1, title: 'The old price guide', short: 'old ed.', outdated: ['phones', 'electronics'] },
  { tier: 2, title: 'The 2013 price guide', short: '2013 ed.', outdated: [] },
  { tier: 3, title: 'The auction catalogue', short: 'catalogue', outdated: [] },
].map((raw) => ReferenceBook.parse(raw))

const byId = new Map(UPGRADES.map((d) => [d.id, d]))

export function getUpgrade(id: string): UpgradeDef | undefined {
  return byId.get(id)
}

export function referenceBook(tier: number): ReferenceBook {
  return REFERENCE_BOOKS[Math.min(REFERENCE_BOOKS.length, Math.max(1, tier)) - 1]!
}
