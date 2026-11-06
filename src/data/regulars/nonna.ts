/**
 * Nonna Karavaeva: night nurse on the cardiology ward at City Hospital No. 3, Lyusya's older
 * sister (the same look in a teal cardigan). Patients' families press things on her and she
 * can't say no. Thread: the gold watch from bed seven, and the son who comes looking for it
 * (src/data/stories/threads). M6.
 */
export default {
  id: 'nonna',
  name: 'Nonna Karavaeva',
  archetype: 'office',
  look: 'female_adult_09_b',
  temperament: 'flexible',
  knowledge: 0.35,
  desperation: 0.45,
  bio: 'Night nurse on cardiology at City Hospital No. 3, twelve hours on, two days off. Lyusya the baker’s older sister: night shifts run in the family, and so do bad feet. Old patients give her things on their last nights, and she can’t refuse, and she can’t keep them.',
  schedule: { from: 18, every: [14, 19] },
  pawn: 0.15,
  items: [
    { defId: 'gold_signet_583', weight: 2, provenance: 'unknown', story: ['An old man gave me this on my last shift before he went. He said, buy yourself shoes, Nonnochka. I need shoes. I still feel bad.'] },
    { defId: 'medal_combat_merit', weight: 1, authenticity: 'genuine', provenance: 'unknown', story: ['A veteran in bed four pinned it on me at three in the morning. He thought I was his wife. In the morning he didn’t remember, and his family didn’t want it.'] },
    { defId: 'gold_cross_585', weight: 1, provenance: 'heirloom', story: ['My own. Lyusya has its twin. We were christened on the same day, two years apart, because the priest was busy.'] },
  ],
  lines: {
    first: ['Good morning. I’m just off a shift, forgive my face. Nonna. Lyusya’s sister, the baker. She sent me. She sends everyone.'],
    again: ['Morning. Quiet night. Only two alarms, and one was the vending machine.', 'Morning. My feet are older than I am.'],
    warm: ['Morning, dear. You look tired. You should sleep. Says the woman who doesn’t.', 'Morning. Lyusya says you’re kind. I said I know, I’m a nurse, I can tell from the hands.'],
    cold: ['Morning. I’ll take it. I haven’t the energy to argue at eight in the morning.', 'Morning. Quickly, please. I’m dead on my feet, and that’s my professional opinion.'],
  },
} as const
