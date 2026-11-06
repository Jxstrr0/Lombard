/**
 * The Dubai Rolex Guy (GDD §9): recurring fake-seller comic relief who
 * eventually brings something real. Edik Sorokin brings three fakes "from a
 * friend in Dubai", each worse than the last, and on the third admits the
 * friend is Ramil, a taxi driver paying off an old debt in watches. Then
 * Ramil's new wife makes him pay properly, with his own watch: a genuine
 * Rolland, which Edik wants to pawn, not sell.
 *
 * How you treated him decides how he brings it. Humour him (or just pass
 * politely) and he comes in quiet and asks you to look properly. Call him a
 * liar every time and he opens with the same Dubai patter as always, and you
 * can wave him off without looking: he leaves, and the real watch goes
 * across the river. Trust at the split: `realTrust` below.
 */

/** Trust in Edik at or above this when the real watch comes: the "no jokes today" version… */
const realTrust = -0.15
/** …and at or below this, the cold one (trust is kept to 0.001 steps, so the two meet). */
const coldTrust = -0.151

export default {
  id: 'rolex',
  title: 'The Dubai Rolex Guy',
  beats: [
    {
      id: 'rolex.dubai',
      when: [{ if: 'day', gte: 3 }],
      chance: 0.4,
      visit: {
        who: 'edik',
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: [
            'Good morning, my friend! Beautiful shop. Small, but all the best things are small. Diamonds. Espresso. Good decisions.',
            'My friend in Dubai sends me watches. Duty free, you understand. I pass the savings on to people I like, and I like you already.',
          ],
        },
        item: {
          defId: 'watch_rolland_abyssal',
          authenticity: 'fake',
          fakeProfileId: 'cheap_copy',
          provenance: 'unknown',
          condition: [82, 96],
          story: 'From my friend in Dubai. Duty free.',
        },
        line: 'Rolland Abyssal. Swiss. Feel the weight. Go on, feel it. In the boutique this is half a million.',
        after: {
          bought: { line: 'A man of taste! My friend in Dubai will hear about you.', effects: [{ do: 'flag', flag: 'rolex_bought_fake' }] },
          passed: { line: 'You’re making a mistake. But I respect a man who makes mistakes. See you soon.' },
          walked: { line: 'Okay, okay. Dubai will be very disappointed.' },
        },
      },
    },
    {
      id: 'rolex.omeca',
      when: [{ if: 'beat', beat: 'rolex.dubai', daysAgo: { gte: 6 } }],
      chance: 0.4,
      visit: {
        who: 'edik',
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: [
            'My friend! Last time was a misunderstanding. My friend in Dubai also says it was a misunderstanding.',
            'This one is different. Omeca. Divers wear it. Real divers, in the Gulf. You want to see?',
          ],
          choices: [
            {
              id: 'humour',
              label: 'Go on, then. Show me.',
              reply: 'This is why I come to you. An open heart and a closed mouth.',
              effects: [{ do: 'trust', who: 'edik', delta: 0.06 }],
            },
            {
              id: 'dubai',
              label: 'Your friend in Dubai again?',
              reply: 'Everything good comes from Dubai. Sand. My friend. This watch.',
            },
            {
              id: 'liar',
              label: 'I don’t buy fakes, Edik.',
              reply: 'Fakes! Who said anything about fakes? …Okay. Okay. I’m leaving with dignity.',
              effects: [
                { do: 'trust', who: 'edik', delta: -0.15 },
                { do: 'flag', flag: 'rolex_called_liar' },
              ],
              end: true,
            },
          ],
        },
        item: {
          defId: 'watch_omeca_aquastar',
          authenticity: 'fake',
          fakeProfileId: 'heavy_copy',
          provenance: 'unknown',
          condition: [80, 95],
          story: 'An Omeca from my friend in Dubai.',
        },
        line: 'Waterproof to three hundred metres. I tested it in the sink. Fifty, sixty metres at least.',
        after: {
          bought: { line: 'You won’t regret it. Maybe a little. Not much.' },
          passed: { line: 'Dubai is going to hear about this too.' },
          walked: { line: 'For that money I’d rather wear it myself. And I will.' },
        },
      },
    },
    {
      id: 'rolex.ramil',
      when: [{ if: 'beat', beat: 'rolex.omeca', daysAgo: { gte: 6 } }],
      chance: 0.4,
      visit: {
        who: 'edik',
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: [
            'Okay. The truth. Once. As an experiment.',
            'My friend in Dubai is called Ramil. He drives a taxi. Four years ago I lent him the money for his ticket, and every month since, he pays me back in watches.',
            'Every watch is worse than the one before. I think he buys them from a man who buys them from a man.',
          ],
          choices: [
            {
              id: 'money',
              label: 'Tell Ramil to send money',
              reply: 'I tell him every month! He says money is vulgar between friends.',
              effects: [{ do: 'trust', who: 'edik', delta: 0.06 }],
            },
            {
              id: 'real',
              label: 'Is any of it real, Edik?',
              reply: 'Ramil is real. The debt is real. I promise nothing else.',
              effects: [{ do: 'trust', who: 'edik', delta: 0.03 }],
            },
            {
              id: 'liar',
              label: 'Another story. Goodbye, Edik.',
              reply: 'Fine. Fine! Nobody believes in friendship any more.',
              effects: [
                { do: 'trust', who: 'edik', delta: -0.15 },
                { do: 'flag', flag: 'rolex_called_liar' },
              ],
              end: true,
            },
          ],
        },
        item: {
          defId: 'watch_brequet_classique',
          authenticity: 'fake',
          fakeProfileId: 'gilded_brass',
          provenance: 'unknown',
          condition: [78, 94],
          story: 'This month’s watch from Ramil.',
        },
        line: 'Brequet-Fils. Gold. Ramil swears it’s gold. Ramil swore the last one was gold too.',
        after: {
          bought: { line: 'You bought it? I don’t believe it myself, and I’m the one selling it.' },
          passed: { line: 'I know. I knew. I just wanted to hear somebody else say it.' },
          walked: { line: 'Even Ramil would be offended. And Ramil is never offended.' },
        },
      },
    },
    {
      // He trusts you enough to drop the act.
      id: 'rolex.real',
      when: [
        { if: 'beat', beat: 'rolex.ramil', daysAgo: { gte: 7 } },
        { if: 'trust', who: 'edik', gte: realTrust },
      ],
      chance: 0.5,
      visit: {
        who: 'edik',
        kind: 'seller',
        wants: 'pawn',
        scene: {
          lines: [
            'No Dubai jokes today. Please. I need you to look at something properly.',
            'Ramil got married. His wife found out what he owed me and made him pay it back. With his own watch. The one he actually wears.',
            'I don’t want to sell it. If I sell Ramil’s watch, he’ll know I needed the money, and I would rather die. I want to borrow against it. Like a grown-up.',
          ],
        },
        item: {
          defId: 'watch_rolland_abyssal',
          authenticity: 'genuine',
          provenance: 'clean',
          condition: [40, 58],
          story: 'Ramil’s own watch. He wore it every day.',
        },
        line: 'Rolland Abyssal. And this time I’m not telling you it’s real. I’m asking you to tell me.',
        after: {
          pawned: {
            line: 'A real watch, in a real pawn shop, with a real ticket. Ramil’s wife is a great woman.',
            effects: [
              { do: 'trust', who: 'edik', delta: 0.1 },
              { do: 'flag', flag: 'rolex_real_taken' },
            ],
          },
          passed: { line: 'You looked properly, and still no? Okay. Okay. There’s a man across the river.', effects: [{ do: 'flag', flag: 'rolex_real_missed' }] },
          walked: { line: 'That’s what you think a real one is worth? Then I don’t know what a real one is either.', effects: [{ do: 'flag', flag: 'rolex_real_missed' }] },
        },
      },
    },
    {
      // You called him a liar every time: he can't bring himself to drop the act, and you can wave it away.
      id: 'rolex.real_cold',
      when: [
        { if: 'beat', beat: 'rolex.ramil', daysAgo: { gte: 7 } },
        { if: 'trust', who: 'edik', lte: coldTrust },
      ],
      chance: 0.5,
      visit: {
        who: 'edik',
        kind: 'seller',
        wants: 'pawn',
        scene: {
          lines: ['My friend. My friend in Dubai sent me a watch.', 'I know. I know that face. Just look at it. Once.'],
          choices: [
            { id: 'look', label: 'Fine. Show me.', reply: 'Thank you. Don’t make the face yet.' },
            {
              id: 'wave',
              label: 'Not today, Edik.',
              reply: '…Okay. Not today.',
              effects: [{ do: 'flag', flag: 'rolex_real_missed' }],
              end: true,
            },
          ],
        },
        item: {
          defId: 'watch_rolland_abyssal',
          authenticity: 'genuine',
          provenance: 'clean',
          condition: [40, 58],
          story: 'Ramil’s own watch, he says.',
        },
        line: 'Rolland Abyssal. Ramil swears it’s his own. He’s sworn things before. I only want to borrow against it.',
        after: {
          pawned: {
            line: 'You believed me. Huh. I didn’t think you would. I didn’t think I would.',
            effects: [
              { do: 'trust', who: 'edik', delta: 0.15 },
              { do: 'flag', flag: 'rolex_real_taken' },
            ],
          },
          passed: { line: 'Of course. Why would this one be any different.', effects: [{ do: 'flag', flag: 'rolex_real_missed' }] },
          walked: { line: 'Right. Same as always, then.', effects: [{ do: 'flag', flag: 'rolex_real_missed' }] },
        },
      },
    },
    {
      id: 'rolex.baklava',
      when: [
        { if: 'beat', beat: 'rolex.ramil', daysAgo: { gte: 12 } },
        { if: 'flag', flag: 'rolex_real_taken' },
      ],
      chance: 0.5,
      visit: {
        who: 'edik',
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'Baklava. From Dubai. Real, I checked. Ramil’s wife sent it.',
            'She says sorry for four years of fakes. Ramil says a real one was always coming; he was practising.',
            'Whatever happens with the watch: thank you for looking properly. Nobody looks properly at me. It’s the suit.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'trust', who: 'edik', delta: 0.1 },
              { do: 'flag', flag: 'rolex_friends' },
              { do: 'endArc' },
            ],
          },
        },
      },
    },
    {
      id: 'rolex.across',
      when: [
        { if: 'beat', beat: 'rolex.ramil', daysAgo: { gte: 14 } },
        { if: 'flag', flag: 'rolex_real_missed' },
      ],
      chance: 0.5,
      visit: {
        who: 'edik',
        kind: 'scene',
        scene: {
          lines: [
            'Remember Ramil’s watch? A man across the river took it. A fair loan, and a coffee.',
            'Real. Swiss. He checked it with a little machine. I checked him with a little machine of my own: my eyes.',
            'No hard feelings. I’d have thought it was fake too. I did think it was fake. I still come here for the conversation.',
          ],
        },
        after: { talked: { effects: [{ do: 'endArc' }] } },
      },
    },
  ],
} as const
