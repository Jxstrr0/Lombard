/**
 * The epilogue paper (M5, GDD § 12): the last morning paper of the career, after the
 * title's own lead story (src/data/endings/titles.ts). One story per section, the first
 * whose conditions hold (src/game/schema/endings.ts). `{shop}` is the shop's name.
 * Same rules as the morning paper (src/data/news.ts): no digits, fictional, violence off
 * the page.
 */
import type { z } from 'zod'
import type { PaperSection } from '../../game/schema/endings'

type Raw = z.input<typeof PaperSection>

export const PAPER_SECTIONS: Raw[] = [
  {
    // What the street says about you.
    id: 'street',
    stories: [
      {
        id: 'street_loved',
        when: [{ if: 'band', is: 'loved' }],
        headline: 'Kanatnaya Street: “You knew where you stood”',
        body: 'We asked along the canal what the pawn shop meant to them. A baker said it was where you went before payday and came out with your dignity. A pensioner said it was the only shop where they let you sit down. Somebody has already chalked a heart on the shutter.',
      },
      {
        id: 'street_shunned',
        when: [{ if: 'band', is: 'shunned' }],
        headline: 'The canal has a long memory',
        body: 'Ask about the pawn shop along Kanatnaya Street and you get a look first, then a story about an earring, a coin, a ring that went for nothing. Nobody seems sad to see the sign come down. One woman asked if she could have it, for the fire.',
      },
      {
        id: 'street_kids',
        when: [{ if: 'rep', group: 'youth', gte: 0.5 }],
        headline: 'Students lose their favourite pawnbroker',
        body: 'Phones before gigs, laptops before rent, cameras before exams: the students of the canal district pawned their way through the year at {shop} and mostly got everything back. The rowing club has written a song about it. We have heard the song. We are sorry.',
      },
      {
        id: 'street_mixed',
        when: [],
        headline: 'Shopkeepers of the canal: one fewer',
        body: 'The street takes the news the way it takes the weather. The kiosk lady will miss the custom; the man with the dog will miss arguing. The pigeons on the shop sign have not been told.',
      },
    ],
  },
  {
    // The crime layer: the crew, the police, the back room.
    id: 'crime',
    stories: [
      {
        id: 'crime_raid_list',
        when: [{ if: 'ending', kind: ['raided'] }],
        headline: 'Stolen goods bulletin: several items recovered',
        body: 'Police report that a number of watches, rings and one accordion listed in this paper as stolen have been recovered in a single morning. Owners may apply in person, with proof, and patience.',
      },
      {
        id: 'crime_dirty',
        when: [{ if: 'band', is: 'dirty' }],
        headline: 'Detective asks: where do all the watches go?',
        body: 'Detective Volkova of the canal district declined to comment on any particular shop, then commented for some time on pawn shops in general, provenance, receipts, and people who think a back room is a kind of alibi.',
      },
      {
        id: 'crime_held_out',
        when: [{ if: 'flag', flag: 'protection.held_out' }],
        headline: 'The street that came out with brooms',
        body: 'Shopkeepers on the canal still tell the story of the morning half the street stood on the pavement outside {shop} and looked at a clean car until it left. Nobody said a word, they say. Several have since said a great many.',
      },
      {
        id: 'crime_paid',
        when: [{ if: 'flag', flag: 'protection.paying' }],
        headline: '“Insurance” on the canal: who really pays?',
        body: 'Shopkeepers along the canal would not discuss the monthly visits from polite gentlemen in good coats. One said only that the insurance was very reasonable and that nothing had burned down. She said it twice.',
      },
      {
        id: 'crime_refused',
        when: [{ if: 'flag', flag: 'protection.refused' }],
        headline: 'The shop that wouldn’t pay',
        body: 'Ask the bakery about {shop} and they will tell you about the glue in the lock, and how the pawnbroker paid the locksmith and still said no. Not everyone on the canal could afford that. Some of them say they will try.',
      },
      {
        id: 'crime_quiet',
        when: [],
        headline: 'Quiet month for the canal district police',
        body: 'The district station reports a calm month: two bicycles, one argument about a parking space and a goat, which turned out to belong to somebody. No complaints were made about the pawn shop. A sergeant said that was unusual for a pawn shop.',
      },
    ],
  },
  {
    // What happens to the premises.
    id: 'premises',
    stories: [
      {
        id: 'premises_evicted',
        when: [{ if: 'ending', kind: ['evicted'] }],
        headline: 'Ground floor to let, canal view, some damp',
        body: 'The landlord, Semyon Markovich, advertises the former pawn shop on Kanatnaya Street: glass cases, a safe, a back room and a draught he describes as character. Responsible tenants only. Rent in advance.',
      },
      {
        id: 'premises_raided',
        when: [{ if: 'ending', kind: ['raided'] }],
        headline: 'Seized stock to be sold at auction',
        body: 'Unclaimed goods from the canal pawn shop will go under the hammer at the district auction house next month. Viewing on Thursday. Bring your own torch; the auction house has not paid its electricity either.',
      },
      {
        id: 'premises_pushed',
        when: [{ if: 'ending', kind: ['pushedOut'] }],
        headline: 'New sign, same shutters',
        body: 'Semyon Markovich, the landlord, has let the ground floor again, to a firm with clean cars. A van came for the old stock at dawn and another brought new stock by noon. The new staff are large and do not chat. The cat that sleeps in the window has moved next door.',
      },
      {
        id: 'premises_retired_rich',
        when: [{ if: 'ending', kind: ['retired'] }, { if: 'band', is: 'rich' }],
        headline: 'Where do pawnbrokers retire?',
        body: 'The former owner of {shop} has been seen pricing a dacha on the lake and, separately, a very good fishing rod. Neither seller managed to haggle. Both say it was an education.',
      },
      {
        id: 'premises_retired',
        when: [],
        headline: 'Lease on the canal pawn shop changes hands',
        body: 'The new tenant at {shop} has kept the sign, the cases and the cat. The old owner left a note in the till: the scale reads light in damp weather, the third step creaks, and Zinaida Petrovna is always right.',
      },
    ],
  },
  {
    // Weather, the way the morning paper always ends.
    id: 'weather',
    stories: [
      {
        id: 'weather_winter',
        when: [{ if: 'date', from: '12-01', to: '02-29' }],
        headline: 'Weather: ice on the canal',
        body: 'Frost tonight and ice on the canal by the morning. Skaters are asked to stay off it, and will not.',
      },
      {
        id: 'weather_spring',
        when: [{ if: 'date', from: '03-01', to: '05-31' }],
        headline: 'Weather: the thaw',
        body: 'Grey and mild, with the last of the ice going down the canal like old furniture. Puddles everywhere. Mind the trams.',
      },
      {
        id: 'weather_summer',
        when: [{ if: 'date', from: '06-01', to: '08-31' }],
        headline: 'Weather: white nights',
        body: 'Warm, light until very late, and nobody on the embankment is going home early. The bridges open at night; plan accordingly.',
      },
      {
        id: 'weather_autumn',
        when: [],
        headline: 'Weather: rain on the canal',
        body: 'Rain from the gulf by evening, then more rain. The canal will rise a little and go down again, as it always does.',
      },
    ],
  },
]
