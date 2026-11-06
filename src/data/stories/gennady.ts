/**
 * Gennady Pavlovich Shurygin, militaria collector (GDD § 2b): straight about
 * medals, and he'd like first refusal. Asks for it after his first sound call
 * on a good piece; knows the story behind the grandmother's Order (crosses the
 * medals arc); warns you about cast Red Stars; asks for a medal back for a
 * family. Every beat is a phone call: he never leaves his table under the Old
 * Bridge. First-refusal calls themselves: src/game/story/specialists.ts.
 */
export default {
  id: 'gennady',
  title: 'Gennady Pavlovich Shurygin',
  specialist: 'collector',
  beats: [
    {
      id: 'gennady.first_refusal',
      when: [{ if: 'specialistEvent', id: 'collector', event: 'soundBig' }],
      visit: {
        who: 'collector',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Gennady Pavlovich. That piece yesterday was a good one. Earned, not bought.',
            'So I’ll ask you straight, the way I do everything. Anything good comes through your door, you let me make an offer before it goes in the window.',
            'First refusal. I don’t lowball and I don’t beg. Agreed?',
          ],
          choices: [
            {
              id: 'grant',
              label: 'Agreed',
              reply: 'Good. When I call a piece right and you take it in, I’ll ring that evening with a price. Take it or leave it, no hard feelings.',
              effects: [{ do: 'specialist', id: 'collector', change: 'gennady.grant' }, { do: 'flag', flag: 'gennady_first_refusal' }],
            },
            {
              id: 'refuse',
              label: 'I’ll sell to whoever',
              reply: 'Hm. Your shop, your rules. I’ll still tell you what’s what, mind. I don’t know any other way.',
              effects: [{ do: 'specialist', id: 'collector', change: 'gennady.refuse' }],
            },
          ],
        },
      },
    },
    {
      // Crosses The Grandmother's Medals while it is running.
      id: 'gennady.kolya',
      when: [
        { if: 'arc', arc: 'medals', is: 'running' },
        { if: 'beat', beat: 'medals.roof' },
      ],
      chance: 0.5,
      visit: {
        who: 'collector',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Gennady. The old woman with the Red Star, Zinaida Petrovna. She showed it to me at the flea market. I wrote the number down. Habit.',
            'It’s on a regimental list. Nikolai Stepanovich Orlov, tank driver. Pulled two men out of a burning tank at Kursk, then went back in for the radio. That’s what the Star was for.',
            'She doesn’t know. They never tell the widows the details. Will you tell her, or shall I keep it in my notebook?',
          ],
          choices: [
            {
              id: 'tell',
              label: 'I’ll tell her',
              reply: 'Good. Tell her he went back for the radio. She’ll laugh. That was the kind of fool he was.',
              effects: [{ do: 'flag', flag: 'heart.gennady_kolya' }, { do: 'flag', flag: 'medals_kolya_story' }, { do: 'trust', who: 'zinaida', delta: 0.1 }],
            },
            {
              id: 'keep',
              label: 'Keep it to yourself',
              reply: 'As you like. Some people would rather not know. Most of them are wrong.',
            },
          ],
        },
      },
    },
    {
      id: 'gennady.orders',
      when: [{ if: 'specialist', id: 'collector', relationship: { gte: 0.4 } }],
      chance: 0.5,
      visit: {
        who: 'collector',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Gennady. Fakes about. Orders of the Red Star, cast, not struck, with the numbers pressed in by a machine.',
            'A polite man in a good coat is selling them to people’s grandsons at the station. Very polite. Very good coat.',
            'Look at the number on the back. A real one is stamped by hand, a bit drunk. These are dead level, every digit the same depth. And the soldier’s blurry, bubbles in the folds.',
          ],
        },
        after: { talked: { effects: [{ do: 'boost', boost: 'cast_orders' }, { do: 'flag', flag: 'gennady_warned_orders' }] } },
      },
    },
    {
      id: 'gennady.family',
      final: true,
      when: [
        { if: 'retainedMonths', id: 'collector', gte: 3 },
        { if: 'flag', flag: 'gennady_first_refusal' },
        { if: 'stock', category: 'militaria', genuine: true },
      ],
      chance: 0.4,
      visit: {
        who: 'collector',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Gennady. I’ll ask you something, and you can say no.',
            'A family out past the shipyards has been looking for their grandfather’s medal for twenty years. The number on the best one in your safe is his.',
            'I can pay what I can pay, which is under what you’d get in the window. I know that. I’m asking anyway.',
          ],
          choices: [
            {
              id: 'sell',
              label: 'Sell it to him',
              reply: 'Thank you. I’ll take a photograph of the old man’s face when they open the box. You can have a copy.',
              effects: [
                { do: 'sellTo', id: 'collector', offer: 'gennady.family' },
                { do: 'specialist', id: 'collector', change: 'gennady.family' },
                { do: 'flag', flag: 'heart.gennady_family' },
                { do: 'endArc' },
              ],
            },
            {
              id: 'market',
              label: 'Hold out for the market',
              reply: 'Understood. It’s your living. …I’ll not ring about first refusal any more, though. It doesn’t sit right.',
              effects: [{ do: 'specialist', id: 'collector', change: 'gennady.market' }, { do: 'unflag', flag: 'gennady_first_refusal' }, { do: 'endArc' }],
            },
          ],
        },
      },
    },
  ],
} as const
