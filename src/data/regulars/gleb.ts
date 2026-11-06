/** Gleb Svirelin: tax inspector and weekend poet, selling his grandfather's things to print a book. */
export default {
  id: 'gleb',
  name: 'Gleb Svirelin',
  archetype: 'office',
  look: 'male_adult_02',
  temperament: 'proud',
  knowledge: 0.4,
  desperation: 0.55,
  bio: 'Tax inspector on weekdays, poet at weekends. Selling his grandfather’s things one by one to print three hundred copies of “Drawbridges at Two in the Morning”.',
  // Weekends only (5 = Saturday, 6 = Sunday): weekdays belong to the inspectorate.
  schedule: { from: 6, every: [7, 10], weekdays: [5, 6] },
  pawn: 0.3,
  items: [
    {
      defId: 'medal_combat_merit',
      weight: 2,
      provenance: 'heirloom',
      story: ['Grandfather’s. He never spoke about it. I wrote a poem about him never speaking about it. It’s quite long.'],
    },
    { defId: 'gold_signet_583', weight: 1, provenance: 'heirloom', story: ['Grandfather’s ring. I have the hands of a poet; it slides off.'] },
    { defId: 'coin_rouble_1877', weight: 2, provenance: 'heirloom', story: ['From Grandfather’s cigar box. He didn’t smoke. He just liked the box.'] },
    { defId: 'watch_pobeda_gold', weight: 0.5, provenance: 'heirloom', story: ['His wedding watch. I’ve been putting this one off. It rhymes with nothing, too.'] },
  ],
  lines: {
    first: ['Good day. Gleb. I’m with the tax inspectorate, but not today. Today I’m a poet with a cash-flow problem.'],
    again: ['Hello. Sixty more copies paid for. Two hundred and forty to go.', 'Good day. I audited a bakery this week. Everyone cried, including me.'],
    warm: [
      'I wrote you a stanza: “Behind the glass, a fair man weighs the past.” Work in progress. The “man” is negotiable.',
      'The printer says Thursday! You’ll get a signed copy. You’ll be the second person to own one, after my mother.',
    ],
    cold: ['You’ll be in my next book. Not on a page you’ll enjoy.', 'I audit people professionally. I’m auditing you now.'],
  },
} as const
