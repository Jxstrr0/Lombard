/**
 * Prokhor Lukich Brashpilev: Yevstafy Lukich's younger brother (the same look in a fishing
 * shirt, his own hair), forty years a river pilot, now fishing for smelt off the Kupetsky
 * embankment. The brothers haven't spoken in eleven years. Thread: the two Brashpilevs
 * (src/data/stories/threads). M6.
 */
export default {
  id: 'prokhor',
  name: 'Prokhor Lukich',
  archetype: 'pensioner',
  look: 'male_adult_14_b',
  temperament: 'stubborn',
  knowledge: 0.5,
  desperation: 0.4,
  bio: 'Prokhor Lukich Brashpilev: forty years a river pilot on the Mostovaya, retired to a folding stool on the Kupetsky embankment, where he catches smelt in spring and opinions all year. Yevstafy Lukich’s younger brother. They fell out at a funeral in 2003 about a boat, and neither will say which boat.',
  schedule: { from: 12, every: [13, 18] },
  pawn: 0.1,
  items: [
    { defId: 'watch_vostok_komandirskie', weight: 2, provenance: 'heirloom', story: ['River pilot’s watch. Forty years on the Mostovaya and it was never late once. Not like the bridges.'] },
    { defId: 'camera_zenit_e', weight: 2, provenance: 'clean', story: ['I photographed every boat I ever brought in. Then my daughter put them all on a computer, so the camera is unemployed. Like me.'] },
    { defId: 'medal_victory_germany', weight: 1, authenticity: 'genuine', provenance: 'heirloom', story: ['Our father’s. My brother has the other one. He thinks he has both. Let him think.'] },
    { defId: 'coin_rouble_1877', weight: 0.5, provenance: 'heirloom', story: ['Found it in the mud at the Kupetsky steps in seventy-one, in low water. The river gives back what it wants to, and only once.'] },
  ],
  lines: {
    first: ['Good morning. Brashpilev, Prokhor Lukich. River pilot, retired. If you’ve met a man of my name who says “permission to come aboard”, that’s my brother, and I’m the one who actually steered.'],
    again: ['Morning. Smelt aren’t biting. They’re waiting for the ice to go. So am I.', 'Morning. The embankment’s full of boys with telephones on sticks. Not one of them can tie a knot.'],
    warm: ['Morning, pilot. I kept you two smelt. Fry them in flour, nothing else. If you put lemon on them I’ll know.', 'Morning. You’re the only one on this canal who lets me finish a sentence. My brother never did.'],
    cold: ['Morning. On the river that offer would have run you aground.', 'Morning. Let’s be brief. The fish won’t wait and neither will I.'],
  },
} as const
