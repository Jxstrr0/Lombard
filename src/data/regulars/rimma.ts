/** Rimma Zavitkova: hairdresser and district gossip; some clients pay her in kind. */
export default {
  id: 'rimma',
  name: 'Rimma Zavitkova',
  archetype: 'tradesman',
  look: 'female_adult_11',
  temperament: 'flexible',
  knowledge: 0.5,
  desperation: 0.3,
  bio: 'Runs the Lokon salon on Kanatnaya Street: two chairs, one dryer and all the gossip in the district. Some clients pay her in kind; her landlord just doubled the rent.',
  schedule: { from: 7, every: [8, 12] },
  pawn: 0.2,
  items: [
    {
      defId: 'gold_earrings_583',
      weight: 2,
      provenance: 'unknown',
      story: ['A client paid me in these. Perm and highlights. Don’t ask which client; I never tell. Well. Rarely.'],
    },
    { defId: 'phone_mangosteen_m4s', weight: 2, provenance: 'unknown', story: ['A girl left it in the chair in January. Nobody came back for it. I waited. I’m not a monster.'] },
    { defId: 'gold_rope_chain_585', weight: 1, story: ['My cousin’s chain. Her husband gave her this and nothing else, so.'] },
    {
      defId: 'gold_cross_585',
      weight: 1,
      provenance: 'unknown',
      story: ['From a client who stopped believing after her divorce. I said, sell it, darling. She said, you sell it.'],
    },
  ],
  lines: {
    first: ['Hello, hello. Rimma, from Lokon, two doors past the chemist. Everyone’s talking about the new pawnbroker, so I came to see what to say.'],
    again: ['Me again. You won’t believe what I heard at the salon. Well, you might. Later.', 'Hello, darling. Your hair. We need to talk about your hair. Another day.'],
    warm: [
      'Valentin Egorovich says you count honest. Zinaida Petrovna says you have kind hands. I say you need a trim. Free, for you.',
      'I tell everyone this place is clean. I don’t say that about many places, darling.',
    ],
    cold: ['Hello. People ask me about you, you know. I haven’t decided what to tell them.', 'Let’s be quick. I’ve a client under the dryer and you under review.'],
  },
} as const
