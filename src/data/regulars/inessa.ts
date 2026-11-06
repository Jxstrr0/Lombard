/** Inessa Venchikova: wedding registrar, married three times, sells the rings that outlived the marriages. */
export default {
  id: 'inessa',
  name: 'Inessa Venchikova',
  archetype: 'office',
  look: 'female_adult_15',
  temperament: 'proud',
  knowledge: 0.5,
  desperation: 0.25,
  bio: 'Registrar at the Palace of Weddings on Mostovaya. Has married off half the district and herself three times; sells the rings that outlived the marriages. Has a fifteen-year-old son and, lately, a sailor.',
  schedule: { from: 9, every: [8, 12] },
  pawn: 0.15,
  items: [
    {
      defId: 'gold_band_583',
      weight: 3,
      provenance: 'clean',
      story: ['My second husband’s ring. The first one’s is in the canal. I was younger then.', 'A ring. Declared null and void as of last spring.'],
    },
    { defId: 'gold_earrings_583', weight: 1, provenance: 'clean', story: ['An anniversary present. Our only anniversary.'] },
    { defId: 'watch_poljot_strela', weight: 1, provenance: 'clean', story: ['Husband number three left it on the nightstand. He also left.'] },
    { defId: 'phone_mangosteen_m5', weight: 1, provenance: 'clean', story: ['My son’s. He’s fifteen and he was rude to me on it. Confiscated, and now liquidated.'] },
  ],
  lines: {
    first: ['Good afternoon. Inessa Venchikova, civil registry. I join people in marriage for a living, so I know a bad bargain when I see one.'],
    again: ['Good afternoon. Do you, pawnbroker, take this item? Don’t answer yet.', 'Me again. Six weddings this morning. Four of them won’t last. I can tell by the shoes.'],
    warm: ['If you ever want to get married, come to me. I’ll make it quick and I’ll make it legal.', 'Hello, dear. I’m seeing a sailor. Don’t look at me like that. I know.'],
    cold: ['Let’s keep this formal. Item, sum, signatures.', 'I’ve dissolved better partnerships than this one.'],
  },
} as const
