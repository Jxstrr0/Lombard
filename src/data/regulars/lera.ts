/**
 * Lera Kovrigina: Alisa's twin (the same look in a camel hoodie), second year in accounting
 * at the Economics College, the sensible one, who disapproves of the DJing and of pawning in
 * general and checks your interest maths. Thread: Alisa's phone (src/data/stories/threads),
 * which reads Alisa's loans. M6.
 */
export default {
  id: 'lera',
  name: 'Lera Kovrigina',
  archetype: 'student',
  look: 'female_adult_12_b',
  temperament: 'stubborn',
  knowledge: 0.7,
  desperation: 0.25,
  bio: 'Alisa’s twin, eleven minutes older, which she mentions. Studies accounting at the Economics College, works Saturdays at a tax-return booth, and has a spreadsheet for her spreadsheets. Disapproves of pawn shops on principle and visits one anyway, for research.',
  schedule: { from: 25, every: [15, 21] },
  pawn: 0.1,
  items: [
    { defId: 'phone_galaxia_stella4', weight: 2, provenance: 'clean', story: ['My old phone. I have the box, the receipt, and the warranty card. I have the receipt for the box.'] },
    { defId: 'gold_earrings_583', weight: 1, provenance: 'heirloom', story: ['From Grandma, one pair each. Alisa pawned hers in the spring. I’m selling mine properly, at market value. That’s the difference between us.'] },
    { defId: 'coin_olympiad_10r', weight: 1, provenance: 'heirloom', story: ['Dad’s Olympiad coin. He said invest it. I’m investing it. In a laptop with a working Excel.'] },
  ],
  lines: {
    first: ['Hello. Lera Kovrigina. Yes, the twin. I’m the older one. I’d like to see your rates in writing before we start. Alisa never asks for anything in writing.'],
    again: ['Hello. I recalculated your interest from last time. It was correct. I was a little disappointed.', 'Hello. Alisa played a gig last night. Sixteen people came. Twelve were friends. I counted.'],
    warm: ['Hello. You’re the only business on this canal whose numbers add up. I mean that as the highest praise I have.', 'Hello. I made a spreadsheet of Alisa’s pawns. You’re in it. You come out well.'],
    cold: ['Hello. I’ve written down the figure you offered last time. In pen.', 'Hello. Let’s keep this transactional.'],
  },
} as const
