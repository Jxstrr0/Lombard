/**
 * The Student's Laptop (GDD §9): slice-of-life, and the pawn-loan tutorial.
 * Fedya Ryabov pawns the same Tosaki Orbita C40 three times (rent, black
 * shoes for a café job, a paid exam retake) and redeems it twice. The third
 * time he can't: near the due date he asks to pay only the interest and
 * start a new term. Renew it (or waive the interest) and he redeems it after
 * his diploma defence and sells it to you for good; refuse and it's
 * forfeited to the safe, and he comes by once to say he knows.
 *
 * It's the same laptop each visit (`same: 'laptop'`), a little more worn
 * each time. His returns follow `redeem` plans, not the usual hidden roll.
 * The terms he recites on the first visit must match tuning.loans (a test
 * checks it).
 */

/** Pawn beats after the first: he's not holding a pledge, and the last one wasn't left open or forfeited (or he wasn't lent anything). */
const freeOf = (beat: string, gap: number) =>
  [
    { if: 'beat', beat, daysAgo: { gte: gap } },
    { if: 'loan', who: 'fedya', not: true },
    { if: 'pledge', beat, is: ['open', 'forfeited'], not: true },
  ] as const

const laptop = (condition: readonly [number, number], story: string) =>
  ({ defId: 'laptop_tosaki_orbita_c40', authenticity: 'genuine', provenance: 'clean', same: 'laptop', condition, story }) as const

