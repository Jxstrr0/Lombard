/**
 * Zhanna Kuzovkina: postwoman for the canal blocks, Rimma's cousin (the same look in post-office
 * navy), the one whose husband "gave her the chain and nothing else". Brings pensions to
 * Zinaida Petrovna's stairwell. Thread: the chain and the divorce (src/data/stories/threads). M6.
 */
export default {
  id: 'zhanna',
  name: 'Zhanna Kuzovkina',
  archetype: 'office',
  look: 'female_adult_11_b',
  temperament: 'flexible',
  knowledge: 0.4,
  desperation: 0.5,
  bio: 'Carries the post and the pensions round the canal blocks, sixty stairwells, nine with lifts that work. Rimma’s cousin, so you will already have heard about her husband, Vova, who gave her a gold chain in 1999 and nothing since but advice. Is leaving him. Has been leaving him for four years.',
  schedule: { from: 16, every: [14, 19] },
  pawn: 0.3,
  items: [
    { defId: 'gold_cross_585', weight: 2, provenance: 'heirloom', story: ['My confirmation cross. I believed until Vova. Now I believe in the post office, which at least arrives.'] },
    { defId: 'phone_severin_k1', weight: 2, provenance: 'unknown', story: ['Left in a letterbox on Kanatnaya with no note. Lost property sent it back to me. The post office is a circle.'] },
    { defId: 'gold_earrings_583', weight: 1, provenance: 'clean', story: ['I bought them myself, with my own bonus, the year Vova forgot my birthday. That’s the only story these have, and it’s enough.'] },
  ],
  lines: {
    first: ['Hello. Zhanna. I carry your post. You get bills, bills and once a postcard from somewhere hot. Rimma’s my cousin. She’s told you about Vova. Everything she said is true.'],
    again: ['Hello. Sixty stairwells today. Zinaida Petrovna gave me a pirozhok and a lecture. Cabbage.', 'Hello. Vova says he’s changed. He says it every spring, like the drawbridges.'],
    warm: ['Hello. I put your letters through the slot gently now. The bills too. They’re not your fault.', 'Hello. You and the post office: the two things on this canal that do what they say.'],
    cold: ['Hello. I deliver bad news for a living. I know it when I see it.', 'Just the figure, please. I have forty pensions in this bag and I’m not stopping long.'],
  },
} as const
