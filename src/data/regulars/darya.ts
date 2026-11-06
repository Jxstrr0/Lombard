/** Darya Grebneva: rower and sports student, saving for the regionals. */
export default {
  id: 'darya',
  name: 'Darya Grebneva',
  archetype: 'student',
  look: 'sports_female_02',
  temperament: 'stubborn',
  knowledge: 0.35,
  desperation: 0.45,
  bio: 'Rows for the Krasny Vympel club on the canal. Third year at the Institute of Physical Culture, saving for the regional championships and a knee that works.',
  schedule: { from: 6, every: [8, 12] },
  pawn: 0.2,
  items: [
    { defId: 'watch_vostok_komandirskie', weight: 3, story: ['Dad’s. He says it’s waterproof. I tested it. It’s waterproof to about one capsize.'] },
    { defId: 'gold_rope_chain_585', weight: 2, story: ['From my ex. He said it was eighteen carat. He also said he’d come to my finals.'] },
    { defId: 'phone_galaxia_nota3', weight: 2, story: ['Prize from the spring regatta. I already have a phone. I need a physio more.'] },
    { defId: 'camera_zenit_e', weight: 1, story: ['My coach shot our starts on this. One frame a second. We looked fast.'] },
  ],
  lines: {
    first: ['Hi. Darya. I’ve got twenty minutes before training. Go.'],
    again: ['Back. Ten seconds to look, ten seconds for a number. Splits.', 'Morning. Knee’s bad, mood’s worse. What can I get for this?'],
    warm: ['Hey! We took silver! You’re a tiny bit on that medal, you know.', 'Hi. I told the girls in the boat about you. They think you’re a myth.'],
    cold: ['Make it quick. I don’t like losing, even at a counter.', 'Last time I rowed home angry. Two kilometres. Upstream.'],
  },
} as const
