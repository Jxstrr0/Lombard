/**
 * Snezhana Lapina: nails by day at a salon on Kanatnaya, karaoke at Bridge Bar by night,
 * evening course at the culture college; saving for a televised singing contest in Moscow.
 * Thread: the audition (src/data/stories/threads). M6.
 */
export default {
  id: 'snezhana',
  name: 'Snezhana Lapina',
  archetype: 'student',
  look: 'female_party_01',
  temperament: 'flexible',
  knowledge: 0.3,
  desperation: 0.5,
  bio: 'Does nails by day two doors from Rimma’s salon (Rimma has views), hosts karaoke at Bridge Bar four nights a week, and studies vocals at the culture college in the evenings. Is going to be on television. Has decided.',
  schedule: { from: 13, every: [15, 21] },
  pawn: 0.45,
  items: [
    { defId: 'phone_mangosteen_m4s', weight: 2, provenance: 'clean', story: ['My phone. My backing tracks are on it, so I need it back before Friday. Before Thursday. I’ll come Wednesday.'] },
    { defId: 'gold_earrings_583', weight: 2, provenance: 'unknown', story: ['A man at karaoke gave me these after I sang Alla Borisovna. He cried. Then he went back to his wife. The earrings stayed.'] },
    { defId: 'gold_cross_585', weight: 1, provenance: 'heirloom', story: ['My christening cross. Mum says never sell it. I’m not selling it, I’m lending it to you. That’s different, isn’t it? Say it’s different.'] },
  ],
  lines: {
    first: ['Hiii. Snezhana, Snezha. I do nails at Lak, by Rimma’s, and I sing at Bridge Bar, so if you hear Alla Borisovna through the wall on a Thursday, that’s me.'],
    again: ['Hi! I hit the high note last night. The whole bar went quiet. Then the barman dropped a tray. Art.', 'Hi. My teacher says I sing from the throat. I said where else is there.'],
    warm: ['Hi, my favourite! When I’m on television I’ll say hello to you. Not by name. I’ll say “the canal”. You’ll know.', 'Hi! I did your shop’s name in glitter on my thumbnail. Look. No, look properly.'],
    cold: ['Hi. Just do the number. I’ve got a client with wet nails.', 'Rimma says you’re fair. Rimma says a lot.'],
  },
} as const