export default {
  id: 'laptop',
  title: 'The Student’s Laptop',
  beats: [
    {
      id: 'laptop.rent',
      when: [{ if: 'day', gte: 4 }],
      chance: 0.5,
      visit: {
        who: 'fedya',
        kind: 'seller',
        wants: 'pawn',
        scene: {
          lines: [
            'Hi. Um. Is this where you lend money on things? The sign says lombard, so I’m guessing yes. I’ve never done this.',
            'Rent’s due on Friday and my stipend doesn’t come till the twenty-fifth. I need the laptop back after that. My whole diploma’s on it.',
          ],
          choices: [
            {
              id: 'explain',
              label: 'Let me explain how it works',
              reply:
                'Okay. So you keep the laptop and I get the cash. Thirty days to pay it back, plus ten percent a month, counted by the day but never less than a week’s worth. Three days’ grace after that, and then it’s yours. …I’m writing this down.',
            },
            { id: 'look', label: 'Let’s see the laptop', reply: 'Be gentle with it. The hinge is fine. I’m the fragile one.' },
          ],
        },
        item: laptop([72, 84], 'My study laptop. I’m only borrowing against it.'),
        line: 'Tosaki Orbita. The F key sticks, everything else is perfect. Whatever covers the rent, and I’ll be back for it. I promise.',
        redeem: {
          days: [5, 8],
          line: 'Stipend came! I’ve got the money, and the interest. Is it right? I did the maths twice and got two answers.',
          thanks: 'Hello, old friend. Not you. The laptop.',
        },
        after: {
          pawned: { line: 'Thirty days. I’ve written it on my hand. Don’t sell it, okay? I know you won’t. Don’t, though.' },
          passed: { line: 'Okay. There’s a place by the metro. No sign. That’s probably fine.' },
          walked: { line: 'That’s not even half the rent. Never mind.' },
        },
      },
    },
    {
      id: 'laptop.shoes',
      when: freeOf('laptop.rent', 8),
      chance: 0.5,
      visit: {
        who: 'fedya',
        kind: 'seller',
        wants: 'pawn',
        scene: {
          lines: [
            'Hi. Me again. Fedya. The laptop guy.',
            'I got a job! Nights at the café on Kanatnaya. First pay’s next week, and I need black trousers and black shoes by Monday. Who owns black shoes?',
            'Sorry, that’s my mum. Hi, Mama. Yes. Yes, I’m eating. No, I’m at the library. Love you. Bye.',
            'She thinks I live at the library. I sort of live here.',
          ],
        },
        item: laptop([70, 82], 'The same laptop. It knows the way to your safe by now.'),
        line: 'Same laptop. Same deal as last time, or whatever the deal is. It knows the way to your safe by now.',
        redeem: {
          days: [5, 8],
          line: 'First payday of my life! I’m paying you before I pay myself. That’s what adults do, isn’t it?',
          thanks: 'See? Back early. Interest and all. I’m basically a bank.',
        },
        after: {
          pawned: { line: 'Monday I’m a waiter. If you see me with a tray, don’t laugh.' },
          passed: { line: 'Fine. I’ll borrow shoes from Dima. He has feet like boats.' },
          walked: { line: 'I’ll go to work barefoot, then. Very artistic.' },
        },
      },
    },
    {
      id: 'laptop.retake',
      when: freeOf('laptop.shoes', 8),
      chance: 0.5,
      visit: {
        who: 'fedya',
        kind: 'seller',
        wants: 'pawn',
        scene: {
          lines: [
            'Bad news and good news. Bad news: they cut my shifts. The owner’s nephew wanted them.',
            'Good news… no, sorry, it’s all bad news. I failed thermodynamics in January, and the retake costs money. You pay to fail twice. Who invented that?',
            'Mum offered to send some. She’s a teacher. I said no.',
          ],
        },
        item: laptop([67, 79], 'The same laptop, a few more scratches.'),
        line: 'It’s got a few more scratches. So have I. Same as always, please. I’ll find something.',
        // He can't pay this one back on his own; only a renewal (laptop.renew) brings him back for it.
        redeem: {
          days: [3, 6],
          chance: 0,
          line: 'The bureau paid my stipend. All of it’s here, the interest too. Count it twice; I counted it four times.',
          thanks: 'It’s actually going home. Thank you for keeping it warm.',
        },
        after: {
          pawned: { line: 'Thirty days. I’ll find something. I always find something.' },
          passed: { line: 'Then I’ll have to say yes to Mum. Great.' },
          walked: { line: 'Then it’s Mum’s money. Great.' },
        },
      },
    },
    {
      id: 'laptop.renew',
      when: [
        { if: 'beat', beat: 'laptop.retake', daysAgo: { gte: 23 } },
        { if: 'pledge', beat: 'laptop.retake', is: ['open'] },
      ],
      chance: 0.6,
      visit: {
        who: 'fedya',
        kind: 'scene',
        scene: {
          lines: [
            'It’s due in a few days. I counted. I count everything now.',
            'I’ve got the interest. Not the rest. I’m interning at a design bureau, and they pay a stipend, but only after the defence.',
            'Can I pay just the interest and leave it here another month? Is that a thing?',
          ],
          choices: [
            {
              id: 'renew',
              label: 'Pay the interest, new term',
              reply: 'It’s a thing! Okay. Here. So the clock starts again: another thirty days, same loan. I won’t need them all, I swear.',
              effects: [
                { do: 'renew', who: 'fedya', redeem: { days: [3, 6] } },
                { do: 'trust', who: 'fedya', delta: 0.05 },
              ],
            },
            {
              id: 'waive',
              label: 'Keep your money. Another month.',
              reply: 'You’re serious? …I’m putting you in my acknowledgements. By name. Well, by shop.',
              effects: [
                { do: 'renew', who: 'fedya', charge: false, redeem: { days: [3, 6] } },
                { do: 'trust', who: 'fedya', delta: 0.15 },
                { do: 'rep', group: 'youth', delta: 0.03 },
              ],
            },
            {
              id: 'refuse',
              label: 'The full amount, by the due date',
              reply: 'Right. Rules. That’s fair, actually. You told me on the first day. I’ll try.',
              effects: [{ do: 'trust', who: 'fedya', delta: -0.05 }],
            },
          ],
        },
      },
    },
    {
      // Renewed and redeemed: graduation, and the laptop stays here for good.
      id: 'laptop.diploma',
      when: [
        { if: 'beat', beat: 'laptop.retake', outcome: ['pawned'] },
        { if: 'pledge', beat: 'laptop.retake', is: ['redeemed'], daysAgo: { gte: 2 } },
      ],
      chance: 0.6,
      visit: {
        who: 'fedya',
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: [
            'I defended! Excellent. The commission asked why my laptop has a pawn ticket stuck to the bottom. I said it’s a long story.',
            'And the bureau took me on. A real job. They gave me a work laptop. It’s very fast and I don’t love it.',
            'So this one should stay here. It practically lives here anyway. Will you buy it? For real this time. No interest, no thirty days.',
          ],
        },
        item: laptop([65, 77], 'The same laptop. Selling it for real this time.'),
        line: 'Just a price. Be fair, it’s been through a lot. We both have.',
        after: {
          bought: {
            line: 'Look after it. The F key sticks; you have to hit it like you mean it.',
            effects: [
              { do: 'rep', group: 'youth', delta: 0.03 },
              { do: 'flag', flag: 'laptop_graduated' },
              { do: 'endArc' },
            ],
          },
          passed: { line: 'Then I’ll keep it. On a shelf, like a diploma.', effects: [{ do: 'flag', flag: 'laptop_graduated' }, { do: 'endArc' }] },
          walked: { line: 'Some things you don’t sell for nothing. I’ll keep it.', effects: [{ do: 'flag', flag: 'laptop_graduated' }, { do: 'endArc' }] },
        },
      },
    },
    {
      // Not renewed: forfeited to the safe. It's the shop's to sell now.
      id: 'laptop.forfeit',
      when: [
        { if: 'beat', beat: 'laptop.retake', outcome: ['pawned'] },
        { if: 'pledge', beat: 'laptop.retake', is: ['forfeited'], daysAgo: { gte: 1 } },
      ],
      chance: 0.6,
      visit: {
        who: 'fedya',
        kind: 'scene',
        scene: {
          lines: [
            'I know. Thirty days and three. I counted wrong. Or I counted right and there was nothing to count.',
            'Don’t tell me if it’s still here. If it’s on a shelf, I’ll just stand there and look at it.',
            'The defence went fine, on a library computer. It smelled of soup.',
          ],
          choices: [
            {
              id: 'sorry',
              label: 'I’m sorry, Fedya.',
              reply: 'Don’t be. You told me the rules on the first day. I just didn’t think they were about me. Whoever buys it: the F key sticks.',
              effects: [{ do: 'trust', who: 'fedya', delta: 0.05 }],
            },
            { id: 'rules', label: 'Rules are rules.', reply: 'That’s what makes them rules. Bye, then.', effects: [{ do: 'trust', who: 'fedya', delta: -0.05 }] },
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'laptop_forfeited' }, { do: 'endArc' }] } },
      },
    },
    {
      // Turned away on the third time: his mum pays, and the laptop stays home.
      id: 'laptop.mum',
      when: [{ if: 'beat', beat: 'laptop.retake', outcome: ['passed', 'walked'], daysAgo: { gte: 5 } }],
      chance: 0.6,
      visit: {
        who: 'fedya',
        kind: 'scene',
        scene: {
          lines: [
            'Mum sent the money. She didn’t even ask what for. Somehow that’s worse.',
            'I passed the retake. A four. Not a five, but a four is a pass with dignity.',
            'The laptop stays home now. Mum’s orders. Thanks anyway, for the other times.',
          ],
        },
        after: { talked: { effects: [{ do: 'endArc' }] } },
      },
    },
  ],
} as const
