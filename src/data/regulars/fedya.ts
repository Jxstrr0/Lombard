/** Fedya Ryabov: The Student's Laptop (src/data/stories/laptop.ts). Comes in only for his arc. */
export default {
  id: 'fedya',
  name: 'Fedya Ryabov',
  archetype: 'student',
  look: 'male_adult_06',
  temperament: 'flexible',
  knowledge: 0.45,
  desperation: 0.6,
  bio: 'Final year at the Polytechnic, curly hair, one laptop and a lot of deadlines. Rents a room by the tram depot.',
  pawn: 1,
  items: [],
  lines: {
    first: ['Hi. I’ve never been in here before. It smells like old radios.'],
    again: ['Hi. It’s Fedya. The laptop guy.'],
    warm: ['Hi! I told my flatmates about you. Now they want to pawn the kettle.'],
    cold: ['Hi. I’ll be quick.'],
  },
} as const
