/**
 * Dilnoza Rakhimova: runs the Produkty kiosk at the tram stop (samsa, cigarettes, everything),
 * Bakhtiyor's wife. Pawns her gold when the wholesale bill comes. Thread: the council's
 * letter about the kiosks (src/data/stories/threads). M6.
 */
export default {
  id: 'dilnoza',
  name: 'Dilnoza Rakhimova',
  archetype: 'tradesman',
  look: 'female_adult_06',
  temperament: 'stubborn',
  knowledge: 0.7,
  desperation: 0.3,
  bio: 'Runs the Produkty kiosk at the No. 9 tram stop, six till midnight: samsa she bakes at home, cigarettes, batteries, advice. Knows what everyone on the street buys and what it says about them. Pawns her wedding gold when the wholesale bill lands, and always comes back for it.',
  schedule: { from: 16, every: [14, 19] },
  pawn: 0.7,
  items: [
    { defId: 'gold_bracelet_585', weight: 2, authenticity: 'genuine', provenance: 'heirloom', story: ['My mother’s bracelet, from my wedding. In our family gold is not jewellery, it is a bank account you can wear. I am withdrawing.'] },
    { defId: 'gold_earrings_583', weight: 2, provenance: 'heirloom', story: ['Wedding earrings. The wholesaler wants cash on Monday and my customers pay me on Friday. Between Monday and Friday, you keep them.'] },
    { defId: 'gold_rope_chain_585', weight: 1, provenance: 'heirloom', story: ['This chain I wear under everything. Now it waits with you. Weigh it in front of me, please. I know what it weighs.'] },
  ],
  lines: {
    first: ['Good morning. Dilnoza, from the kiosk. You buy your cigarettes from me. No? Then you buy your matches. I know everyone. Now I know you.'],
    again: ['Good morning. The wholesaler raised the samsa flour again. I told him his flour is like his jokes: heavy and old.', 'Good morning. I have twenty minutes. My neighbour is minding the kiosk and she gives too much change.'],
    warm: ['Good morning, neighbour. For you I keep the last samsa every day, so if you don’t come, I eat it. Come more often; I am getting fat.', 'Good morning. I tell everyone at the stop: the pawnbroker is fair. They don’t believe me. They will.'],
    cold: ['Good morning. You will weigh it in front of me this time. Slowly.', 'I came. I don’t have to like it.'],
  },
} as const
