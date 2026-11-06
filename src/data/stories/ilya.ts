/**
 * Ilya Semyonovich Brodsky, watchmaker (GDD § 2b): honest, and his eyes are
 * going. His granddaughter reads him a dial; he admits it was his eyes, not
 * the watch; he needs you to read a widow's movement; he needs an operation.
 * Specialist numbers: tuning.specialistArcs.
 */
export default {
  id: 'ilya',
  title: 'Ilya Semyonovich Brodsky',
  specialist: 'watchmaker',
  beats: [
    {
      id: 'ilya.granddaughter',
      when: [{ if: 'retainedMonths', id: 'watchmaker', gte: 1 }],
      chance: 0.5,
      visit: {
        who: 'watchmaker',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Ilya Semyonovich. One moment, my granddaughter has the telephone. Masha, read it to me. The dial. Slowly.',
            '…“Made in the USSR, seventeen jewels.” Thank you, little one. You see? She reads better than I do now.',
            'From now on, describe the watches to me slowly. As if to a child. I won’t be offended. I’ll be grateful.',
          ],
        },
      },
    },
    {
      // Retained two months, or his first wrong call on a watch you then bought.
      id: 'ilya.eyes',
      when: [
        { if: 'beat', beat: 'ilya.granddaughter' },
        {
          if: 'any',
          of: [
            { if: 'retainedMonths', id: 'watchmaker', gte: 2 },
            { if: 'specialistEvent', id: 'watchmaker', event: 'wrongBought' },
          ],
        },
      ],
      chance: 0.7,
      visit: {
        who: 'watchmaker',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Ilya Semyonovich. I didn’t sleep. I went over what I told you, and over it again.',
            'I think it was my eyes, not the watch. I can see the hands. I can’t see the hairspring any more.',
            'You should have someone younger. I would understand. I would even give you a name.',
          ],
          choices: [
            {
              id: 'keep',
              label: 'Keep him on',
              reply: '…Then I’ll be careful. More careful. Describe them slowly, and I’ll tell you when I can’t see.',
              effects: [{ do: 'specialist', id: 'watchmaker', change: 'ilya.keep' }],
            },
            {
              id: 'let_go',
              label: 'Let him go gently',
              reply: 'Thank you for saying it kindly. Most people don’t bother. If you ever need a mainspring, you know where Kanal Street is.',
              effects: [{ do: 'specialist', id: 'watchmaker', change: 'ilya.let_go' }, { do: 'flag', flag: 'ilya_let_go' }],
            },
          ],
        },
      },
    },
    {
      id: 'ilya.widow',
      when: [
        { if: 'beat', beat: 'ilya.granddaughter' },
        { if: 'specialist', id: 'watchmaker', relationship: { gte: 0.4 } },
      ],
      chance: 0.5,
      visit: {
        who: 'watchmaker',
        kind: 'scene',
        scene: {
          lines: [
            'Forgive me, I came myself. This is Vera Ignatyevna’s pocket watch. Her husband’s. I promised her it would run again by her birthday.',
            'Everything is done but the last look. I can’t see the balance any more. Would you read the movement for me, while I tell you where to look?',
          ],
          choices: [
            {
              id: 'help',
              label: 'Read it for him',
              reply: 'Left of the crown. A little more. There. Is the jewel cracked? No? …Then it runs. She will cry. Thank you. I’m sorry about your queue.',
              effects: [{ do: 'walkout' }, { do: 'flag', flag: 'heart.ilya_widow' }],
            },
            {
              id: 'busy',
              label: 'I’m busy, sorry',
              reply: 'Of course. Of course you are. I’ll find someone. I’ll manage.',
              effects: [{ do: 'specialist', id: 'watchmaker', change: 'ilya.busy' }],
            },
          ],
        },
      },
    },
    {
      id: 'ilya.operation',
      final: true,
      when: [
        { if: 'beat', beat: 'ilya.granddaughter' },
        { if: 'retainedMonths', id: 'watchmaker', gte: 4 },
      ],
      chance: 0.5,
      visit: {
        who: 'watchmaker',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Ilya Semyonovich. I’ll say it quickly or I won’t say it at all.',
            'The clinic by the Old Bridge says cataracts, both eyes, and that it’s an easy operation for a young surgeon. It is not easy to pay for.',
            'I’m {cash} short. I would pay you back in work. I don’t like asking. I’m asking.',
          ],
          choices: [
            {
              id: 'advance',
              label: 'Advance him {cash}',
              reply: '…I’ll pay you back. In watches, in favours, in kopecks if I have to. Thank you.',
              effects: [
                { do: 'specialist', id: 'watchmaker', change: 'ilya.advance', text: 'Advance to Ilya Brodsky for his operation' },
                { do: 'flag', flag: 'heart.ilya_operation' },
              ],
            },
            {
              id: 'refuse',
              label: 'I can’t, I’m sorry',
              reply: 'No, no. You’re right. I’ll work on. The hands are still clear. Mostly.',
              effects: [{ do: 'specialist', id: 'watchmaker', change: 'ilya.worse' }, { do: 'flag', flag: 'ilya_no_operation' }],
            },
          ],
        },
      },
    },
    {
      id: 'ilya.back',
      final: true,
      when: [{ if: 'beat', beat: 'ilya.operation', outcome: ['advance'], daysAgo: { gte: 21 } }],
      chance: 0.5,
      visit: {
        who: 'watchmaker',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Ilya Semyonovich! I can see the second hand. I can see the dust on the second hand. My granddaughter has eleven freckles; I counted.',
            'From now on, one call a month is on me. Don’t argue. Bring me the hard ones.',
          ],
        },
        after: { talked: { effects: [{ do: 'specialist', id: 'watchmaker', change: 'ilya.restored' }, { do: 'endArc' }] } },
      },
    },
    {
      id: 'ilya.retires',
      final: true,
      when: [
        { if: 'beat', beat: 'ilya.operation', outcome: ['refuse'] },
        { if: 'date', from: '12-20', to: '12-31' },
      ],
      visit: {
        who: 'watchmaker',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'Watchmaker closes his Kanal Street bench',
            'Ilya Semyonovich Brodsky, who has kept the embankment’s watches running since before most of its shops had names, put up his shutter for the last time this week. “My eyes retired before I did,” he told this paper. “I only caught up.”',
          ],
        },
        after: { talked: { effects: [{ do: 'specialist', id: 'watchmaker', change: 'ilya.retire' }, { do: 'endArc' }] } },
      },
    },
  ],
} as const
