/** Nika Asante: insurance claims assessor who tests your appraisals; saving for a flat. */
export default {
  id: 'nika',
  name: 'Nika Asante',
  archetype: 'office',
  look: 'business_female_01',
  temperament: 'stubborn',
  knowledge: 0.75,
  desperation: 0.15,
  bio: 'Assesses losses for Bastion Insurance and judges everyone else’s appraisals for free. Her father came from Accra to study bridges and stayed for her mother. Saving for a flat; the bank keeps losing her papers.',
  schedule: { from: 8, every: [9, 13] },
  pawn: 0.1,
  items: [
    {
      defId: 'watch_omeca_aquastar',
      weight: 1,
      story: ['A present from a man who said he was in shipping. I think the watch is about as real as he was. You tell me.'],
    },
    { defId: 'camera_kanon_ae2', weight: 2, story: ['I photographed burst pipes with this for six years. It’s seen more flooded kitchens than any plumber.'] },
    { defId: 'phone_galaxia_nota3', weight: 2, story: ['The office upgraded us. The old one is mine to sell; I checked the policy. Twice.'] },
    { defId: 'gold_bracelet_585', weight: 1, story: ['My mother’s. She wants a new kitchen more than a bracelet. I’ve assessed her priorities.'] },
  ],
  lines: {
    first: ['Good morning. Nika Asante. I assess losses for a living. Let’s see how you assess.'],
    again: ['Morning. A man told me this week his dog ate a television. Go on, surprise me less.', 'Hello. The bank lost my mortgage papers again. Third time. I’m starting to take it personally.'],
    warm: [
      'You’d make a decent assessor. Don’t take that lightly; I’ve never said it to an assessor.',
      'Hello! I signed for the flat. Two rooms and a view of a wall. My father cried.',
    ],
    cold: ['Morning. I’ve written down what this is worth. Let’s compare notes.', 'I’ll be checking your figure against three others. Just so you know.'],
  },
} as const
