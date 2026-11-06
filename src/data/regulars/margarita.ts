/**
 * Margarita Vdovina: the "widow" whose late husband's things are suspiciously
 * new (GDD §5). Near-mint condition, provenance unknown or stolen; the husband
 * changes job between visits. No crime mechanics here: what buying from her
 * costs arrives with the crime layer (M5).
 */
export default {
  id: 'margarita',
  name: 'Margarita Vdovina',
  archetype: 'hustler',
  look: 'business_female_04',
  temperament: 'flexible',
  knowledge: 0.7,
  desperation: 0.2,
  bio: 'In mourning, in a pinstripe suit. Brings in her late husband’s things; he was a sea captain, or a surgeon, or in import-export. Everything he owned is very new.',
  schedule: { from: 5, every: [5, 8] },
  pawn: 0.05,
  items: [
    {
      defId: 'phone_mangosteen_m5',
      weight: 3,
      authenticity: 'genuine',
      provenance: 'unknown',
      condition: [95, 99],
      story: ['His phone. He barely used it. The film’s still on the screen; he was a careful man.'],
    },
    {
      defId: 'gold_bracelet_585',
      weight: 2,
      authenticity: 'genuine',
      provenance: 'stolen',
      condition: [92, 99],
      story: ['He gave me this on our anniversary. Our last one. Last month.'],
    },
    {
      defId: 'gold_rope_chain_585',
      weight: 2,
      authenticity: 'genuine',
      provenance: 'stolen',
      condition: [90, 99],
      story: ['Leonid’s chain. Or was this one Arkasha’s? Grief does things to the memory.'],
    },
    {
      defId: 'camera_kanon_ae2',
      weight: 1,
      authenticity: 'genuine',
      provenance: 'unknown',
      condition: [90, 99],
      story: ['His camera. He loved photographing… the sea. Ships. Things.'],
    },
    {
      defId: 'watch_omeca_aquastar',
      weight: 1,
      authenticity: 'genuine',
      provenance: 'unknown',
      condition: [93, 99],
      story: ['He was a captain, you know. He wore this to the bottom of the sea. Well. Nearly.', 'His watch. He hardly wore it. Hardly had the time, God rest him.'],
    },
    { defId: 'watch_brequet_classique', weight: 0.5, provenance: 'unknown', story: ['He was a surgeon. Surgeons wear gold. It’s in the oath.'] },
  ],
  lines: {
    first: ['Good morning. Margarita Vdovina. Yes, like the word for widow. Life has a sense of humour. My husband passed, recently, and I’m clearing his things.'],
    again: [
      'Good morning. More of my husband’s things. He had so many. He was a generous man, to himself.',
      'Morning. Another little memory. I’d rather it went to someone who appreciates it. And pays.',
    ],
    warm: ['You never ask questions. My husband would have liked you. Any of them.', 'Darling. I’ll only deal with you from now on. The others get so nosy.'],
    cold: ['I can take my late husband’s things elsewhere, you know. He had a lot of friends in other shops.', 'Careful. I’ve buried better negotiators.'],
  },
} as const
