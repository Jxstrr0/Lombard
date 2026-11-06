/**
 * Alyona Zharkova: bank teller on maternity leave, a baby on her hip and a husband on a
 * thirty-day shift at a gas field in the north. The loans thread: her wedding ring, and
 * asking to pay only the interest (src/data/stories/threads). M6.
 */
export default {
  id: 'alyona',
  name: 'Alyona Zharkova',
  archetype: 'office',
  look: 'female_adult_01',
  temperament: 'desperate',
  knowledge: 0.55,
  desperation: 0.65,
  bio: 'Counted other people’s money at the Kanal savings bank until Mishutka arrived; now counts nappies. Her husband Dima works thirty days on, thirty off at a gas field past Novy Urengoy, and the transfer is always three days late. Explains compound interest to the baby.',
  schedule: { from: 15, every: [14, 19] },
  pawn: 0.75,
  items: [
    { defId: 'gold_earrings_583', weight: 2, provenance: 'clean', story: ['Dima’s present when Mishutka was born. He’ll be back in two weeks. Not the earrings. Dima. Well, both.'] },
    { defId: 'phone_galaxia_stella4', weight: 2, provenance: 'clean', story: ['My old phone, from the bank. I don’t need two phones now; nobody calls me but the clinic and my mother.'] },
    { defId: 'gold_cross_585', weight: 1, provenance: 'heirloom', story: ['Grandmother’s cross. I’m pawning it, not selling. I know the difference; I used to explain it to customers. Thirty days, yes?'] },
  ],
  lines: {
    first: ['Hello. Sorry, he’s asleep, if I whisper he stays asleep. Alyona. I worked at the savings bank on Kanal. I know what a fair rate is, so let’s both be fair.'],
    again: ['Hello. Shh. He’s asleep. I’ve got eleven minutes. That’s the record.', 'Hello. The transfer from the north is late again. Three days. Always three days. Somebody somewhere is earning interest on my husband.'],
    warm: ['Hello. Look who it is, Mishutka. That’s the nice one. Say hello. He says hello; that was a hello.', 'Hello. You’re the only person this month who did sums with me instead of at me.'],
    cold: ['Hello. I’ll read the ticket carefully this time. Every line.', 'Let’s keep it short. He’ll wake up, and so will I.'],
  },
} as const
