/**
 * Zoya Chernykh: tattooist at Igla on Sennaya, Yana's older sister (the same look, a black tee,
 * oxblood hair). The crew's younger men get their tattoos at Igla and talk in the chair.
 * Thread: what she hears (src/data/stories/threads), which reads the Protection arc. M6.
 */
export default {
  id: 'zoya',
  name: 'Zoya Chernykh',
  archetype: 'tradesman',
  look: 'female_adult_08_b',
  temperament: 'stubborn',
  knowledge: 0.6,
  desperation: 0.25,
  bio: 'Tattoos people at Igla, a basement studio on Sennaya with one chair and a cat called Sterile. Yana’s older sister, equally deadpan, louder hair. Half the district’s anchors and roses are hers, and the young men who work for the “insurance” people sit in her chair and talk, because people tell their tattooist everything.',
  schedule: { from: 23, every: [15, 21] },
  pawn: 0.15,
  items: [
    { defId: 'gold_rope_chain_585', weight: 2, provenance: 'unknown', story: ['A client paid in gold. A tiger, back piece, nine sessions. He said the chain was his grandmother’s. His grandmother had good taste in chains and bad taste in grandsons.'] },
    { defId: 'camera_kanon_ae2', weight: 1, provenance: 'clean', story: ['I photographed my work with it before phones. Yana says it’s a crime to sell it. Yana thinks everything with film in it is sacred.'] },
    { defId: 'phone_galaxia_nota3', weight: 1, provenance: 'unknown', story: ['A client left it as a deposit for a sleeve. He never came back for the sleeve. Commitment issues; I see them a lot.'] },
  ],
  lines: {
    first: ['Hi. Zoya. Yana’s sister. Yes, the hair is real; the colour isn’t. I tattoo people. You don’t have any tattoos. I can tell. Your loss.'],
    again: ['Hi. Did a swallow, two roses and a man’s ex-wife’s name I had to turn into a dragon.', 'Hi. Sterile the cat sends regards. He doesn’t. He’s a cat.'],
    warm: ['Hi. If you ever want a tattoo, first one’s free. I’ll do a little pawn-shop sign. Three balls. Tasteful.', 'Hi. You’re all right. I say that about maybe four people.'],
    cold: ['Hi. I draw on skin for a living. I know a bad line when I see one.', 'Number, please. I have a client coming who cries.'],
  },
} as const
