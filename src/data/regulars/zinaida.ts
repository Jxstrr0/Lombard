/** Zinaida Petrovna: The Grandmother's Medals (src/data/stories/medals.ts). */
export default {
  id: 'zinaida',
  name: 'Zinaida Petrovna',
  archetype: 'pensioner',
  look: 'female_adult_14',
  temperament: 'proud',
  knowledge: 0.2,
  desperation: 0.7,
  bio: 'Widow from the third floor across the canal. Her Kolya served on a tank. Her roof leaks onto his photograph.',
  schedule: { from: 12, every: [9, 15] },
  pawn: 0.5,
  items: [
    { defId: 'gold_earrings_583', weight: 2, authenticity: 'genuine', provenance: 'heirloom', story: ['My mother’s earrings. I never wear them now. My ears have given up.'] },
    { defId: 'coin_poltinnik_1924', weight: 1, provenance: 'heirloom', story: ['Kolya kept this in his wallet for luck. It did nothing, but he kept it.'] },
    { defId: 'gold_signet_583', weight: 1, authenticity: 'genuine', provenance: 'heirloom', story: ['His ring. It doesn’t fit anyone in the family. They have fat fingers, all of them.'] },
  ],
  lines: {
    first: ['Good day. You’re the new one? The old one used to shout.'],
    again: ['It’s me again. Zinaida Petrovna. Don’t pretend you forgot.', 'Good day. My knees and I have walked all the way here.'],
    warm: ['I brought you nothing to eat today, I’m sorry. Next time.', 'There he is. My honest boy behind the glass.'],
    cold: ['I’ll be quick. I know you’re busy cheating someone.', 'Don’t smile at me. Just look at it.'],
  },
} as const
