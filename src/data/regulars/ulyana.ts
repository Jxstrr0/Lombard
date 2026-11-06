/** Ulyana Bortnik: able seaman on a cargo ship; port shopping, honest about her fakes. */
export default {
  id: 'ulyana',
  name: 'Ulyana Bortnik',
  archetype: 'sailor',
  look: 'female_adult_13',
  temperament: 'flexible',
  knowledge: 0.45,
  desperation: 0.35,
  bio: 'Able seaman on the dry-cargo ship Kapitan Melekhin. Comes ashore every few weeks with port shopping, and a daughter at her mother’s who calls her Auntie Ulya.',
  // Shore leave: every few weeks.
  schedule: { from: 6, every: [9, 13] },
  pawn: 0.15,
  items: [
    {
      defId: 'watch_omeca_aquastar',
      weight: 2,
      authenticity: 'fake',
      provenance: 'clean',
      story: ['It’s a fake. I know. Twenty euros in Rotterdam. But it’s a beautiful fake; look at it lie.'],
    },
    { defId: 'gold_rope_chain_585', weight: 2, provenance: 'clean', story: ['Port gold. The man in Istanbul swore on his mother. He had a lot of mothers.'] },
    { defId: 'phone_galaxia_stella4', weight: 2, story: ['Bought it in Antwerp for my girl. Now she wants a Mangosteen. Of course she does.'] },
    { defId: 'camera_kanon_ae2', weight: 1, story: ['Ship’s camera. The captain said take it. I think he meant to my cabin, but.'] },
    {
      defId: 'watch_vostok_komandirskie',
      weight: 1,
      story: ['Swapped the second engineer two bottles for this. Then he swapped it back. Then I won it at cards.'],
    },
  ],
  lines: {
    first: ['Ahoy, comrade pawnbroker! Ulyana. Twenty-six days at sea, two days ashore, and I’m spending one of them here.'],
    again: ['Back on dry land! It keeps not moving. It’s horrible.', 'Ahoy. Sonya called me Auntie Ulya again. My own daughter. Let’s do business before I cry.'],
    warm: [
      'I brought you Dutch biscuits. Half of them. The crossing was rough and I was hungry.',
      'Ahoy, friend! When I retire I’ll open a shop next to yours and sell fakes. Honestly labelled.',
    ],
    cold: ['I’ve dealt with port sharks from here to Lisbon. You’re not the worst. Close, though.', 'Quick one. My leave’s short and so is my temper.'],
  },
} as const
