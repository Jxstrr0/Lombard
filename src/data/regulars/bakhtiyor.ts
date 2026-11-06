/**
 * Bakhtiyor Rakhimov: bricklayer on the embankment flats site, from near Samarkand. Comes on
 * Fridays, after the mosque, in his good white clothes. Dilnoza's husband, Jamshid's cousin.
 * Thread: the watch in the wall (src/data/stories/threads). M6.
 */
export default {
  id: 'bakhtiyor',
  name: 'Bakhtiyor Rakhimov',
  archetype: 'tradesman',
  look: 'male_adult_15',
  temperament: 'proud',
  knowledge: 0.4,
  desperation: 0.4,
  bio: 'Lays bricks on the new embankment flats, nine years in Mostograd, two daughters at School No. 41. Comes in on Fridays after the mosque, in his good white clothes, and never once in his work boots. Sends half of everything home.',
  // Fridays only (4 = Friday): the one afternoon off the site.
  schedule: { from: 11, every: [13, 20], weekdays: [4] },
  pawn: 0.35,
  items: [
    { defId: 'gold_band_583', weight: 2, provenance: 'heirloom', story: ['My father’s ring. In our family the eldest son wears it. I am the eldest son and I am a little short this month.'] },
    { defId: 'phone_galaxia_stella4', weight: 2, provenance: 'clean', story: ['My telephone. I bought it with a receipt, here, the receipt. In this city I keep receipts for everything, even for my own face.'] },
    { defId: 'watch_vostok_komandirskie', weight: 1, provenance: 'clean', story: ['A foreman gave it to me in my first year, when I built his dacha. He said it was waterproof. I said, so am I.'] },
    { defId: 'gold_earrings_583', weight: 1, provenance: 'clean', story: ['For my wife’s birthday I bought these. Then her mother needed a doctor. My wife said sell them, and the birthday can wait. She is a strong woman. Stronger than this price, I hope.'] },
  ],
  lines: {
    first: ['Assalomu alaykum. Good afternoon. Bakhtiyor. My wife has the kiosk by the tram stop; she said you are the honest one. She checks everyone, so it is true.'],
    again: ['Good afternoon. Friday, so I am clean, and so is my conscience. Mostly.', 'Good afternoon. The site is three floors higher since last time. My back is three floors older.'],
    warm: ['Good afternoon, my friend. My daughters ask who is the person I visit on Fridays. I say a banker. They are impressed.', 'Good afternoon. Dilnoza sent samsa. Two. She said one is for you and one is so you are generous.'],
    cold: ['Good afternoon. Let us do this quickly and correctly.', 'I came because I need to. Not because I want to. You understand the difference.'],
  },
} as const
