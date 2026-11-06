/**
 * The Flood (M6, GDD § 9: "city event: canal floods, demand and supply shift, chance to be a
 * hero or a vulture"). Fictional people and places. Numbers in tuning.flood, the rules in
 * src/game/city/flood.ts, the beats in src/data/stories/flood.ts.
 *
 * Every spring the ice comes down the Mostova from the lake in plates the size of tram cars.
 * Once in a while it jams under the Kupetsky Bridge, the river backs up into the canals, and
 * the canal district finds out whose basement is lowest. This is that spring.
 *
 * Kuzmich (Pyotr Kuzmich Lapshin) is the dvornik, the caretaker of the yards on Kanatnaya
 * Street: brown work jacket, grey stubble, a cart, a broom and opinions. He has seen the
 * water come up three times and remembers each one by what it ruined. He owns the arc's
 * beats (`who: 'kuzmich'`); the neighbours he sends are one-off strangers (`as`). Counter look
 * gardener_male_01, a walk-in look no regular, specialist or arc character wears.
 *
 * No digits in the news templates (tests check the paper); prices are said in the beats.
 */
import type { NewsTemplate } from './news'

export const FLOOD_PERSON = {
  id: 'kuzmich',
  name: 'Kuzmich',
  /** Shown under his name (as a specialist's role is). */
  role: 'Caretaker, the Kanatnaya yards',
  look: 'gardener_male_01',
} as const

/** The neighbours (one-off strangers on Kuzmich's beats). Walk-in looks no named character wears. */
export const FLOOD_PEOPLE = {
  /** Basement flat at number eleven, bailing with a saucepan. Needs a pump. */
  arkady: { name: 'Arkady', archetype: 'tradesman', look: 'male_adult_05', temperament: 'flexible', knowledge: 0.4, desperation: 0.85 },
  /** The basement on the Fourth Line: two children, a husband on the night shift, everything wet. */
  larisa: { name: 'Larisa', archetype: 'pensioner', look: 'female_adult_14', temperament: 'desperate', knowledge: 0.3, desperation: 0.92 },
  /** Larisa's son, sent back when the price got round. */
  danya: { name: 'Danya', archetype: 'student', look: 'male_adult_16', temperament: 'proud', knowledge: 0.2, desperation: 0.3 },
  /** Ground floor across the yard: her late husband's accordion, the photo albums, a sewing machine. */
  nina: { name: 'Nina Arkadyevna', archetype: 'pensioner', look: 'female_adult_02', temperament: 'proud', knowledge: 0.3, desperation: 0.7 },
  /** The electrician from number nine, wiring half the street back up for nothing. */
  misha: { name: 'Misha', archetype: 'tradesman', look: 'delivery_male_01', temperament: 'flexible', knowledge: 0.4, desperation: 0.8 },
} as const

/** Ledger lines on the flood morning (src/game/city/flood.ts floodHit). */
export const FLOOD_LOG = {
  /** {prep} filled from `prep`. */
  bill: 'Flood: pumping out, plaster and a dehumidifier ({prep})',
  prep: { none: 'nothing was ready', sandbags: 'the sandbags held most of it', lifted: 'the stock was up off the floor' },
  /** {item}, {from}, {to}. */
  damaged: 'Water damage: {item} (condition {from} → {to})',
}

/** The morning's narration on the flood day, by preparation (before "The shop is open…"). */
export const FLOOD_MORNING = {
  none: 'The canal came over the embankment in the night. There is water on the shop floor and a tidemark on the boxes in the back.',
  sandbags: 'The canal came over the embankment in the night. Kuzmich’s sandbags held at the door; only a skin of water got under them.',
  lifted: 'The canal came over the embankment in the night. The floor is a pond, but the stock sat it out on the top shelves.',
  /** The second day under water. */
  still: 'The street is still under water. People wade past the window in fishing boots.',
  /** Water going down. */
  receding: 'The water is going down. It leaves a line of mud along every wall on the street.',
}

/**
 * Lines a flooded-out walk-in seller opens with (src/game/city/flood.ts floodSellers), before
 * their item's own story. Spoken, so digits would be odd anyway.
 */
export const FLOOD_SELLER_LINES: readonly string[] = [
  'The water came into the flat in the night. Everything on the floor is ruined. I need cash for a dehumidifier.',
  'Our basement is a swimming pool. The landlord says it’s an act of God, and God isn’t paying.',
  'We’re staying at my sister’s until the walls dry. I need money for the deposit on a rental.',
  'The car was parked on the embankment. It’s a boat now, and not a good one.',
  'The insurance man came, looked, and said “ah”. That was all he said. So.',
  'My shop on Lodochnaya took the water. I have to pay the girls this week, wet or not.',
  'Everything I own smells of the canal. This is the one thing that doesn’t.',
  'The pump man wants cash up front. Everyone wants cash up front this week.',
]

/**
 * The paper through the flood, printed by updateMarket as the day's lead (src/game/economy/demand.ts):
 * warning (the ice jam), rising (the water at the steps), flood (over the embankment), receding,
 * after (the bill). `tags`/`direction` hint at tuning.flood.demand where a story talks about trade.
 */
