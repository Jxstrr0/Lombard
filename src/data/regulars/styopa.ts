/**
 * Styopa Ryabov: Fedya's younger brother (the same look, a green henley), first year at the
 * Polytechnic, following his brother into everything including this shop. Thread: doing it
 * "like Fedya" (src/data/stories/threads), which reads the laptop arc. M6.
 */
export default {
  id: 'styopa',
  name: 'Styopa Ryabov',
  archetype: 'student',
  look: 'male_adult_06_b',
  temperament: 'desperate',
  knowledge: 0.3,
  desperation: 0.6,
  bio: 'Fedya Ryabov’s younger brother, first year in radio engineering at the Polytechnic, sleeping on Fedya’s floor by the tram depot. Does everything Fedya did, a year later and slightly worse, and thinks nobody has noticed.',
  schedule: { from: 26, every: [15, 20] },
  pawn: 0.5,
  items: [
    { defId: 'phone_mangosteen_m4s', weight: 3, provenance: 'clean', story: ['My phone. Fedya says you lend on phones too, not just laptops. I haven’t got a laptop. I’ve got Fedya’s old charger.'] },
    { defId: 'camera_zenit_e', weight: 1, provenance: 'heirloom', story: ['Grandad’s camera. Fedya got the watch. I got the camera. I think I got the watch’s share of the camera.'] },
    { defId: 'lens_helios_44', weight: 1, provenance: 'heirloom', story: ['The lens off Grandad’s camera. If I sell the lens and the camera separately I get more, Fedya says. Is that true? Don’t tell him if it isn’t.'] },
  ],
  lines: {
    first: ['Hi. I’m Styopa. Ryabov? Like Fedya? I’m his brother. He said, if you’re ever stuck, go to the canal and don’t lie about anything. So: I’m stuck.'],
    again: ['Hi. Fedya says I’m doing it wrong. Doing what wrong, I said. Everything, he said.', 'Hi. Mum rang. I said I’m at the library. I think it runs in the family.'],
    warm: ['Hi! Fedya says you’re the best thing about this city after the bridges. He said that about the café too, but he meant you more.', 'Hi. I passed something! Electronics. I only failed half of it.'],
    cold: ['Hi. Fedya warned me about you. He didn’t, actually. I’m warning me about you.', 'Hi. Just the number. I’m learning.'],
  },
} as const
