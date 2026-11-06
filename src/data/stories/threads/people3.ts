/**
 * M6 small threads (see people1.ts), the relatives: Prokhor Brashpilev (Yevstafy's brother),
 * Zakhar Svirelin (Gleb's), Ernest Ramonovich (Mikhail's), Styopa Ryabov (Fedya's; reads the
 * laptop arc), Klava Bortnik (Ulyana's sister, Valentin's pupil), Elvira Venchikova (Inessa's),
 * Zhanna Kuzovkina (Rimma's cousin), Nonna Karavaeva (Lyusya's), Zoya Chernykh (Yana's; reads
 * Protection), Larisa Kovrigina (Alisa's twin; renews Alisa's loan).
 */
import { tuning } from '../../tuning'

const T = tuning.threads
const visits = (who: string, gte: number) => ({ if: 'visits', who, gte }) as const
const after = (beat: string, days: number, outcome?: string[]) =>
  ({ if: 'beat', beat, daysAgo: { gte: days }, ...(outcome ? { outcome } : {}) }) as const

export const prokhor = {
  id: 'prokhor',
  title: 'Prokhor Lukich Brashpilev',
  beats: [
    {
      id: 'prokhor.brother',
      when: [visits('prokhor', 2), visits('yevstafy', 2)],
      chance: 0.4,
      visit: {
        who: 'prokhor',
        kind: 'scene',
        scene: {
          lines: [
            'You buy from my brother. Don’t deny it; the whole embankment knows. He walks past my stool every Thursday to come here and doesn’t look down.',
            'Is he well? Not that I care. His knee, I mean. He had a knee in 2003. You could tell him… no. Tell him nothing. Or tell him the smelt are running. He’ll know what it means.',
          ],
          choices: [
            { id: 'tell', label: 'I’ll tell him the smelt are running', reply: 'Hm. Don’t make a ceremony of it. Just say it the way you’d say it’s raining.', effects: [{ do: 'flag', flag: 'prokhor_message' }, { do: 'trust', who: 'prokhor', delta: T.trust.warm }] },
            { id: 'yourself', label: 'Tell him yourself', reply: 'Eleven years I’ve not told him anything. I’m not starting in a pawn shop.', effects: [{ do: 'trust', who: 'prokhor', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'prokhor.stool',
      when: [after('prokhor.brother', 8, ['tell'])],
      chance: 0.45,
      final: true,
      visit: {
        who: 'yevstafy',
        kind: 'scene',
        scene: {
          lines: [
            'Permission to come aboard. I passed on your message. Well, I stopped at the stool. I said, “Smelt running, are they?” He said, “Not for you.” Then he moved his bucket.',
            'I sat. We didn’t talk. Three hours, two men and fourteen smelt. Best watch I’ve stood since the Pobeda went for scrap. It was the boat. The argument. I won’t say which of us was right. He knows.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'heart.brashpilevs' }, { do: 'trust', who: 'prokhor', delta: T.trust.warm }, { do: 'trust', who: 'yevstafy', delta: T.trust.nod }] } },
      },
    },
    {
      id: 'prokhor.alone',
      when: [after('prokhor.brother', 20, ['yourself'])],
      chance: 0.35,
      final: true,
      visit: {
        who: 'prokhor',
        kind: 'scene',
        scene: {
          lines: [
            'He went past again Thursday. I said “Yevstafy” to his back. Out loud, the whole name. He stopped. Then a tram came and he got on it, and I don’t know if he heard me.',
            'Next Thursday I’ll say it louder. I have a pilot’s voice. Had. It’ll come back.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'prokhor_alone' }] } },
      },
    },
  ],
}

export const zakhar = {
  id: 'zakhar',
  title: 'Zakhar Svirelin',
  beats: [
    {
      id: 'zakhar.game',
      when: [visits('zakhar', 2)],
      chance: 0.4,
      visit: {
        who: 'zakhar',
        kind: 'scene',
        scene: {
          lines: [
            'I’ve brought a board. Pocket set, magnetic, missing a black bishop; a button plays bishop. A game. Five hundred on it. You’ll lose, but you’ll lose to a candidate master, which is a kind of education.',
            'Or don’t. Most people don’t. Most people walk past my bench as if I’m a pigeon.',
          ],
          choices: [
            {
              id: 'play',
              label: 'Five hundred. Set them up',
              reply: 'Mate in twenty-three. You resigned with dignity on move nineteen, which is the right move. Thank you. That’s my rent and a lesson in the Sicilian.',
              effects: [{ do: 'cash', amount: -T.cash.zakharStake, text: 'Lost a game of blitz to Zakhar Svirelin' }, { do: 'flag', flag: 'zakhar_played' }, { do: 'trust', who: 'zakhar', delta: T.trust.warm }],
            },
            { id: 'decline', label: 'I don’t gamble at the counter', reply: 'Chess isn’t gambling. Gambling is when you don’t know who’ll win.', effects: [{ do: 'trust', who: 'zakhar', delta: T.trust.cool }] },
          ],
        },
      },
    },
    {
      id: 'zakhar.book',
      when: [after('zakhar.game', 10), visits('gleb', 3)],
      chance: 0.4,
      final: true,
      visit: {
        who: 'zakhar',
        kind: 'scene',
        scene: {
          lines: [
            'My brother writes poems. Did you know? A little book, printed at his own cost, sixty copies. He sold one to a library and gave the rest away and one of them ended up on my bench, left by a tourist.',
            'They’re good. I can’t tell him; we don’t say things like that. You see him. If he mentions the book, say someone bought it and read it twice. Don’t say who. It’s a sacrifice; you give up the piece to win the position.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'zakhar_secret' }, { do: 'trust', who: 'zakhar', delta: T.trust.nod }] } },
      },
    },
  ],
}

export const ernest = {
  id: 'ernest',
  title: 'Ernest Ramonovich',
  beats: [
    {
      id: 'ernest.fregat',
      when: [visits('ernest', 2)],
      chance: 0.45,
      visit: {
        who: 'ernest',
        kind: 'scene',
        scene: {
          lines: [
            'The Fregat is closing. Thirty-four years on the embankment and they’re making it a sushi place. Sushi! On the Mostovaya, where the fish come out of the river looking at you.',
            'Last night is Saturday. After that, weddings only, and weddings mean someone who books bands. You know people. Everyone comes through your door eventually.',
          ],
          choices: [
            { id: 'inessa', label: 'There’s a registrar, Inessa…', reply: 'A registrar! Sitting at the source of the river of weddings. Tell her a trumpeter. Tell her handsome. Tell her available Fridays.', effects: [{ do: 'flag', flag: 'ernest_inessa' }, { do: 'trust', who: 'ernest', delta: T.trust.warm }] },
            { id: 'sorry', label: 'I’m sorry about the Fregat', reply: 'Don’t be sorry. Come on Saturday. Order the herring. Cry at “Moscow Nights” like everybody else.', effects: [{ do: 'trust', who: 'ernest', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'ernest.wedding',
      when: [after('ernest.fregat', 14, ['inessa']), visits('inessa', 1)],
      chance: 0.45,
      final: true,
      visit: {
        who: 'ernest',
        kind: 'scene',
        scene: {
          lines: [
            'The registrar! She booked me for a Saturday at Palace No. 2. I played the entrance, the rings, and “Moscow Nights” on the steps, and the bride’s grandmother kissed me on the mouth. Professionally.',
            'Six bookings since. I have a diary now. A diary! Misha says I’ve become a bourgeois. He’s jealous. He’s always been jealous.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'ernest_weddings' }] } },
      },
    },
    {
      id: 'ernest.last',
      when: [after('ernest.fregat', 14, ['sorry'])],
      chance: 0.35,
      final: true,
      visit: {
        who: 'ernest',
        kind: 'scene',
        scene: {
          lines: [
            'The Fregat’s last night. We played until two; the cook played the spoons. Now it’s weddings and wakes, and the wakes pay better, and that’s all I’ll say about the economy of this city.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'ernest_wakes' }] } },
      },
    },
  ],
}

export const styopa = {
  id: 'styopa',
  title: 'Styopa Ryabov',
  beats: [
    {
      id: 'styopa.lesson',
      when: [visits('styopa', 2)],
      chance: 0.4,
      visit: {
        who: 'styopa',
        kind: 'scene',
        scene: {
          lines: [
            'Can I ask you something Fedya won’t tell me? When he was skint, first year, did he really pawn the laptop? He says he “restructured his assets”.',
            'Because I’m thinking of doing it, “like Fedya”. Only mine’s got the coursework on it, and I haven’t got a back-up, and I also haven’t got a plan.',
          ],
          choices: [
            { id: 'backup', label: 'Back it up first. Then talk', reply: 'Back it up. Right. Fedya said you’d say something sensible. He didn’t say it would be that sensible.', effects: [{ do: 'trust', who: 'styopa', delta: T.trust.warm }] },
            { id: 'ask_him', label: 'Ask your brother', reply: 'He’ll make a face. He makes this face. Fine. I’ll ask. You’ll see the face next time he comes in.', effects: [{ do: 'trust', who: 'styopa', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'styopa.fedya',
      when: [after('styopa.lesson', 10), { if: 'any', of: [{ if: 'flag', flag: 'laptop_graduated' }, { if: 'day', gte: 70 }] }],
      chance: 0.4,
      final: true,
      visit: {
        who: 'styopa',
        kind: 'scene',
        scene: {
          lines: [
            'Fedya told me everything. The laptop, the shoes, the retake. He said the hardest part was walking in here the first time, and the second hardest was walking in to get it back.',
            'So I got a job instead. Nights, stacking at the Krupa supermarket. It’s terrible. I’m not doing it “like Fedya”. I’m doing it like me.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'styopa_own_way' }] } },
      },
    },
  ],
}

export const klava = {
  id: 'klava',
  title: 'Klava Bortnik',
  beats: [
    {
      id: 'klava.route',
      when: [visits('klava', 2)],
      chance: 0.4,
      visit: {
        who: 'klava',
        kind: 'scene',
        scene: {
          lines: [
            'They want to close the No. 9. “Optimise” it into a bus. A bus, past the canal, in February, on that cobble. The bus will shake out everyone’s fillings by Lesnaya.',
            'I’ve got a petition. Four hundred names so far: the market, both bakeries, the school. Valentin Egorovich signed it twice; I crossed one out. Would you put one up in your window?',
          ],
          choices: [
            { id: 'sign', label: 'Put it in the window', reply: 'Thank you. Right by the door, where people stop to look at the watches. They’ll sign while they’re pretending not to want a watch.', effects: [{ do: 'flag', flag: 'klava_petition' }, { do: 'rep', group: 'neighbourhood', delta: T.rep.small }, { do: 'trust', who: 'klava', delta: T.trust.warm }] },
            { id: 'buses', label: 'Buses aren’t so bad', reply: 'Buses aren’t so bad. You’ll be saying that to me on the bus, holding on to the pole with both hands.', effects: [{ do: 'trust', who: 'klava', delta: T.trust.cool }] },
          ],
        },
      },
    },
    {
      id: 'klava.valentin',
      when: [after('klava.route', 5), visits('valentin', 3)],
      chance: 0.4,
      visit: {
        who: 'valentin',
        kind: 'scene',
        scene: {
          lines: [
            'Klavdia’s petition. I went to the transport committee hearing in my good jacket. Spoke for four minutes. Told them the No. 9 has run since 1951: through the shipyard strike, through the floods, through 1998.',
            'A young man with a tablet asked me how many passengers per kilometre. I said all of them. He wrote that down. I don’t think it was a number he could use.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'klava_hearing' }, { do: 'trust', who: 'valentin', delta: T.trust.nod }] } },
      },
    },
    {
      id: 'klava.reprieve',
      when: [after('klava.route', 18), { if: 'flag', flag: 'klava_petition' }],
      chance: 0.5,
      final: true,
      visit: {
        who: 'klava',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'No. 9 tram saved, for now',
            'The city transport committee has withdrawn its plan to replace the No. 9 tram with a bus “pending further study”, after a petition of 2,140 signatures, gathered in shops and bakeries along the canal. Driver Klavdia Bortnik said: “Pending is fine. Pending is how everything in this city has survived.”',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'klava_saved' }, { do: 'trust', who: 'klava', delta: T.trust.warm }] } },
      },
    },
    {
      id: 'klava.shortened',
      when: [after('klava.route', 18), { if: 'flag', flag: 'klava_petition', not: true }],
      chance: 0.5,
      final: true,
      visit: {
        who: 'klava',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'No. 9 tram cut back to the depot',
            'From next month the No. 9 will run only between the depot and the canal; a bus replaces it to Lesnaya. Driver Klavdia Bortnik declined to comment, then commented at length, none of it printable.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'klava_shortened' }] } },
      },
    },
  ],
}

export const elvira = {
  id: 'elvira',
  title: 'Elvira Venchikova',
  beats: [
    {
      id: 'elvira.trip',
      when: [visits('elvira', 2)],
      chance: 0.4,
      visit: {
        who: 'elvira',
        kind: 'scene',
        scene: {
          lines: [
            'The eighth form are going to Yasnaya Polyana. Tolstoy’s house. They’ll be bored for three hours and remember it for fifty years; that’s how literature works.',
            'Four of them can’t pay. Two are Bakhtiyor’s girls, who’ve read more Tolstoy than I had at their age. I’m short by two thousand. I’m not asking. I teach rhetoric, so you’ll notice I’m not asking very carefully.',
          ],
          choices: [
            {
              id: 'chip_in',
              label: 'Two thousand. For the reading',
              reply: 'Thank you. I’ll tell the headmistress it came from the parents’ fund, and the parents’ fund will be you. Don’t tell Inessa; she’ll want to do a speech.',
              effects: [{ do: 'cash', amount: -T.cash.elviraTrip, text: 'School No. 41 class trip' }, { do: 'flag', flag: 'heart.elvira_trip' }, { do: 'trust', who: 'elvira', delta: T.trust.big }],
            },
            { id: 'decline', label: 'Not this time, I’m afraid', reply: 'Of course. I’ll sell my good earrings. They were too good for a teacher anyway.', effects: [{ do: 'trust', who: 'elvira', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'elvira.postcard',
      when: [after('elvira.trip', 9, ['chip_in'])],
      chance: 0.5,
      final: true,
      visit: {
        who: 'elvira',
        kind: 'scene',
        scene: {
          lines: [
            'This is for you. The class wrote it on the coach back. Thirty signatures and a drawing of Tolstoy’s beard, which Madina did, and which is better than the bust.',
            '“To the parents’ fund, thank you for Tolstoy.” Kamila wants to know who the parents’ fund is. I told her literature is full of mysteries.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'elvira_postcard' }] } },
      },
    },
    {
      id: 'elvira.earrings',
      when: [after('elvira.trip', 9, ['decline'])],
      chance: 0.4,
      final: true,
      visit: {
        who: 'elvira',
        kind: 'scene',
        scene: {
          lines: [
            'They went. All thirty. I sold the earrings to a man on Sennaya who gave me less than you would have, which served me right for being proud. Madina cried at the grave. Tolstoy’s, not mine. Yet.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'elvira_earrings' }] } },
      },
    },
  ],
}

export const zhanna = {
  id: 'zhanna',
  title: 'Zhanna Kuzovkina',
  beats: [
    {
      id: 'zhanna.chain',
      when: [visits('zhanna', 2)],
      chance: 0.4,
      visit: {
        who: 'zhanna',
        kind: 'seller',
        scene: {
          lines: [
            'This is the chain. The 1999 chain. Rimma will have told you about it; she tells everyone about it. Vova gave it to me on the bridge on our first anniversary, and that was his last idea.',
            'I’ve rented a room on Lesnaya. One room, a kettle, a window on the tram turning circle. The deposit is the chain.',
          ],
        },
        item: { defId: 'gold_rope_chain_585', authenticity: 'genuine', provenance: 'clean', condition: [68, 86], story: 'The anniversary chain from 1999; the deposit on a room of her own.' },
        line: 'Weigh it properly. It’s the only honest thing he ever gave me.',
        after: {
          bought: { line: 'That’s the deposit. One room, one kettle. Nobody telling me how to hold the kettle.', effects: [{ do: 'flag', flag: 'zhanna_room' }, { do: 'trust', who: 'zhanna', delta: T.trust.warm }] },
          passed: { line: 'Then I’ll keep wearing it to work and hating it. It goes with the uniform.' },
          walked: { line: 'Even Vova would have got more for it. That’s a sentence I never wanted to say.' },
        },
      },
    },
    {
      id: 'zhanna.free',
      when: [after('zhanna.chain', 12)],
      chance: 0.4,
      final: true,
      visit: {
        who: 'zhanna',
        kind: 'scene',
        scene: {
          lines: [
            'Report from Lesnaya. The kettle works. The trams go round all night and I sleep through it like a baby. Vova came round with flowers. Carnations. Carnations! I gave them to the neighbour for her mother’s grave.',
            'Rimma says I look ten years younger. Rimma lies to everyone but me, so I’m choosing to believe her.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'zhanna_free' }] } },
      },
    },
  ],
}

export const nonna = {
  id: 'nonna',
  title: 'Nonna Karavaeva',
  beats: [
    {
      id: 'nonna.watch',
      when: [visits('nonna', 2)],
      chance: 0.4,
      visit: {
        who: 'nonna',
        kind: 'seller',
        scene: {
          lines: [
            'Bed seven. Grigory Mironovich, eighty-eight, a railwayman. Last night he took this off and put it in my hand and said, “Nobody comes.” Then he slept, and this morning they moved him downstairs.',
            'I can’t keep it. We’re not allowed, and I couldn’t look at it. But I can’t give it to the ward either; it would walk. Buy it, and I’ll put the money in the ward fund, for the night kettle.',
          ],
        },
        item: { defId: 'watch_pobeda_gold', authenticity: 'genuine', provenance: 'unknown', condition: [62, 80], same: 'nonna_watch', story: 'Given to the night nurse by a dying railwayman at bed seven.' },
        line: 'He wound it every night at ten. It’s still going. I can’t bear that it’s still going.',
        after: {
          bought: { line: 'Thank you. The kettle will be the best on the hospital. Don’t sell it quickly. I don’t know why I said that.', effects: [{ do: 'flag', flag: 'nonna_watch_bought' }] },
          passed: { line: 'All right. I’ll give it to the hospital chaplain. He has a drawer for these.', effects: [{ do: 'flag', flag: 'nonna_watch_chaplain' }] },
          walked: { line: 'That’s an insult to Grigory Mironovich, and he can’t defend himself.', effects: [{ do: 'flag', flag: 'nonna_watch_chaplain' }] },
        },
      },
    },
    {
      id: 'nonna.son',
      when: [after('nonna.watch', 9, ['bought'])],
      chance: 0.45,
      final: true,
      visit: {
        who: 'nonna',
        kind: 'scene',
        scene: {
          lines: [
            'Grigory Mironovich died on Sunday. And on Monday, a son. From Novosibirsk, six years without a phone call, asking at the desk for “Dad’s watch”.',
            'I told him the truth: his father gave it away because nobody came. He went very quiet. If he comes in here asking, it’s up to you. I think he should have to pay for it. I think he should have to pay full price. I’m a nurse, not a saint.',
          ],
          choices: [
            { id: 'hold', label: 'I’ll keep it back for him', reply: 'Good. Make him come in person. Make him stand at the glass, where his father stood at mine.', effects: [{ do: 'flag', flag: 'nonna_held_for_son' }, { do: 'trust', who: 'nonna', delta: T.trust.warm }] },
            { id: 'ward', label: 'It’s the ward’s kettle now', reply: 'That’s fair too. The kettle never once forgot to visit.', effects: [{ do: 'trust', who: 'nonna', delta: T.trust.nod }] },
          ],
        },
      },
    },
  ],
}

export const zoya = {
  id: 'zoya',
  title: 'Zoya Chernykh',
  beats: [
    {
      id: 'zoya.ears',
      when: [visits('zoya', 2)],
      chance: 0.4,
      visit: {
        who: 'zoya',
        kind: 'scene',
        scene: {
          lines: [
            'Professional secret: people tell their tattooist everything. Two hours in the chair and a needle in the ribs, and a grown man tells me about his mother, his debts, who he’s collecting from on Thursday.',
            'Some of the young ones who work for the “insurance” people sit in my chair. If I hear your shop’s name, do you want to know? Some people don’t. Some people sleep better.',
          ],
          choices: [
            { id: 'tell_me', label: 'Tell me if you hear anything', reply: 'Deal. I never repeat a word, except to you, apparently. Don’t make me regret it; I hold the needle.', effects: [{ do: 'flag', flag: 'zoya_ears' }, { do: 'trust', who: 'zoya', delta: T.trust.warm }] },
            { id: 'sleep', label: 'I’d rather sleep', reply: 'Smart. Sleep is underrated. So is not knowing.', effects: [{ do: 'trust', who: 'zoya', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'zoya.chair',
      when: [after('zoya.ears', 3, ['tell_me']), { if: 'flag', flag: 'protection.refused' }],
      chance: 0.4,
      visit: {
        who: 'zoya',
        kind: 'scene',
        scene: {
          lines: [
            'One of Eduard’s boys was in my chair last night. Two hours of a dragon down his ribs. He cries, by the way. They all cry.',
            'He said your name between whimpers. Something about glue and a next time. I said, “Hold still.” I want you to know I did the dragon’s face very badly on purpose. It looks like a sheep.',
          ],
          choices: [
            { id: 'sheep', label: 'Thank you. For the sheep', reply: 'It’s a beautiful sheep. He’ll have it for life. That’s my kind of insurance.', effects: [{ do: 'flag', flag: 'zoya_sheep' }, { do: 'trust', who: 'zoya', delta: T.trust.warm }] },
            { id: 'careful', label: 'Don’t get involved', reply: 'I’m a tattooist on Sennaya. I’m involved with everybody, up to the elbow, in ink.', effects: [{ do: 'trust', who: 'zoya', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'zoya.box',
      when: [after('zoya.ears', 3, ['tell_me']), { if: 'flag', flag: 'protection.paying' }],
      chance: 0.35,
      visit: {
        who: 'zoya',
        kind: 'scene',
        scene: {
          lines: [
            'So you pay them. Don’t look like that, everyone on Sennaya pays them; I pay them. The cat doesn’t, but the cat has a cleaner record.',
            'Only, one of the boys in my chair said they want a favour from the shops that pay. A box, kept in the back, no questions. When it comes, remember you can say no to a box. You can’t always say no to a man, but a box is just a box.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'zoya_box_warning' }, { do: 'trust', who: 'zoya', delta: T.trust.nod }] } },
      },
    },
    {
      id: 'zoya.yana',
      when: [visits('zoya', 4), after('zoya.ears', 15), visits('yana', 2), { if: 'day', gte: 45 }],
      chance: 0.35,
      final: true,
      visit: {
        who: 'zoya',
        kind: 'scene',
        scene: {
          lines: [
            'I tattooed my sister. Yana, who said for fifteen years that only fools draw on themselves. A tiny anchor, inside her wrist, for our father. She didn’t cry. I did.',
            'Don’t tell her I told you. Do tell her it suits her. She’ll say “it’s nothing”. It isn’t nothing. It’s the best line I’ve ever done.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'zoya_anchor' }, { do: 'trust', who: 'zoya', delta: T.trust.nod }] } },
      },
    },
  ],
}

export const larisa = {
  id: 'larisa',
  title: 'Larisa Kovrigina',
  beats: [
    {
      id: 'larisa.rates',
      when: [visits('larisa', 1)],
      chance: 0.4,
      visit: {
        who: 'larisa',
        kind: 'scene',
        scene: {
          lines: [
            'Before I sell anything: your interest. Monthly, compounded or simple, and what happens on day thirty-one? I’m writing a course paper on informal credit. You’re informal credit.',
            'Most places on Sennaya tell me “it depends on your face”. I’d like it not to depend on my face.',
          ],
          choices: [
            { id: 'show', label: 'Simple, monthly. Here, the sheet', reply: 'A sheet. In writing. You may be the first honest footnote in my paper.', effects: [{ do: 'trust', who: 'larisa', delta: T.trust.warm }] },
            { id: 'depends', label: 'It depends on the item', reply: 'That’s “it depends on your face” in a suit. I’ll write it down anyway.', effects: [{ do: 'trust', who: 'larisa', delta: T.trust.cool }] },
          ],
        },
      },
    },
    {
      id: 'larisa.alisa',
      when: [after('larisa.rates', 3), { if: 'loan', who: 'alisa' }],
      chance: 0.5,
      visit: {
        who: 'larisa',
        kind: 'scene',
        scene: {
          lines: [
            'My sister has a loan with you. Don’t confirm it; I can see it on her face. She pawned the phone again before a gig, and she won’t make the date, because the gig paid in “exposure”.',
            'I’ve brought the interest. Mine, from the tax booth. Put it on her ticket so the clock starts again. Don’t tell her it was me. Tell her it was the universe. She believes in the universe.',
          ],
          choices: [
            { id: 'take', label: 'I’ll put it on her ticket', reply: 'Thank you. Here, counted twice. Write me a receipt. Not for her. For me. I keep a file.', effects: [{ do: 'renew', who: 'alisa', charge: true }, { do: 'trust', who: 'larisa', delta: T.trust.warm }, { do: 'trust', who: 'alisa', delta: T.trust.nod }] },
            { id: 'her_business', label: 'That’s between me and Alisa', reply: 'It’s between you and Alisa and me, because I’ll be paying for it either way. But fine. Correct, even. Annoyingly.', effects: [{ do: 'trust', who: 'larisa', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'larisa.twins',
      when: [visits('larisa', 3), after('larisa.rates', 15), visits('alisa', 3), { if: 'day', gte: 50 }],
      chance: 0.35,
      final: true,
      visit: {
        who: 'larisa',
        kind: 'scene',
        scene: {
          lines: [
            'I went to her gig. Alisa’s. Don’t look surprised; I’m surprised enough for both of us. I stood at the back with my arms folded for one song, and then I unfolded them.',
            'She’s good. She doesn’t need a spreadsheet; she needs a manager. I’ve done her a business plan. Forty pages. She cried. I think in a good way. I’m not sure; she was wearing headphones.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'larisa_manager' }, { do: 'trust', who: 'larisa', delta: T.trust.nod }] } },
      },
    },
  ],
}
