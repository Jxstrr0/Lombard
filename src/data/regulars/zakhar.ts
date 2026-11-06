/**
 * Zakhar Svirelin: Gleb's older brother (the same look, greyer, in a maroon sweater), a
 * candidate master who coached at the Pioneer Palace until it closed and now plays the
 * tourists for money on the benches by the Lion Bridge. Thread: the game, and the poetry
 * book (src/data/stories/threads). M6.
 */
export default {
  id: 'zakhar',
  name: 'Zakhar Svirelin',
  archetype: 'hustler',
  look: 'male_adult_02_b',
  temperament: 'flexible',
  knowledge: 0.75,
  desperation: 0.3,
  bio: 'Candidate master of sport, coached chess at the Pioneer Palace for twenty years until they made it a wedding venue. Now plays blitz for a hundred roubles a game on the benches by the Lion Bridge and loses exactly often enough. Gleb’s older brother; went grey for both of them.',
  schedule: { from: 20, every: [14, 20] },
  pawn: 0.1,
  items: [
    { defId: 'coin_poltinnik_1924', weight: 2, provenance: 'unknown', story: ['A Finnish tourist bet this against my hundred roubles. He played the Sicilian. Nobody should play the Sicilian against me on a Tuesday.'] },
    { defId: 'watch_pobeda_gold', weight: 1, provenance: 'unknown', story: ['A gentleman from Moscow bet his watch on a queen sacrifice. I accepted the sacrifice. And the watch.'] },
    { defId: 'phone_mangosteen_m5', weight: 1, provenance: 'unknown', story: ['A young man bet this. He said he was a club player. He was a club player the way I am a ballerina.'] },
    { defId: 'coin_olympiad_10r', weight: 1, provenance: 'clean', story: ['My prize from the city junior championship, 1980. I came second. The boy who came first sells cars now. Who won?'] },
  ],
  lines: {
    first: ['Good afternoon. Svirelin, Zakhar. Yes, like Gleb. I’m the brother who stayed in the family business, which is losing gracefully. Except I don’t.'],
    again: ['Afternoon. I played eleven games before lunch. Lost two, on purpose. Business is about trust.', 'Afternoon. The pigeons on the Lion Bridge know my openings. They walk off before the endgame.'],
    warm: ['Afternoon. Of everyone on this canal, you’re the one I’d never hustle. I haven’t decided if that’s a compliment.', 'Afternoon. If Gleb asks, I was never here, and I never paid for anything.'],
    cold: ['Afternoon. You played that last one like a club player. I’ll adjust.', 'Afternoon. Let’s keep the clock running. Your move.'],
  },
} as const
