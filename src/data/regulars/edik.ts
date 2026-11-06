/** Edik Sorokin: The Dubai Rolex Guy (src/data/stories/rolex.ts). */
export default {
  id: 'edik',
  name: 'Edik Sorokin',
  archetype: 'hustler',
  look: 'business_male_05',
  temperament: 'flexible',
  knowledge: 0.75,
  desperation: 0.25,
  bio: 'Charcoal suit, purple shirt, a friend in Dubai who sends him watches. The watches are fake. The friend might be real.',
  // His arc carries the first month or so; after that he keeps dropping in with whatever Dubai sent.
  schedule: { from: 45, every: [12, 20] },
  pawn: 0.2,
  items: [
    {
      defId: 'watch_rolland_abyssal',
      weight: 2,
      authenticity: 'fake',
      provenance: 'unknown',
      story: ['My friend in Dubai sent another one. I’m obliged to offer it to you first. Friendship has duties.', 'Dubai. Duty free. You know the story by now, so I’ll skip to the part where you buy it.'],
    },
    {
      defId: 'watch_omeca_aquastar',
      weight: 1,
      authenticity: 'fake',
      provenance: 'unknown',
      story: ['An Omeca. Divers wear these. I wore it in the shower. Nothing happened, so it works.'],
    },
    {
      defId: 'watch_vostok_komandirskie',
      weight: 1,
      authenticity: 'genuine',
      provenance: 'unknown',
      story: ['This one is not from Dubai. It’s from my father’s drawer. Don’t tell him, he thinks he lost it in 1998.'],
    },
  ],
  lines: {
    first: ['Good morning, my friend! Edik. Remember the name. Everybody does, eventually.'],
    again: ['My friend! You missed me. Don’t lie, it’s bad for business.', 'Edik is here. The shop can relax now.'],
    warm: ['My favourite shopkeeper in Mostograd. Top three, at least.', 'I told everyone at the café about you. Nobody cared, but I told them.'],
    cold: ['I know, I know. Just look. Looking is free.', 'You’re making the face already. I haven’t even opened my hand.'],
  },
} as const
