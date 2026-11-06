/**
 * Zhora: the one who stands, in the Protection arc (src/data/stories/protection.ts).
 * Few words, all of them literal. Arc-only: no ordinary visits.
 */
export default {
  id: 'zhora',
  name: 'Zhora',
  archetype: 'hustler',
  look: 'male_adult_11',
  temperament: 'stubborn',
  knowledge: 0.4,
  desperation: 0.05,
  bio: 'Eduard Lvovich’s colleague. Stands by the door. Was here before you were, asking for the last owner.',
  lines: {
    first: ['Gusev here?'],
    again: ['Me.'],
    warm: ['All right.'],
    cold: ['Still here.'],
  },
} as const
