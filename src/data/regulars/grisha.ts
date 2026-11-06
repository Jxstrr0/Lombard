/**
 * Grisha Zubov: Zhora's older brother, six years inside for something with a car he no
 * longer talks about, out and washing other people's cars on Kirpichny Lane. The same face
 * as Zhora (the same look, a work-blue shirt instead of black): that is the point. Thread:
 * going straight while his brother's friends want him back (src/data/stories/threads),
 * which reads the Protection arc's flags. M6.
 */
export default {
  id: 'grisha',
  name: 'Grisha Zubov',
  archetype: 'tradesman',
  look: 'male_adult_11_b',
  temperament: 'proud',
  knowledge: 0.45,
  desperation: 0.5,
  bio: 'Out since the autumn after six years in a colony near Kotlas. Washes cars on Kirpichny Lane for cash, goes to a meeting on Tuesdays, rings his probation officer on Thursdays. Zhora’s older brother. Asks you not to hold that against either of them.',
  schedule: { from: 18, every: [14, 20] },
  pawn: 0.2,
  items: [
    { defId: 'watch_vostok_komandirskie', weight: 2, provenance: 'clean', story: ['My watch. They gave it back to me at the gate with my belt and my laces. It stopped the day I went in and started again the day I came out. I wound it, but still.'] },
    { defId: 'phone_severin_k1', weight: 2, provenance: 'clean', story: ['A phone. Push-button. The officer says no smartphones for now. I don’t mind. Nobody I want to talk to has one.'] },
    { defId: 'gold_band_583', weight: 1, provenance: 'heirloom', story: ['Our father’s ring. Zhora wanted it. Mum gave it to me. Maybe that’s why he went the way he went. Maybe not.'] },
  ],
  lines: {
    first: ['Good afternoon. Grisha. You’ve met my brother, I think. Big, quiet, stands by doors. I’m the other one. I’d like to sell something. Legally. I have a receipt for my own watch.'],
    again: ['Afternoon. Washed nineteen cars yesterday. A Mercedes tipped me fifty roubles and a lecture.', 'Afternoon. Tuesday meeting tonight. We sit in a circle and drink tea and don’t do things. It’s harder than it sounds.'],
    warm: ['Afternoon. You treat me like a customer. You don’t know what that’s worth. I do.', 'Afternoon. I told the officer I have a regular place now, an honest one. She wrote it down. That’s a first, her writing down something good.'],
    cold: ['Afternoon. I know that price. I paid prices like that inside.', 'I’ll be quick. I know when I’m not wanted; I had six years of practice.'],
  },
} as const
