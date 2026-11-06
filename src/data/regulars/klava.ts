/**
 * Klava Bortnik: drives the No. 9 tram, the route Valentin Egorovich drove for thirty-one
 * years (he trained her); Ulyana's older sister (the same look in the depot's orange vest).
 * Thread: the city wants to close the No. 9 (src/data/stories/threads). M6.
 */
export default {
  id: 'klava',
  name: 'Klava Bortnik',
  archetype: 'tradesman',
  look: 'female_adult_13_b',
  temperament: 'stubborn',
  knowledge: 0.45,
  desperation: 0.35,
  bio: 'Drives the No. 9 tram from the depot to Lesnaya and back, nine times a shift, and knows every pothole by first name. Valentin Egorovich trained her in 1998 and still rides her tram on Sundays to criticise. Ulyana’s older sister: one went to sea, one went on rails, and their mother worried about both.',
  schedule: { from: 13, every: [13, 18] },
  pawn: 0.25,
  items: [
    { defId: 'coin_olympiad_10r', weight: 2, provenance: 'unknown', story: ['From the fare box. People still pay with old coins sometimes, Olympiad ones. I swap them for my own money. Valentin Egorovich taught me that too.'] },
    { defId: 'gold_band_583', weight: 1, provenance: 'heirloom', story: ['My wedding ring. The marriage went off the rails in 2009. The ring stayed on the line.'] },
    { defId: 'phone_galaxia_stella4', weight: 1, provenance: 'unknown', story: ['Found on the No. 9, back seat, end of the line, three months ago. Lost property said keep it, they’ve got four hundred. That’s Mostograd.'] },
    { defId: 'watch_vostok_komandirskie', weight: 1, provenance: 'clean', story: ['Depot watch, for timekeeping. They gave us new ones that beep. This one doesn’t beep. That’s why I like it.'] },
  ],
  lines: {
    first: ['Morning. Klava. I drive the No. 9, so you’ve heard me ring the bell at your window every eleven minutes. Ulyana’s my sister. The other Bortnik. The sensible one, that’s me.'],
    again: ['Morning. Nine laps, three drunks, one dog, one marriage proposal. Normal Tuesday.', 'Morning. Valentin Egorovich rode with me Sunday and told me I brake like a pensioner. He is a pensioner.'],
    warm: ['Morning. I ring the bell twice when I pass your window now. Once is for the stop. Twice is for you.', 'Morning. If you ever need a lift to the end of the line, I don’t check tickets for friends. Don’t tell the inspector.'],
    cold: ['Morning. Exact fare, please. I mean the price.', 'Morning. In the depot we have a word for people like your last offer. Fare dodgers.'],
  },
} as const
