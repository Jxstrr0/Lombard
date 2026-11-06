/** Mikhail Ramonovich: river-steamer cook, ashore until navigation opens; his father's ring winters with you. */
export default {
  id: 'mikhail',
  name: 'Mikhail Ramonovich',
  archetype: 'sailor',
  look: 'male_adult_12',
  temperament: 'flexible',
  knowledge: 0.35,
  desperation: 0.5,
  bio: 'Cook on the river steamer Pavel Bazhenov, ashore every winter until navigation opens. His father came from Havana to study shipbuilding; the father’s ring winters in a pawnshop and goes home in May.',
  // Gone back to the river once navigation opens (early May).
  schedule: { from: 8, every: [8, 12], until: 62 },
  pawn: 0.45,
  items: [
    {
      defId: 'gold_signet_583',
      weight: 3,
      authenticity: 'genuine',
      provenance: 'heirloom',
      story: ['Papa’s ring. Every winter it stays with you; every May it comes home. Tradition. Don’t lose it.'],
    },
    { defId: 'coin_chervonets_sower', weight: 1, story: ['A gold Sower. Won it off the boatswain at cards in October. He wants a rematch. I want money.'] },
    { defId: 'phone_galaxia_nota3', weight: 2, story: ['My phone. Big screen, for recipes. I know the recipes. I’ll manage.'] },
    { defId: 'camera_zenit_e', weight: 1, story: ['I photographed every borscht I made last summer. Two hundred borschts. You want the negatives too?'] },
    { defId: 'watch_vostok_komandirskie', weight: 2, story: ['Waterproof, they say. In my galley everything is waterproof, or it dies.'] },
  ],
  lines: {
    first: ['Good day, good day. Mikhail Ramonovich, cook, river steamer, currently aground. Winter is long and my pockets are short.'],
    again: ['Hello again! Six more weeks till navigation. Five, if the ice is kind.', 'Good day. The company has new owners. They don’t know me. I don’t know if they’ll want me.'],
    warm: [
      'I brought you solyanka in a jar. Bring the jar back; it’s my mother’s.',
      'Hey, friend! When the boat sails I’ll wave from the deck as we pass your canal. You won’t see me. Wave anyway.',
    ],
    cold: ['My papa used to say: smile at the man who cheats you, then never eat at his table again. I’m smiling.', 'Let’s be quick. The soup at home is going cold, and so am I.'],
  },
} as const
