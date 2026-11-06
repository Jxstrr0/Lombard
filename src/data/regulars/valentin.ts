/** Valentin Egorovich: retired tram driver selling his coin doubles. Weekly. */
export default {
  id: 'valentin',
  name: 'Valentin Egorovich',
  archetype: 'pensioner',
  look: 'business_male_04',
  temperament: 'stubborn',
  knowledge: 0.55,
  desperation: 0.4,
  bio: 'Drove the No. 9 tram for thirty-one years. Sells the doubles from his coin collection for his wife’s heart pills and tells her they were worthless.',
  schedule: { from: 3, every: [6, 8] },
  pawn: 0.15,
  items: [
    {
      defId: 'coin_olympiad_10r',
      weight: 3,
      story: ['From the Olympiad set. I have two of this one. Nobody needs two Olympiads.', 'Bought it in eighty with my first bonus. Lyuba said I was mad. She was right, but look at it.'],
    },
    {
      defId: 'coin_poltinnik_1924',
      weight: 2,
      story: ['A blacksmith on the back. A real worker, not like the ones they put on money now.', 'Found it in the fare box in seventy-nine. I put in my own fifty kopecks for it. Honest swap.'],
    },
    { defId: 'coin_rouble_1877', weight: 1, story: ['The Tsar’s rouble. Lyuba thinks it’s a button off my good coat. Let her think it.'] },
    { defId: 'coin_chervonets_sower', weight: 0.5, story: ['The Sower. Gold. I’ve had him longer than my own teeth. Not a word to my wife.'] },
  ],
  lines: {
    first: ['Good morning. Valentin Egorovich. Thirty-one years on the No. 9 tram, so I know a crooked face when I see one. Let’s see yours.'],
    again: ['Next stop, your counter. Morning.', 'Me again. The pills went up eighty roubles. Eighty! For pills!', 'Morning. Lyuba thinks I’m at the dominoes.'],
    warm: [
      'There’s my favourite stop on the whole line. Morning, conductor.',
      'I told the lads at the dominoes table you count honest. Now they’ll all come in. Sorry about that.',
      'Lyuba’s heart is better. I told her the doctor did it. It was you, a bit.',
    ],
    cold: ['Morning. Count it twice. I will.', 'I drove a tram thirty years. I know when someone’s short-changing the fare box.'],
  },
} as const
