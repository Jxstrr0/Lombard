/** Alisa Kovrigina: first-year student and DJ-in-waiting; pawns her phone before gigs. */
export default {
  id: 'alisa',
  name: 'Alisa Kovrigina',
  archetype: 'student',
  look: 'female_adult_12',
  temperament: 'flexible',
  knowledge: 0.4,
  desperation: 0.6,
  bio: 'First year at the College of Communications. Tells her mother she studies accountancy; plays records in a basement under the Lodochny Bridge as DJ Kovrizhka.',
  schedule: { from: 2, every: [7, 11] },
  pawn: 0.35,
  items: [
    {
      defId: 'phone_galaxia_stella4',
      weight: 3,
      story: ['My phone. I need it back Friday. Like, actually Friday, I have a set.', 'It’s got four hundred tracks on it and none of them are mine yet.'],
    },
    { defId: 'phone_mangosteen_m4s', weight: 2, story: ['Mum’s old phone. She got a new one and I got custody of this one.'] },
    { defId: 'phone_severin_k1', weight: 1, story: ['Gran’s brick. It survived two floods and my brother. It’ll survive you.'] },
    {
      defId: 'gold_cross_585',
      weight: 1,
      authenticity: 'genuine',
      provenance: 'heirloom',
      story: ['Gran gave me this when I was christened. I don’t really… but I’m coming back for it. Write that down somewhere.'],
    },
  ],
  lines: {
    first: ['Hi! Hi. Is this where you, like, give money for stuff? Cool. Cool cool cool.'],
    again: ['Hey! It’s me. DJ Kovrizhka. Well, Alisa. The DJ part is pending.', 'Hi. Don’t tell my mum I was here. She thinks I’m at a lecture on double-entry bookkeeping.'],
    warm: ['Hiii! I made you a mix. It’s mostly drawbridge sounds. You’ll love it.', 'I played a real club on Saturday! Forty people! Six of them came for me!'],
    cold: ['Hi. Just the money, please. I can do maths too, you know.', 'Okay. Let’s just get this over with.'],
  },
} as const
