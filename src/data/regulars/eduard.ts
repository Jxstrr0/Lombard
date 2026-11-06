/**
 * Eduard Lvovich: the one who talks, in the Protection arc (src/data/stories/protection.ts).
 * Polite, warm, never in a hurry, calls himself by his patronymic as a joke he means.
 * Arc-only: no ordinary visits.
 */
export default {
  id: 'eduard',
  name: 'Eduard Lvovich',
  archetype: 'hustler',
  look: 'male_adult_20',
  temperament: 'proud',
  knowledge: 0.8,
  desperation: 0.05,
  bio: 'Looks after the street for people who don’t come in person. Says please. Remembers everything.',
  lines: {
    first: ['Good afternoon. Don’t get up.'],
    again: ['Only me. Carry on, carry on.'],
    warm: ['There he is. How’s business? Good. Good for everyone.'],
    cold: ['I’ll wait. I don’t mind waiting. Zhora minds a little.'],
  },
} as const
