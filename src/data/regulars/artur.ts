/**
 * Artur Kim: resident DJ at the Podval club, pawns his phone the week before the club pays.
 * Thread (src/data/stories/threads): asks about the girl who pawns her phone before
 * gigs (Alisa), and the club's "insurance". M6.
 */
export default {
  id: 'artur',
  name: 'Artur Kim',
  archetype: 'hustler',
  look: 'male_adult_09',
  temperament: 'flexible',
  knowledge: 0.6,
  desperation: 0.45,
  bio: 'Resident DJ at Podval, the cellar club on Lodochnaya Street, Thursday to Saturday, two till six. His grandmother came from Tashkent with a pressure cooker and opinions; he got the opinions. Paid on the fifteenth, broke on the tenth.',
  schedule: { from: 14, every: [14, 20] },
  pawn: 0.6,
  items: [
    { defId: 'phone_galaxia_nota3', weight: 3, provenance: 'clean', story: ['My phone. All my sets are on it, but they’re on the cloud too. Mostly. Two weeks, then I’m back for it.', 'Same phone. The club pays on the fifteenth. The fifteenth is a theory.'] },
    { defId: 'phone_mangosteen_m5', weight: 1, provenance: 'unknown', story: ['Someone left this in the booth at six in the morning. I waited a month. Nobody came back for it except me.'] },
    { defId: 'laptop_tosaki_orbita_c40', weight: 1, provenance: 'clean', story: ['My backup laptop. If the main one dies on a Saturday, I play off my phone and pray. Short-term, please.'] },
    { defId: 'gold_signet_583', weight: 0.5, authenticity: 'genuine', provenance: 'heirloom', story: ['Grandfather’s ring. Babushka gave it me when I said I was going to be a DJ. I think it was a hint to get a real job.'] },
  ],
  lines: {
    first: ['Hey. Artur. I play records at Podval, if you go there, which you don’t, it’s fine. I need cash till the fifteenth and I hear you count properly.'],
    again: ['Morning. Well, my evening. I haven’t been to bed. That’s a professional detail.', 'Hey. The club owner says “next week” like it’s a song lyric.'],
    warm: ['There you are. You’re the only person I see in daylight who doesn’t ask what a DJ actually does.', 'Hey, chief. I dropped a track last night I called “Lombard”. Slow, a lot of bass, honest. Like you.'],
    cold: ['Hey. Let’s just do numbers. I do enough feelings at two in the morning.', 'I came because the other place is shut. Don’t take it personally.'],
  },
} as const