export const FLOOD_NEWS: Readonly<Record<'warning' | 'rising' | 'flood' | 'receding' | 'after', readonly NewsTemplate[]>> = {
  warning: [
    {
      id: 'fd_jam',
      headline: 'Ice jams under the Kupetsky Bridge',
      body: 'The spring ice has piled up under the Kupetsky Bridge and is in no hurry to move. The hydrological bureau is “watching the situation”, which our readers will remember is what it said last time.',
    },
    {
      id: 'fd_bureau',
      headline: 'Hydrologists warn the canal district: watch the water',
      body: 'The river is backing up into the canals behind the ice. Residents of basements and ground floors on the embankments are advised to lift what they can and find their wellingtons. The district will hand out sandbags “in due course”.',
    },
    {
      id: 'fd_old_timers',
      headline: 'Old-timers remember the last big water',
      body: 'Pensioners on Lodochnaya Embankment are telling the story of the spring the canal came into the bakery, and the baker sold soggy loaves at half price and called them “canal rolls”. They say the river has the same look about it this year.',
    },
    {
      id: 'fd_dynamite',
      headline: 'Sappers called to the ice on the Mostova',
      body: 'Army engineers have been asked to look at the jam. They looked. They will look again tomorrow, with a larger boat. Fishermen have been asked to stop standing on the problem.',
    },
  ],
  rising: [
    {
      id: 'fd_steps',
      headline: 'Water reaches the top step at the Lion Bridge',
      body: 'The canal is a hand’s width from the embankment and climbing. The district has started handing out sandbags from a lorry on Kanatnaya Street. Caretakers are filling more from the children’s sandpit, with permission from nobody.',
    },
    {
      id: 'fd_boots',
      headline: 'Fishing boots sell out on the ring road',
      body: 'Hardware stalls report a run on boots, buckets and pumps of any size. One trader sold a garden hose to a man who does not have a garden, “just in case”.',
      tags: ['tools'],
      direction: 'up',
    },
    {
      id: 'fd_basements',
      headline: 'Basement tenants told: move your things up tonight',
      body: 'Emergency notices have gone up on the canal-side stairwells. Shopkeepers along the embankment are carrying stock to upper shelves and sharing advice on which shelves those are.',
    },
  ],
  flood: [
    {
      id: 'fd_over',
      headline: 'The canal comes over the embankment',
      body: 'At dawn the water rose over the railings along Kanatnaya Street and Lodochnaya Embankment and walked into the ground floors. Trams are stopped, the bakery is serving from an upstairs window, and a swan has been seen on the No. Nine tram line. Nobody was hurt.',
      tags: ['luxury', 'jewelry', 'cameras'],
      direction: 'down',
    },
    {
      id: 'fd_still',
      headline: 'Canal district still under water',
      body: 'The water stands at knee height on the embankments. Neighbours are carrying pensioners across in wheelbarrows and arguing over whose turn it is. Nobody is buying anything that isn’t a pump, a dry pair of socks or a hot meal.',
      tags: ['luxury', 'jewelry', 'cameras'],
      direction: 'down',
    },
  ],
  receding: [
    {
      id: 'fd_mud',
      headline: 'The water goes down; the mud stays',
      body: 'The canal is back between its walls, leaving a brown line at knee height along every building on the embankment. Courtyards are full of drying carpets. Pump hire firms have tripled their prices, and the district says it is “looking into it”.',
      tags: ['tools'],
      direction: 'up',
    },
    {
      id: 'fd_drying',
      headline: 'Canal district hangs its life out to dry',
      body: 'Sofas on the pavement, photographs pegged on washing lines, a piano upside down in a courtyard on the Fourth Line. Neighbours who had not spoken in years are lending each other buckets. Some are already arguing about the buckets.',
    },
    {
      id: 'fd_insurers',
      headline: 'Insurers discover the small print',
      body: 'Householders on the embankment report that their policies cover fire, theft and acts of God, but not water “arriving at ground level by way of a canal”. A loss adjuster on Kanatnaya Street was seen being followed by a crowd.',
    },
  ],
  after: [
    {
      id: 'fd_bill',
      headline: 'Counting the cost of the spring water',
      body: 'Families from the flooded basements are selling what they can to pay for repairs, and nobody is buying luxuries. Second-hand dealers report full counters and empty tills; pump sellers report the opposite.',
      tags: ['luxury', 'jewelry', 'watches'],
      direction: 'down',
    },
    {
      id: 'fd_fund',
      headline: 'House of Culture collects for flooded families',
      body: 'Blankets, kettles and children’s shoes are piling up in the foyer. The choir is singing in the corridor to make room. Donations of dehumidifiers are especially welcome; donations of advice less so.',
    },
    {
      id: 'fd_gougers',
      headline: 'District warns traders: no flood prices',
      body: 'After complaints about pumps sold at many times their price and storage rooms rented by the hour, the district has reminded traders that an emergency is not a sale. The reminder was pinned to the door of the district office, which is still drying out.',
    },
  ],
}
