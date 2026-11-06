/**
 * The Collector (M5, GDD § 9): a fictional person. Numbers live in tuning.collector, the
 * logic in src/game/crime/collector.ts, the beats in src/data/stories/collector.ts.
 *
 * Leopold Germanovich Bessmertny ("Immortal", and he will tell you it's a family joke
 * that stopped being funny in 1917). Younger than his manners, a dark suit, a tie with
 * small pheasants on it, a velvet glove he wears only to touch things. Founder and
 * sole member of the Bessmertny Foundation for Domestic Beauty, which is turning the
 * old Embankment bathhouse into a private museum. Speaks as if everything were a
 * letter he is writing to you; apologises to furniture; calls the icon "she". Has been
 * looking for one icon for eleven years, with a photograph from a 1912 parish album.
 * Pays in cash, from a hatbox, counted twice by his driver Kostya, who waits outside
 * with the engine running and never comes in. Absurd, polite, and not a gangster: he
 * simply believes that beautiful things belong to whoever loves them most expensively.
 *
 * The icon: "Our Lady of the Embankment" (src/data/items/icons.json, story-only), a late
 * 18th-century Hodegetria under a silver cover, with a little canal boat at her feet.
 * Taken during roof repairs from the Church of the Intercession on Kozhevennaya Street
 * (the "ПОКР" of the inventory number on its back); Father Ioann wants her back.
 *
 * Counter look: business_male_02 (dark suit, patterned tie), a walk-in look no regular,
 * specialist, the fence or Volkova wears.
 */

export const COLLECTOR = {
  id: 'bessmertny',
  name: 'Leopold Germanovich Bessmertny',
  /** Shown under his name (as a specialist's role is). */
  role: 'Collector, Bessmertny Foundation',
  look: 'business_male_02',
} as const

/** The icon he wants (a story-only def). */
export const COLLECTOR_ICON = 'icon_embankment_hodegetria'

/** The roofer who brings it in (a one-off stranger, `as` on the beat). */
export const ROOFER = {
  name: 'Seryozha',
  archetype: 'tradesman',
  look: 'wood_male_01',
  temperament: 'flexible',
  knowledge: 0.2,
  desperation: 0.8,
} as const

/** Ledger lines when the icon leaves the shop. */
export const COLLECTOR_LOG = {
  sold: 'Sold to L. G. Bessmertny: “Our Lady of the Embankment”, cash, from a hatbox',
  returned: 'Returned to the Church of the Intercession: “Our Lady of the Embankment”',
  handedIn: 'Handed to the police: “Our Lady of the Embankment”',
} as const
