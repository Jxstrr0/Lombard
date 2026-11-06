/**
 * Yevstafy Lukich Brashpilev: the retired navy engineer selling his instruments
 * one at a time (GDD §5). There is no instruments category yet, so his
 * "instruments" are the precision pieces that exist: the navigator's
 * chronograph, an issued watch, the ship photographer's camera and lens, and
 * (rarely) his own decorations. Weekly.
 */
export default {
  id: 'yevstafy',
  name: 'Yevstafy Lukich',
  archetype: 'sailor',
  look: 'male_adult_14',
  temperament: 'proud',
  knowledge: 0.7,
  desperation: 0.35,
  bio: 'Yevstafy Lukich Brashpilev, engineer captain third rank of the Northern Fleet, retired. Sells the instruments he kept from forty years at sea, one at a time, because the gas bill comes monthly and the flat is too quiet since Galina died.',
  schedule: { from: 4, every: [6, 8] },
  pawn: 0.05,
  items: [
    {
      defId: 'watch_poljot_strela',
      weight: 3,
      authenticity: 'genuine',
      provenance: 'heirloom',
      story: [
        'Navigator’s chronograph. Column wheel, thirty-minute counter. It timed a reactor start-up in 1981. Perfectly.',
        'The Strela. Wind it daily, never overwind. Like a marriage.',
      ],
    },
    { defId: 'watch_vostok_komandirskie', weight: 2, provenance: 'heirloom', story: ['Issued watch. Shockproof, they said. It survived a depth-charge exercise. I nearly didn’t.'] },
    {
      defId: 'camera_zenit_e',
      weight: 2,
      authenticity: 'genuine',
      provenance: 'clean',
      story: ['The ship’s photographer left it when he was transferred. I kept it for him for thirty years. He never came back for it.'],
    },
    {
      defId: 'lens_helios_44',
      weight: 2,
      authenticity: 'genuine',
      provenance: 'clean',
      story: ['Fifty-eight millimetres, f/2. I used it as a magnifier in the engine room. Don’t tell anyone.'],
    },
    {
      defId: 'medal_combat_merit',
      weight: 1,
      authenticity: 'genuine',
      provenance: 'heirloom',
      story: ['For Combat Merit. For twenty years without an accident. I suppose that counts as combat.'],
    },
    {
      defId: 'order_red_star',
      weight: 0.3,
      authenticity: 'genuine',
      provenance: 'heirloom',
      story: ['The Red Star. The reactor, 1983. I’ll say no more. I’d rather it went to someone who looks at it properly.'],
    },
  ],
  lines: {
    first: ['Permission to come aboard. Yevstafy Lukich Brashpilev, engineer captain, retired. I have something to sell, and I will explain it properly.'],
    again: [
      'Permission to come aboard. One more from the cabinet. It’s getting emptier; it echoes now.',
      'Good morning. The gas bill came. It always comes. Like the tide, but with stamps.',
    ],
    warm: [
      'Good morning, shipmate. Galina would have liked you. She liked anyone who listened to me about valves.',
      'I’ve started writing down what each one did, for whoever owns it next. You’re the only one who reads the notes.',
    ],
    cold: ['In the fleet we had a word for an offer like your last one. I won’t use it in a shop.', 'Good morning. I’ll state the specification. You’ll state a price. Briefly.'],
  },
} as const
