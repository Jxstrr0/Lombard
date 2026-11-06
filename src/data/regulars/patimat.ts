/**
 * Patimat Aliyeva: alterations booth in the Sennaya underpass, from Makhachkala; saving for
 * her son's wedding, which will have four hundred guests and is not negotiable. Thread: the
 * invitation (src/data/stories/threads). M6.
 */
export default {
  id: 'patimat',
  name: 'Patimat Aliyeva',
  archetype: 'tradesman',
  look: 'female_adult_10',
  temperament: 'proud',
  knowledge: 0.65,
  desperation: 0.35,
  bio: 'Turns up hems in a booth in the Sennaya underpass, between a key cutter and a man who sells socks. Widowed young, raised a son who is now a dentist, and is marrying him off in Makhachkala in the summer with four hundred guests, which is the minimum.',
  schedule: { from: 19, every: [14, 20] },
  pawn: 0.4,
  items: [
    { defId: 'gold_bracelet_585', weight: 2, provenance: 'heirloom', story: ['Dagestani gold. My grandmother’s. Heavier than it looks, like all of us. For the wedding hall deposit.'] },
    { defId: 'gold_earrings_583', weight: 2, provenance: 'heirloom', story: ['My earrings from my own wedding. I wore them once. The marriage was short, the earrings are long. Look at the work.'] },
    { defId: 'gold_cross_585', weight: 1, provenance: 'unknown', story: ['A client paid for a coat with this. She was Orthodox, I am not; we agreed God would understand. Gold is gold.'] },
    { defId: 'phone_mangosteen_m4s', weight: 1, provenance: 'clean', story: ['My son bought me this so I could see his face on the screen. I see his face. He sees my ceiling. I will buy a cheaper one.'] },
  ],
  lines: {
    first: ['Good day. Patimat, the underpass, alterations. Your trousers are too long, I can see from here. First business: this. Then your trousers.'],
    again: ['Good day. The man with the socks has started selling umbrellas. Competition. I said, I sew, you sell. He laughed. We’ll see who laughs.', 'Good day. Three hundred and eighty guests confirmed. Twenty to go. They will come.'],
    warm: ['Good day, my dear. You are thin. Everyone in this city is thin and cold. In Makhachkala you would be fed until you were ill.', 'Good day. I have told my son about you. He says, Mama, it is a pawn shop. I say, it is a pawn shop with manners.'],
    cold: ['Good day. You will forgive me if I count it twice.', 'I am here for business. Only business.'],
  },
} as const
