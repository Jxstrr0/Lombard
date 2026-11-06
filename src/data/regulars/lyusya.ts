/** Lyusya Karavaeva: night-shift baker who pawns her gold before payday and redeems it after. */
export default {
  id: 'lyusya',
  name: 'Lyusya Karavaeva',
  archetype: 'tradesman',
  look: 'female_adult_09',
  temperament: 'desperate',
  knowledge: 0.3,
  desperation: 0.7,
  bio: 'Night shift at Bread Factory No. 4 on the Sukhov Canal. Pawns her gold the week before payday and buys it back the week after; her Tolik has been “between jobs” since 2011.',
  schedule: { from: 3, every: [8, 12] },
  pawn: 0.55,
  items: [
    {
      defId: 'gold_band_583',
      weight: 3,
      authenticity: 'genuine',
      provenance: 'clean',
      story: ['My wedding ring. Tolik won’t notice. Tolik doesn’t notice the fridge is empty.', 'The ring again. It knows the way here better than I do.'],
    },
    {
      defId: 'gold_earrings_583',
      weight: 2,
      authenticity: 'genuine',
      provenance: 'clean',
      story: ['My earrings. I’ll want them back for my sister’s birthday. That’s the ninth.'],
    },
    { defId: 'gold_bracelet_585', weight: 1, provenance: 'heirloom', story: ['My mother’s bracelet. Don’t look at me like that, I always come back.'] },
    { defId: 'gold_cross_585', weight: 1, provenance: 'clean', story: ['Mine, since I was a girl. Keep it for me; it’s safer here than at home.'] },
  ],
  lines: {
    first: ['Morning. I’ve just come off the night shift, so if I smell of bread, that’s why. If I smell of anything else, that’s Tolik.'],
    again: ['Me again. Payday’s Thursday. It’s always Thursday, and it’s never this Thursday.', 'Morning. Up since three. Don’t make me count, I’ll fall asleep on your glass.'],
    warm: ['I brought you a loaf. Still warm. Don’t tell the factory, they count the loaves.', 'Morning, love. You’re the only thing in my week that keeps its word.'],
    cold: ['Just write the ticket. I’ll be back for it, whatever you think of me.', 'The bank was nicer than you last time. And the bank is horrible.'],
  },
} as const
