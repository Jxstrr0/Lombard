/**
 * Kira Bessonova: deals cards at the back room behind the old Avrora cinema, which pays the
 * same "gentlemen" as everyone else. Sells what winners tip her and losers leave. Thread:
 * getting out (src/data/stories/threads), which reads the Protection arc's flags. M6.
 */
export default {
  id: 'kira',
  name: 'Kira Bessonova',
  archetype: 'hustler',
  look: 'female_party_02',
  temperament: 'stubborn',
  knowledge: 0.8,
  desperation: 0.2,
  bio: 'Deals blackjack six nights a week in the back room of the old Avrora cinema, the one with no sign and a man on the door. Sells what the winners tip her and what the losers leave as security. Counts faster than you. Wants to open a dance school; tells nobody.',
  schedule: { from: 21, every: [15, 21] },
  pawn: 0.05,
  items: [
    { defId: 'gold_signet_583', weight: 2, provenance: 'unknown', story: ['A man put this on the table instead of cash. Then he lost. Then he left. The house keeps the cash; I keep what isn’t cash.'] },
    { defId: 'watch_pobeda_gold', weight: 1, provenance: 'unknown', story: ['A winner’s tip. He was happy for about ten minutes, which is the average.'] },
    { defId: 'gold_bracelet_585', weight: 1, provenance: 'unknown', story: ['Left as security on a debt. The debt left town. The bracelet didn’t.'] },
    { defId: 'phone_galaxia_nota3', weight: 1, provenance: 'unknown', story: ['Phones on the table are a bad sign. This one was the worst sign of the night.'] },
  ],
  lines: {
    first: ['Evening. Morning. Whichever. Kira. I work nights at a place that doesn’t exist, and I sell what people leave there. You’ll want to look at it closely. I would.'],
    again: ['Morning. I dealt nine hours. My hands still shuffle in my sleep.', 'Morning. House always wins. I’m not the house. I just stand next to it.'],
    warm: ['Morning. You’re the only person I talk to who isn’t trying to win something off me.', 'Morning. If you ever see a man in a good coat losing in my room, I’ll tell him to sell his watch here. You’re welcome.'],
    cold: ['Morning. I know what that piece is worth to the rouble. So do you.', 'Let’s not pretend. Number.'],
  },
} as const
