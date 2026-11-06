/**
 * M6 small threads (see people1.ts): Snezhana Lapina, Kira Bessonova, Alyona Zharkova (the
 * loans thread: a ring, and paying only the interest), Grisha Zubov, Vitya Gruzdev.
 */
import { tuning } from '../../tuning'

const T = tuning.threads
const visits = (who: string, gte: number) => ({ if: 'visits', who, gte }) as const
const after = (beat: string, days: number, outcome?: string[]) =>
  ({ if: 'beat', beat, daysAgo: { gte: days }, ...(outcome ? { outcome } : {}) }) as const

export const snezhana = {
  id: 'snezhana',
  title: 'Snezhana Lapina',
  beats: [
    {
      id: 'snezhana.audition',
      when: [visits('snezhana', 2)],
      chance: 0.4,
      visit: {
        who: 'snezhana',
        kind: 'scene',
        scene: {
          lines: [
            'I got a letter! Well, an email. From the television. The open audition for “Voice of the Country” is in Moscow on Saturday, and I’m on the list. Number 3,412.',
            'The night train is two thousand nine hundred. I’ve got one thousand four hundred and a very good feeling. I’m not asking. I’m just saying numbers out loud.',
          ],
          choices: [
            {
              id: 'fare',
              label: 'Here. For the train',
              reply: 'Are you serious? You’re serious. I’ll pay it back the day I’m famous. Or before. Probably before.',
              effects: [{ do: 'cash', amount: -T.cash.snezhanaFare, text: 'Train fare to Moscow, Snezhana Lapina' }, { do: 'flag', flag: 'heart.snezhana_fare' }, { do: 'trust', who: 'snezhana', delta: T.trust.big }],
            },
            { id: 'decline', label: 'I lend on things, not dreams', reply: 'That’s fair. That’s actually a good line. Can I use it in a song?', effects: [{ do: 'trust', who: 'snezhana', delta: T.trust.cool }] },
          ],
        },
      },
    },
    {
      id: 'snezhana.boat',
      when: [after('snezhana.audition', 8)],
      chance: 0.5,
      final: true,
      visit: {
        who: 'snezhana',
        kind: 'scene',
        scene: {
          lines: [
            'So. Number 3,412 sang eleven seconds of Alla Borisovna and a man in a scarf said “thank you, next”. Eleven seconds! I had a key change coming.',
            'But a woman in the queue runs the tour boats on the Mostovaya, and she needs a singer for the evening cruise. Microphone, sequins, the bridges going up behind me. It’s better than television. It moves.',
            'Listen for me when the boat goes past your window. I’m the one doing the high note under the Kupetsky bridge.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'snezhana_boat' }] } },
      },
    },
    {
      id: 'snezhana.repaid',
      when: [after('snezhana.boat', 10), { if: 'beat', beat: 'snezhana.audition', outcome: ['fare'] }],
      chance: 0.5,
      final: true,
      visit: {
        who: 'snezhana',
        kind: 'scene',
        scene: {
          lines: ['First wages from the boat. Here: the train fare. All of it, in tips, so it smells of river and champagne. I said before I’m famous. I’m a woman of my word.'],
        },
        after: { talked: { effects: [{ do: 'cash', amount: T.cash.snezhanaFare, text: 'Snezhana Lapina pays back the train fare' }, { do: 'flag', flag: 'snezhana_repaid' }] } },
      },
    },
  ],
}

export const kira = {
  id: 'kira',
  title: 'Kira Bessonova',
  beats: [
    {
      id: 'kira.house',
      when: [visits('kira', 2)],
      chance: 0.4,
      visit: {
        who: 'kira',
        kind: 'scene',
        scene: {
          lines: [
            'You want to know what a croupier does all night? Smiles at men losing their flat a chip at a time. The Avrora back room has no clocks and no windows, and the house always wins. I’m the house’s hands.',
            'I keep a jar. Every tip that isn’t a chip goes in. When the jar is full I’m going to do something with these hands that isn’t dealing. I haven’t decided what. The jar knows.',
          ],
          choices: [
            { id: 'jar', label: 'What would you do?', reply: 'Teach. Ballroom, little ones. My grandmother danced. Don’t laugh. …You didn’t laugh. Interesting.', effects: [{ do: 'trust', who: 'kira', delta: T.trust.warm }] },
            { id: 'odds', label: 'The house does always win', reply: 'It does. That’s why I want to stop being it.', effects: [{ do: 'trust', who: 'kira', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'kira.table',
      when: [after('kira.house', 3), { if: 'flag', flag: 'protection.refused' }],
      chance: 0.4,
      visit: {
        who: 'kira',
        kind: 'scene',
        scene: {
          lines: [
            'Free advice, which I never give. The men who look after the Avrora also look after half this street. You told them no.',
            'They talk at my table when they think the dealer is furniture. The tall polite one said your glass is “thin, for a shop with so much in the window”. The other one laughed. He doesn’t laugh often.',
          ],
          choices: [
            { id: 'thanks', label: 'Thank you. I’ll be careful', reply: 'Don’t thank me. I wasn’t here. I’m never anywhere.', effects: [{ do: 'flag', flag: 'kira_warned' }, { do: 'trust', who: 'kira', delta: T.trust.warm }] },
            { id: 'why', label: 'Why tell me?', reply: 'Because you’re the only person on this street who says no to them. I like to watch a long shot.', effects: [{ do: 'flag', flag: 'kira_warned' }, { do: 'trust', who: 'kira', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'kira.school',
      when: [visits('kira', 4), after('kira.house', 15), { if: 'day', gte: 50 }],
      chance: 0.35,
      final: true,
      visit: {
        who: 'kira',
        kind: 'seller',
        scene: {
          lines: [
            'This one isn’t from the table. It’s mine. My grandmother’s, actually; she danced at the Kirov in 1956 and wore it to the curtain call.',
            'I’ve rented a room at the old Pioneer Palace, the one they made a wedding hall. Tuesdays and Thursdays, children’s ballroom. The deposit is due Friday, and I’m done dealing.',
          ],
        },
        item: { defId: 'gold_bracelet_585', authenticity: 'genuine', provenance: 'heirloom', condition: [70, 88], story: 'Her grandmother’s bracelet, worn to a curtain call in 1956.' },
        line: 'Real, before you ask. Test it. I would.',
        after: {
          bought: { line: 'That’s the deposit. Six little girls and one very brave boy start on Tuesday. If anyone asks where Kira went, say she found a better table.', effects: [{ do: 'flag', flag: 'kira_school' }, { do: 'trust', who: 'kira', delta: T.trust.nod }] },
          passed: { line: 'Fine. Back to the cards, then. The house always wins.', effects: [{ do: 'flag', flag: 'kira_still_dealing' }] },
          walked: { line: 'That’s a house price. I’m trying to leave the house.', effects: [{ do: 'flag', flag: 'kira_still_dealing' }] },
        },
      },
    },
  ],
}

export const alyona = {
  id: 'alyona',
  title: 'Alyona Zharkova',
  beats: [
    {
      id: 'alyona.ring',
      when: [visits('alyona', 1), { if: 'loan', who: 'alyona', not: true }],
      chance: 0.45,
      visit: {
        who: 'alyona',
        kind: 'seller',
        wants: 'pawn',
        scene: {
          lines: [
            'This is the one I didn’t want to bring. My wedding ring. The maternity payment’s late, Dima’s transfer is late, and the clinic isn’t.',
            'I worked at a bank, so I know exactly what I’m doing, and I still hate doing it. Thirty days. Dima’s home in twenty-six.',
          ],
        },
        item: { defId: 'gold_band_583', authenticity: 'genuine', provenance: 'clean', condition: [72, 90], same: 'alyona_ring', story: 'Her wedding ring, pawned until her husband is home from the north.' },
        line: 'Engraved inside: “D + A, 2011”. Don’t laugh at the plus sign. He thought it was romantic.',
        // Usually Dima's shift runs long and she can only pay the interest (alyona.renew).
        redeem: {
          days: [22, 27],
          chance: 0.35,
          line: 'Dima’s home! Early, for once. He’s outside with the pram, being useful. The ring, please, and here’s the interest. I checked your arithmetic. It was right. Annoyingly.',
          thanks: 'There. Married again.',
        },
        after: {
          pawned: { line: 'Thank you. Mishutka, say thank you. He’s asleep. That’s a thank you.' },
          passed: { line: 'Then I’ll ring my mother. She’ll help, and she’ll mention it until he’s eighteen.' },
          walked: { line: 'That’s below the scrap price. I know the scrap price. I’ll go elsewhere.' },
        },
      },
    },
    {
      id: 'alyona.renew',
      when: [after('alyona.ring', 23), { if: 'pledge', beat: 'alyona.ring', is: ['open'] }],
      chance: 0.7,
      visit: {
        who: 'alyona',
        kind: 'scene',
        scene: {
          lines: [
            'The ring’s due in a few days. Dima rang from the field: they’ve kept the whole shift on another month. The pipeline doesn’t care about wedding rings.',
            'I have the interest. Exactly the interest; I worked it out to the kopeck. Could I pay that, and start the thirty days again? You can say no. I would have, at the bank.',
          ],
          choices: [
            {
              id: 'renew',
              label: 'Pay the interest, new term',
              reply: 'Thank you. Here. Count it; it’s right, but count it. Thirty more days, and then he’s home, and I never do this again.',
              effects: [{ do: 'renew', who: 'alyona', redeem: { days: [9, 15], line: 'He’s home. Really home, for thirty days. Here’s everything. The ring, please, and then I’m going to cry a little in your doorway.', thanks: 'D plus A. Back where it lives.' } }, { do: 'trust', who: 'alyona', delta: T.trust.warm }],
            },
            {
              id: 'waive',
              label: 'Keep your money. New term',
              reply: 'You’re waiving it? Nobody waives it. I’ve never seen it waived. …Thank you. I’m going to tell Dima you’re a terrible businessman, and he’s going to love you.',
              effects: [{ do: 'renew', who: 'alyona', charge: false, redeem: { days: [9, 15], line: 'He’s home. Here’s the loan, all of it, and a cake Dima’s mother made. It’s terrible. It’s for you.', thanks: 'Home. Both of us.' } }, { do: 'trust', who: 'alyona', delta: T.trust.big }, { do: 'flag', flag: 'heart.alyona_waived' }],
            },
            { id: 'terms', label: 'The terms are the terms', reply: 'I know. I used to say that. It sounds different from this side of the glass.', effects: [{ do: 'trust', who: 'alyona', delta: T.trust.hurt }] },
          ],
        },
      },
    },
    {
      id: 'alyona.dima',
      when: [{ if: 'beat', beat: 'alyona.ring' }, { if: 'pledge', beat: 'alyona.ring', is: ['redeemed'], daysAgo: { gte: 4 } }],
      chance: 0.4,
      final: true,
      visit: {
        who: 'alyona',
        kind: 'scene',
        scene: {
          lines: [
            'No business today. Dima wanted to see the shop that kept the ring. He’s outside; he’s shy. He says thank you. He said it in the car, so I’m passing it on.',
            'I go back to the bank in September. Teller window four. If you ever come in, I’ll give you the good pen.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'alyona_home' }, { do: 'trust', who: 'alyona', delta: T.trust.nod }] } },
      },
    },
  ],
}

export const grisha = {
  id: 'grisha',
  title: 'Grisha Zubov',
  beats: [
    {
      id: 'grisha.reference',
      when: [visits('grisha', 2)],
      chance: 0.4,
      visit: {
        who: 'grisha',
        kind: 'scene',
        scene: {
          lines: [
            'Strange thing to ask a pawnbroker. The tyre depot on Obvodny has a proper job: contract, insurance, a locker with my name on it. They want a reference from “a local business owner”.',
            'The car-wash man won’t; he pays me in cash and doesn’t exist on paper. You’ve dealt with me straight. Would you write a line? Just that I turn up and I don’t steal.',
          ],
          choices: [
            {
              id: 'write',
              label: 'I’ll write you one',
              reply: '…Thank you. I’ll frame it. No, I’ll give it to them, and then I’ll ask for it back and frame it.',
              effects: [{ do: 'flag', flag: 'heart.grisha_reference' }, { do: 'trust', who: 'grisha', delta: T.trust.big }, { do: 'rep', group: 'neighbourhood', delta: T.rep.small }],
            },
            { id: 'not_yet', label: 'Ask me again in a month', reply: 'A month. Fair. I’ve waited six years for most things. One more month is a holiday.', effects: [{ do: 'trust', who: 'grisha', delta: T.trust.cool }] },
          ],
        },
      },
    },
    {
      id: 'grisha.zhora',
      when: [visits('grisha', 3), { if: 'flag', flag: 'protection.running' }, { if: 'beat', beat: 'grisha.reference' }],
      chance: 0.35,
      visit: {
        who: 'grisha',
        kind: 'scene',
        scene: {
          lines: [
            'My brother came to the car wash. Stood there while I did a whole Mercedes. Then he said Eduard Lvovich could use a man who knows engines and doesn’t talk.',
            'I said I talk now. I go to a circle on Tuesdays and talk for an hour. He didn’t laugh. He said think about it, and he stood there a bit more, and went.',
          ],
          choices: [
            { id: 'right', label: 'You did the right thing', reply: 'I know. Knowing is the easy part. The hard part is Thursday, when the rent’s due.', effects: [{ do: 'trust', who: 'grisha', delta: T.trust.nod }] },
            { id: 'brother', label: 'He’s still your brother', reply: 'He is. That’s why I said it to his face. Inside, you learn: say no to someone’s face, or they never believe it.', effects: [{ do: 'trust', who: 'grisha', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'grisha.depot',
      when: [after('grisha.reference', 12, ['write'])],
      chance: 0.45,
      final: true,
      visit: {
        who: 'grisha',
        kind: 'scene',
        scene: {
          lines: [
            'I got it. The depot. Overalls with my name stitched on, spelled wrong, Grysha, I don’t care. A locker. A pay slip. A man there called me “colleague” and I had to go and sit in the van for a minute.',
            'I brought you nothing to sell. That’s the point. I’ve got nothing I need to sell.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'grisha_depot' }, { do: 'trust', who: 'grisha', delta: T.trust.warm }] } },
      },
    },
    {
      id: 'grisha.drift',
      when: [after('grisha.reference', 30, ['not_yet'])],
      chance: 0.4,
      final: true,
      visit: {
        who: 'grisha',
        kind: 'scene',
        scene: {
          lines: [
            'Don’t ask about the depot. They gave it to someone with a reference.',
            'I’m driving now. For a man. Good car, cash, short hours, don’t ask. My brother got me the job. Don’t look at me like that. You had a month to look at me differently.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'grisha_drifted' }, { do: 'trust', who: 'grisha', delta: T.trust.cool }] } },
      },
    },
  ],
}

export const vitya = {
  id: 'vitya',
  title: 'Vitya Gruzdev',
  beats: [
    {
      id: 'vitya.shirts',
      when: [visits('vitya', 2)],
      chance: 0.4,
      visit: {
        who: 'vitya',
        kind: 'scene',
        scene: {
          lines: [
            'Business proposal. Mostovik Under-12 are in the city final on the twelfth, live on the district channel, and we’ve got no sponsor. The shirts say nothing. Nothing!',
            'Three thousand and your shop’s name goes on twelve shirts, front and back. Lyova would be advertising you in goal. He lets in very few, so it’s a quality advert.',
          ],
          choices: [
            {
              id: 'sponsor',
              label: 'Put the shop on the shirts',
              reply: 'Yes! I’ll get the lettering done on Kanatnaya. Big letters. Lyova will complain they’re heavy. He complains about everything; he’s a goalkeeper.',
              effects: [{ do: 'cash', amount: -T.cash.vityaShirts, text: 'Shirt sponsor, Mostovik Under-12' }, { do: 'flag', flag: 'vitya_shirts' }, { do: 'rep', group: 'youth', delta: T.rep.shirts }, { do: 'trust', who: 'vitya', delta: T.trust.warm }],
            },
            { id: 'decline', label: 'Not this season', reply: 'Fair. The car wash on Kirpichny said yes, so we’ll be “Kirpichny Shine” in goal. Lyova’s furious.', effects: [{ do: 'trust', who: 'vitya', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'vitya.final',
      when: [after('vitya.shirts', 6)],
      chance: 0.5,
      final: true,
      visit: {
        who: 'vitya',
        kind: 'scene',
        scene: {
          lines: [
            'Lost three–two in overtime. Lyova saved forty-one. Forty-one! The other goalkeeper saved nineteen, and they gave him the medal because his father’s on the committee.',
            'Lyova cried in the car and then said, next year. Next year! I nearly crashed. I’m so proud I can’t mend a lift straight.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'vitya_final' }] } },
      },
    },
  ],
}
