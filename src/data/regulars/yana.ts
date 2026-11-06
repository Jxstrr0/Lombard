/** Yana Chernykh: film-photography student, deadpan, sells gear to buy film. */
export default {
  id: 'yana',
  name: 'Yana Chernykh',
  archetype: 'student',
  look: 'female_adult_08',
  temperament: 'proud',
  knowledge: 0.6,
  desperation: 0.5,
  bio: 'Photography student who shoots only film, only courtyards, only in bad weather. Sells her gear to buy more film, which she says is the joke.',
  schedule: { from: 4, every: [8, 12] },
  pawn: 0.25,
  items: [
    { defId: 'lens_helios_44', weight: 3, story: ['A Helios. It swirls the background like you’re about to faint. I need rent more than swirls.'] },
    { defId: 'camera_zenit_e', weight: 2, story: ['A Zenit. It’ll outlive both of us. Most things do.'] },
    { defId: 'camera_kanon_ae2', weight: 2, story: ['The Kanon. It needs a battery to live. I don’t trust things like that.'] },
    {
      defId: 'camera_weissler_iiic',
      weight: 0.5,
      story: ['Flea market under the Lodochny Bridge. The man said it belonged to a dead German officer. They always say that.'],
    },
  ],
  lines: {
    first: ['Hello. Don’t mind the shirt. Everything dies; I just like to be ready.'],
    again: ['It’s me. The weather’s perfect today. Grey, wet, hopeless. Ideal light.', 'Hello again. My landlady says she’ll throw my enlarger in the canal. She’s all talk. Mostly.'],
    warm: [
      'I took a picture of your window at dusk. You look almost alive in it. You can keep it.',
      'Hi. You’re the only person in this city who doesn’t ask why I don’t just use my phone.',
    ],
    cold: ['Let’s just do this. I’ve had worse days. Not many.', 'Go on, cheat me. It’s very on brand for my week.'],
  },
} as const
