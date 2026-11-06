/**
 * Ernest Ramonovich: Mikhail's older brother (the same look, a wine jacket), trumpet at the
 * Fregat restaurant on the embankment, weddings and wakes on the side. Comes in when Mikhail
 * has gone back to the river. Thread: the Fregat closing (src/data/stories/threads).
 * (No instruments category yet: his trumpet and mutes would be its natural items. docs/05.) M6.
 */
export default {
  id: 'ernest',
  name: 'Ernest Ramonovich',
  archetype: 'tradesman',
  look: 'male_adult_12_b',
  temperament: 'proud',
  knowledge: 0.5,
  desperation: 0.35,
  bio: 'Plays trumpet in the band at the Fregat restaurant on the embankment, Wednesday to Sunday, and at any wedding or wake that will have him. Mikhail’s older brother; their father came from Havana to study shipbuilding and never quite got warm. Named after the writer. Has read him once.',
  // Mostly once Mikhail has gone back to the river (Mikhail's ordinary visits stop on day 62).
  schedule: { from: 40, every: [13, 18] },
  pawn: 0.35,
  items: [
    { defId: 'gold_signet_583', weight: 2, provenance: 'heirloom', story: ['Papa’s other ring. Misha has the one that winters with you. This is the one that summers with you, it seems.'] },
    { defId: 'watch_pobeda_gold', weight: 1, provenance: 'unknown', story: ['A bridegroom’s father paid me with this when the cash ran out at one in the morning. I played “Besame Mucho” four times for it.'] },
    { defId: 'phone_galaxia_stella4', weight: 1, provenance: 'clean', story: ['I have a new phone. This is the old one. It still has the voicemail from the restaurant manager saying I’m “part of the furniture”. Sell it with the voicemail.'] },
  ],
  lines: {
    first: ['Good evening, it’s always evening for me. Ernest. Misha’s brother, the elder, the handsome one. He’s told you about me? No? Then he’s jealous.'],
    again: ['Good evening. Three weddings and a jubilee this week. My lip is a war veteran.', 'Good evening. The Fregat’s new owner wants “more lounge”. I don’t know what lounge is. I think it’s jazz with the joy taken out.'],
    warm: ['Good evening, friend. When you get married, I play for free. Or when you die, also free. Choose.', 'Good evening. I wrote down your shop on a napkin for a guest who had a watch to sell. You’ll get the napkin and the guest.'],
    cold: ['Good evening. I’ve played for worse money. Not much worse.', 'Good evening. A short song this time.'],
  },
} as const
