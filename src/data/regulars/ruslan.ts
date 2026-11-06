/** Ruslan Gruzdev: clears out flats after funerals; brings what the heirs didn't want. */
export default {
  id: 'ruslan',
  name: 'Ruslan Gruzdev',
  archetype: 'tradesman',
  look: 'male_adult_17',
  temperament: 'flexible',
  knowledge: 0.35,
  desperation: 0.25,
  bio: 'Clears out flats after funerals with his brother-in-law and a van that starts on the third try. Brings in whatever the heirs didn’t want. His mother wants him married.',
  schedule: { from: 5, every: [7, 10] },
  pawn: 0.05,
  items: [
    {
      defId: 'medal_victory_germany',
      weight: 2,
      provenance: 'unknown',
      story: ['From a flat on Third Dredgers’ Line. The grandson wanted the flat, not the medals. Kids today.'],
    },
    { defId: 'badge_guards', weight: 1, provenance: 'unknown', story: ['Found it in a biscuit tin with buttons and a tooth. I kept the tin.'] },
    { defId: 'camera_zenit_e', weight: 2, provenance: 'unknown', story: ['Top of a wardrobe. The old man took four thousand photos of his cat. The cat outlived him.'] },
    { defId: 'phone_severin_k1', weight: 2, provenance: 'unknown', story: ['The lady had three of these. Never threw a phone away in her life. Respect.'] },
    { defId: 'watch_vostok_komandirskie', weight: 1, provenance: 'unknown', story: ['On the bedside table, still ticking. Doing better than its owner, God rest him.'] },
    { defId: 'coin_olympiad_10r', weight: 1, provenance: 'unknown', story: ['In a jar of buckwheat. Old people hide money in grain. Every time.'] },
  ],
  lines: {
    first: ['Morning! Ruslan. House clearances, any floor, no lift, no problem. Somebody passed, so here I am.'],
    again: ['Another one gone to God, and the van still starts. Morning!', 'Morning, boss. The heirs fought over the sofa. Nobody fought over this.'],
    warm: [
      'My mother says I should marry. I said I’m married to the van. She said then marry the pawnbroker, at least they pay.',
      'Morning! I saved you the good stuff this time. Well. The less bad stuff.',
    ],
    cold: ['There’s a shop on the Embankment pays better. Probably. I haven’t checked. Yet.', 'Morning. Give me a number and I’ll go. I’ve got a fourth floor waiting.'],
  },
} as const
