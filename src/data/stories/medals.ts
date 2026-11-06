/**
 * The Grandmother's Medals (GDD §9): tutorial-ish warmth. A real Order, a
 * fake one bought from a man at the market, and a choice: tell her the
 * truth, or tell her what she wants to hear. The truth costs her money and
 * gains you a neighbourhood; the lie comes back.
 */
export default {
  id: 'medals',
  title: 'The Grandmother’s Medals',
  beats: [
    {
      id: 'medals.roof',
      when: [{ if: 'day', gte: 3 }],
      chance: 0.5,
      visit: {
        who: 'zinaida',
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: [
            'Good day. You’re the new one? Good. The old one shouted.',
            'This was my Kolya’s. I’ve carried it here three times and gone home again. The roof leaks onto his photograph now.',
          ],
        },
        item: { defId: 'order_red_star', authenticity: 'genuine', provenance: 'heirloom', condition: [60, 85], story: 'The Red Star. He got it at Kursk.' },
        line: 'The Order of the Red Star. He got it at Kursk. Tell me what it’s worth, and don’t be clever.',
        after: {
          bought: { line: 'Thank you. He would have haggled harder. Don’t tell him.', effects: [{ do: 'flag', flag: 'medals_bought_real' }] },
          passed: { line: 'Then I’ll try the man on Sadovaya. He shouts too.' },
          walked: { line: 'I see. Kolya was worth more than that. Goodbye.' },
        },
      },
    },
    {
      id: 'medals.second',
      when: [{ if: 'beat', beat: 'medals.roof', daysAgo: { gte: 5 } }],
      chance: 0.5,
      visit: {
        who: 'zinaida',
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: [
            'The roof is mended. Or it leaks somewhere else now, at least.',
            'A man came up to me at the Sennaya market. He’d heard about Kolya. He said Kolya won a second one, and it was lost, and he found it.',
            'I paid him eight thousand. My whole pension. Look at it before I start to believe it.',
          ],
        },
        item: { defId: 'order_red_star', authenticity: 'fake', fakeProfileId: 'cast_copy', provenance: 'unknown', condition: [72, 92], story: 'Kolya’s second Red Star, the man said.' },
        line: 'Is it his? Is it real?',
        after: {
          bought: { line: 'You bought it. So it’s real. I knew it.', effects: [{ do: 'flag', flag: 'medals_paid_for_fake' }] },
          passed: { line: 'You put it down very fast.' },
          walked: { line: 'You don’t want it either. Hm.' },
        },
      },
    },
    {
      id: 'medals.truth',
      when: [{ if: 'beat', beat: 'medals.second', daysAgo: { gte: 2 } }],
      chance: 0.6,
      visit: {
        who: 'zinaida',
        kind: 'scene',
        scene: {
          lines: ['I keep looking at the second one. Kolya would have laughed at me.', 'You looked at it properly. Tell me. Is it his?'],
          choices: [
            {
              id: 'truth',
              label: 'It’s a cast copy',
              reply: '…A copy. Eight thousand roubles for a copy. Thank you for not lying to an old woman. Most people do; it saves time.',
              effects: [{ do: 'trust', who: 'zinaida', delta: 0.2 }],
            },
            {
              id: 'lie',
              label: 'It’s real',
              reply: 'I knew it! I’ll tell the man at the market. He said he might find more.',
              effects: [{ do: 'trust', who: 'zinaida', delta: 0.05 }],
            },
            {
              id: 'unsure',
              label: 'I can’t be sure',
              reply: 'That’s what people say when it’s no. I’m old, not stupid.',
              effects: [{ do: 'trust', who: 'zinaida', delta: 0.05 }],
            },
          ],
        },
      },
    },
    {
      id: 'medals.tea',
      when: [{ if: 'beat', beat: 'medals.truth', outcome: ['truth', 'unsure'], daysAgo: { gte: 4 } }],
      chance: 0.5,
      visit: {
        who: 'zinaida',
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'I brought pirozhki. Cabbage. Don’t make that face.',
            'There’s a man at Sennaya selling “lost” medals to widows. Three of us, at least. I told the others to come to you first, before they pay him.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'trust', who: 'zinaida', delta: 0.15 },
              { do: 'rep', group: 'neighbourhood', delta: 0.1 },
              { do: 'flag', flag: 'medals_conman_known' },
              { do: 'endArc' },
            ],
          },
        },
      },
    },
    {
      id: 'medals.more',
      when: [{ if: 'beat', beat: 'medals.truth', outcome: ['lie'], daysAgo: { gte: 5 } }],
      chance: 0.5,
      visit: {
        who: 'zinaida',
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: ['He found another! Kolya’s Medal for Courage. Only twelve thousand this time. I borrowed it from my neighbour.'],
        },
        item: { defId: 'medal_for_courage', authenticity: 'fake', fakeProfileId: 'cast_copy', provenance: 'unknown', condition: [75, 92], story: 'Kolya’s Medal for Courage, the man said.' },
        line: 'You’ll buy this one too, won’t you? Then I can pay her back.',
        after: {
          bought: { line: 'There. Everyone is happy.' },
          passed: { line: 'Then I’ll keep it. It’s real; you said so yourself.' },
        },
      },
    },
    {
      id: 'medals.found_out',
      when: [{ if: 'beat', beat: 'medals.more', daysAgo: { gte: 8 } }],
      chance: 0.5,
      visit: {
        who: 'zinaida',
        kind: 'scene',
        scene: {
          lines: ['Faina Gelfand from the arcade looked at my medals. Both of them. She laughed, and then she stopped laughing.', 'You knew. You said it was real.'],
          choices: [
            { id: 'sorry', label: 'I’m sorry', reply: 'Sorry doesn’t mend a roof. Good day.', effects: [{ do: 'trust', who: 'zinaida', delta: -0.4 }, { do: 'rep', group: 'neighbourhood', delta: -0.1 }, { do: 'endArc' }] },
            { id: 'spare', label: 'I wanted to spare you', reply: 'You spared yourself. Good day.', effects: [{ do: 'trust', who: 'zinaida', delta: -0.5 }, { do: 'rep', group: 'neighbourhood', delta: -0.1 }, { do: 'endArc' }] },
          ],
        },
      },
    },
  ],
} as const
