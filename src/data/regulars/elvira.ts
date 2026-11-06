/**
 * Elvira Venchikova: teaches Russian literature at School No. 41, Inessa's younger sister
 * (the same look in a burgundy blouse, darker hair). Pays for things the school won't out of
 * her own pocket. Thread: the class trip (src/data/stories/threads). M6.
 */
export default {
  id: 'elvira',
  name: 'Elvira Venchikova',
  archetype: 'office',
  look: 'female_adult_15_b',
  temperament: 'proud',
  knowledge: 0.45,
  desperation: 0.45,
  bio: 'Teaches Russian literature to the eighth form at School No. 41, where Bakhtiyor’s daughters are the only ones who do the reading. Inessa’s younger sister; Inessa marries people, Elvira marks their children. Pays for the class’s excursions out of her own salary and lies about it to the headmistress.',
  schedule: { from: 22, every: [14, 19] },
  pawn: 0.35,
  items: [
    { defId: 'gold_earrings_583', weight: 2, provenance: 'heirloom', story: ['My mother’s earrings. She was a teacher too. She would have done the same. She did do the same, actually; that’s how she lost the other pair.'] },
    { defId: 'camera_zenit_e', weight: 1, provenance: 'clean', story: ['The school photography club’s camera. The club closed in 2004. The camera stayed in my cupboard, like a pupil who won’t go home.'] },
    { defId: 'gold_cross_585', weight: 1, provenance: 'heirloom', story: ['My godmother’s. Don’t tell Inessa. She thinks I keep it in a box. I do keep it in a box. This one.'] },
  ],
  lines: {
    first: ['Good afternoon. Venchikova, Elvira Arkadyevna. Yes, Inessa’s sister. I teach. You’ll want to know why a teacher is in a pawn shop. Answer: teaching.'],
    again: ['Good afternoon. Thirty essays on Chekhov. Twenty-nine of them say “the gun goes off”. One says “the gun is a metaphor”. I nearly wept.', 'Good afternoon. The headmistress wants a report on the report. I said I would write it in iambic pentameter.'],
    warm: ['Good afternoon. You would have been a good pupil: you listen, and you don’t pretend to understand when you don’t.', 'Good afternoon. My class asked what a pawn shop is. I said, a library where the books are worth something. They looked sceptical.'],
    cold: ['Good afternoon. I mark generously. You don’t. Noted.', 'Good afternoon. Let us be brief and correct.'],
  },
} as const
