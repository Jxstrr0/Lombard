/**
 * Jamshid Rakhimov: Bakhtiyor's young cousin, first year on the site, everything goes home
 * to his mother. Looks like Bakhtiyor (the same look, recoloured: slate grey instead of
 * white). Thread: the foreman's "Monday" (src/data/stories/threads). M6.
 */
export default {
  id: 'jamshid',
  name: 'Jamshid Rakhimov',
  archetype: 'tradesman',
  look: 'male_adult_15_b',
  temperament: 'desperate',
  knowledge: 0.25,
  desperation: 0.7,
  bio: 'Bakhtiyor’s cousin, twenty-two, first winter in Mostograd and first winter anywhere. Carries bricks on the embankment site, sleeps in a cabin with eleven men, sends every rouble home to his mother in Urgut. Everyone says he looks like Bakhtiyor. He says Bakhtiyor looks like him.',
  schedule: { from: 24, every: [15, 21] },
  pawn: 0.5,
  items: [
    { defId: 'phone_severin_k1', weight: 3, provenance: 'clean', story: ['My telephone. It only calls. My mother only answers, so it is enough. But the foreman has not paid, so.'] },
    { defId: 'phone_galaxia_stella4', weight: 1, provenance: 'unknown', story: ['I bought this at the market from a man. He said it was his. Bakhtiyor says ask the pawnbroker before you believe a man at a market.'] },
    { defId: 'watch_vostok_komandirskie', weight: 1, provenance: 'heirloom', story: ['My grandfather’s army watch. He served in Kazakhstan, in the snow. He said Russia is cold, take the watch, it knows the way.'] },
  ],
  lines: {
    first: ['Hello. Good day. I am Jamshid, Bakhtiyor’s brother. Cousin. Brother, in our way. He said you don’t cheat. Please don’t cheat; I am new.'],
    again: ['Good day. Is it cold every day here, or only when I go outside?', 'Good day. The foreman says Monday. Every week he says Monday.'],
    warm: ['Good day, aka. I told my mother about you on the phone. She says you must eat more. She says it to everyone, but she means it for you.', 'Good day. I learned a new Russian word: “advance”. Then I learned it doesn’t happen.'],
    cold: ['Good day. Bakhtiyor says I should go to the other shop now. I came here anyway. Once.', 'Please. Just the price.'],
  },
} as const
