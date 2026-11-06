/** Timofei Bodrov: payday-lender clerk on commission, pawning his own things to look successful. */
export default {
  id: 'timofei',
  name: 'Timofei Bodrov',
  archetype: 'office',
  look: 'business_male_06',
  temperament: 'desperate',
  knowledge: 0.3,
  desperation: 0.65,
  bio: 'Junior loan officer at Karman Credit, the payday lender by the metro. Paid on commission, which is to say not paid. Pawns his own things to look successful at work.',
  schedule: { from: 10, every: [7, 11] },
  pawn: 0.45,
  items: [
    { defId: 'watch_poljot_strela', weight: 2, story: ['Bought it to look successful for clients. Clients don’t look at watches. They look at the door.'] },
    { defId: 'phone_mangosteen_m5', weight: 2, story: ['Bought on credit. From us. I’m my own best customer.'] },
    { defId: 'gold_signet_583', weight: 1, story: ['A man at the market said a signet ring makes you look like old money. I look like new debt.'] },
    { defId: 'watch_omeca_aquastar', weight: 1, story: ['A diver’s watch. I’ve never dived. I am drowning, though, if that counts.'] },
  ],
  lines: {
    first: ['Good morning! Have you considered a fast, flexible… sorry. Habit. I’m here as a customer.'],
    again: ['Morning! Targets are up, I’m down. Can you hold this till the fifteenth?', 'Hello again. My manager says “smile through the no’s”. I’m smiling. Look.'],
    warm: [
      'I talked a pensioner out of our loan today and sent her to you instead. I might get fired. Felt wonderful.',
      'Morning! I’m thinking of quitting. Don’t say anything. Actually, say something.',
    ],
    cold: ['Your rate’s worse than ours, and ours is criminal.', 'Let’s just sign. I know how this works. I do it to people all day.'],
  },
} as const
