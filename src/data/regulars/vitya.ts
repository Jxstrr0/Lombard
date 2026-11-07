/**
 * Vitya Gruzdev: lift mechanic, Ruslan's younger brother (the same look, the hoodie in the
 * boy's team red), hockey father of Lyova, age eleven, a goalkeeper. Everything goes on ice
 * time and pads. Thread: the tournament (src/data/stories/threads). M6.
 * M6 items wave C: the sports category brought his natural items, Lyova's outgrown kit.
 */
export default {
  id: 'vitya',
  name: 'Vitya Gruzdev',
  archetype: 'tradesman',
  look: 'male_adult_17_b',
  temperament: 'flexible',
  knowledge: 0.4,
  desperation: 0.45,
  bio: 'Mends lifts in the Soviet blocks of the outer ring, which keeps him in work for ever. Ruslan’s younger brother. His son Lyova keeps goal for Mostovik Under-12, and every rouble goes on ice time, pads that fit for a month, and the bus to away games.',
  schedule: { from: 17, every: [14, 19] },
  pawn: 0.3,
  items: [
    // M6 items wave C: Lyova's outgrown kit (bought new, so clean; never heirlooms).
    { defId: 'skates_ledokol_hockey', weight: 2, provenance: 'clean', story: ['Lyova’s skates. He grew two sizes over the winter break. The skates didn’t. Sharpened, ready to go.'] },
    { defId: 'mask_ledokol_goalie', weight: 1, provenance: 'clean', story: ['Lyova’s old mask. Voronin painted it, the one who does the Burlaki goalies. Now his head’s too big for it. In every sense.'] },
    { defId: 'stick_ledokol_composite', weight: 1, provenance: 'clean', story: ['Not Lyova’s: goalies use a different stick. This one’s mine. I played in the veterans’ league twice. Twice was enough.'] },
    { defId: 'phone_galaxia_nota3', weight: 2, provenance: 'clean', story: ['My phone. I film every game on it. I’ve backed it up. Lyova checked. Lyova checks everything; he’s a goalkeeper.'] },
    { defId: 'watch_poljot_strela', weight: 1, authenticity: 'genuine', provenance: 'heirloom', story: ['Grandad’s chronograph. He timed the trams with it. Lyova times his reactions with it. New pads cost more than the reactions.'] },
    { defId: 'camera_kanon_ae2', weight: 1, provenance: 'clean', story: ['I bought it to photograph Lyova’s games. Then he told me film cameras are embarrassing. He’s eleven. He knows everything.'] },
    { defId: 'gold_rope_chain_585', weight: 1, provenance: 'clean', story: ['Bought it when I was twenty and thought I was somebody. Now I’m somebody’s dad. It doesn’t suit dads.'] },
  ],
  lines: {
    first: ['Morning. Vitya. Ruslan’s brother; we’ve got the same chin, people say. I fix lifts. My son plays hockey. Those two sentences explain why I’m here.'],
    again: ['Morning. Lyova let in two goals and saved forty. I only talk about the forty.', 'Morning. I was stuck in a lift I was mending for forty minutes. Good time to think. I thought: sell something.'],
    warm: ['Morning! Lyova asked if you’d come and watch a game. I said you work. He said so does the goalkeeper.', 'Morning. Ruslan says you’re straight. Ruslan never says that about anyone, so it was a shock.'],
    cold: ['Morning. I’ll take the price. I don’t have to say thank you.', 'Morning. Ruslan says you’re straight. I’m going to say we’ll see.'],
  },
} as const
