/**
 * M6 small threads for the twenty new regulars (src/data/regulars): two to four beats each,
 * gated on how often they've been in, so a thread unfolds over their ordinary visits rather
 * than on a calendar. Mostly scenes (they come on top of the day; they don't take a walk-in's
 * place). Numbers: tuning.threads. A few read other arcs' flags (Protection, the laptop, the
 * Brashpilevs, Volkova) without changing those systems.
 *
 * This file: Artur Kim, the Rakhimovs (Bakhtiyor, Dilnoza, Jamshid), Patimat Aliyeva.
 */
import { tuning } from '../../tuning'

const T = tuning.threads
const visits = (who: string, gte: number) => ({ if: 'visits', who, gte }) as const
const after = (beat: string, days: number, outcome?: string[]) =>
  ({ if: 'beat', beat, daysAgo: { gte: days }, ...(outcome ? { outcome } : {}) }) as const

export const artur = {
  id: 'artur',
  title: 'Artur Kim',
  beats: [
    {
      id: 'artur.alisa',
      when: [visits('artur', 2), visits('alisa', 2)],
      chance: 0.4,
      visit: {
        who: 'artur',
        kind: 'scene',
        scene: {
          lines: [
            'Question. There’s a girl, a student, plays the bar at the Polytechnic. Headphones on a hoodie. Someone said she pawns her phone here before every gig.',
            'I don’t want her secrets. I want to know if she’s any good. Podval needs a warm-up for Thursdays and I’m tired of warming up for myself.',
          ],
          choices: [
            { id: 'recommend', label: 'She’s good. Give her a go', reply: 'Then she gets a Thursday. If she clears the floor, I’m blaming you.', effects: [{ do: 'flag', flag: 'artur_alisa_slot' }, { do: 'trust', who: 'artur', delta: T.trust.nod }, { do: 'trust', who: 'alisa', delta: T.trust.nod }] },
            { id: 'ask_her', label: 'Ask her yourself', reply: 'Fair. You don’t talk about people. That’s why people talk to you.', effects: [{ do: 'trust', who: 'artur', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'artur.insurance',
      when: [visits('artur', 3), { if: 'beat', beat: 'artur.alisa' }, { if: 'flag', flag: 'protection.running' }],
      chance: 0.35,
      visit: {
        who: 'artur',
        kind: 'scene',
        scene: {
          lines: [
            'Podval’s got a new sound system. Lovely bass. It came with a man who stands by the door and doesn’t dance.',
            'Two gentlemen sold the owner “insurance”. One talks like a vicar. The other one just stands. I think they come as a pair, like speakers.',
            'I’m only the DJ. I don’t ask. You might want to, though. They said your street was “next on the list”.',
          ],
        },
      },
    },
    {
      id: 'artur.weddings',
      when: [visits('artur', 4), after('artur.alisa', 10), { if: 'day', gte: 55 }],
      chance: 0.35,
      final: true,
      visit: {
        who: 'artur',
        kind: 'scene',
        scene: {
          lines: [
            'Podval’s shut. Fire inspector. The owner’s in Turkey, “resting”. The man who stood by the door is standing by somebody else’s door now.',
            'So I’m doing weddings. Ernest from the Fregat plays the trumpet, then I play between sets. Old people dance to him, young people dance to me, and at two in the morning everyone dances to “Kalinka”. It pays on the day. On the actual day.',
          ],
          choices: [
            { id: 'luck', label: 'Every wedding needs a DJ', reply: 'That’s what I said! The brides’ mothers disagree. Then they hear the bass.', effects: [{ do: 'flag', flag: 'artur_weddings' }, { do: 'trust', who: 'artur', delta: T.trust.nod }] },
          ],
        },
      },
    },
  ],
}

export const bakhtiyor = {
  id: 'bakhtiyor',
  title: 'Bakhtiyor Rakhimov',
  beats: [
    {
      id: 'bakhtiyor.wall',
      when: [visits('bakhtiyor', 2), { if: 'weekday', in: [4] }],
      chance: 0.5,
      visit: {
        who: 'bakhtiyor',
        kind: 'seller',
        scene: {
          lines: [
            'Good afternoon. A strange thing. We took down a wall on the old house by the embankment, the one with the lions. Inside the wall, wrapped in a newspaper from 1961: this.',
            'The foreman said, keep it, nobody knows. I said, God knows. He said God doesn’t buy watches. So I came to you. What do I do?',
          ],
          choices: [
            { id: 'look', label: 'Let me look at it', reply: 'Look. If it is worth something, I will think about who it belongs to. If it is worth nothing, I will think less.' },
            {
              id: 'police',
              label: 'Take it to the police',
              reply: 'To the police. Yes. My cousin will say I am mad. My wife will say I am right. My wife is usually right; it is very tiring.',
              end: true,
              effects: [{ do: 'flag', flag: 'bakhtiyor_handed_in' }, { do: 'heat', delta: T.heat.handIn }, { do: 'rep', group: 'police', delta: T.rep.small }, { do: 'trust', who: 'bakhtiyor', delta: T.trust.warm }],
            },
          ],
        },
        item: { defId: 'watch_pobeda_gold', authenticity: 'genuine', provenance: 'unknown', condition: [40, 60], story: 'Found inside a wall on the embankment, wrapped in a 1961 newspaper.' },
        line: 'Gold, I think. It was still ticking when I wound it. Fifty years in a wall, and it was waiting.',
        after: {
          bought: { line: 'Then it is yours, and the wall’s secret is yours too. I will tell my daughters a pawnbroker solved a mystery.', effects: [{ do: 'flag', flag: 'bakhtiyor_wall_sold' }] },
          pawned: { line: 'Then you keep it safe while I decide. Safe is the right word.' },
          passed: { line: 'Then I will keep it in my coat until I know. It is heavier than it looks.' },
        },
      },
    },
    {
      id: 'bakhtiyor.daughters',
      when: [visits('bakhtiyor', 4), after('bakhtiyor.wall', 14), { if: 'weekday', in: [4] }, { if: 'day', gte: 40 }],
      chance: 0.4,
      final: true,
      visit: {
        who: 'bakhtiyor',
        kind: 'scene',
        scene: {
          lines: [
            'Good afternoon. I will not sell anything today. Today I came to boast.',
            'My Madina won the district olympiad in Russian literature. In Russian! Her teacher, Elvira Arkadyevna, came to our door herself, in the rain, to tell us. My wife cried. I said it was the onions. There were no onions.',
          ],
          choices: [
            { id: 'congrats', label: 'Congratulations to Madina', reply: 'I will tell her the pawnbroker said so. She will ask what a pawnbroker is. Then she will write an essay about it.', effects: [{ do: 'trust', who: 'bakhtiyor', delta: T.trust.warm }, { do: 'flag', flag: 'bakhtiyor_madina' }] },
          ],
        },
      },
    },
  ],
}

export const dilnoza = {
  id: 'dilnoza',
  title: 'Dilnoza Rakhimova',
  beats: [
    {
      id: 'dilnoza.letter',
      when: [visits('dilnoza', 2)],
      chance: 0.4,
      visit: {
        who: 'dilnoza',
        kind: 'scene',
        scene: {
          lines: [
            'Read this. No, read it aloud, I want to hear how stupid it sounds in a Russian voice.',
            '“For the improvement of the urban environment, temporary trade structures at public transport stops are to be removed by the first of April.” Temporary! I have been temporary for eleven years.',
          ],
          choices: [
            {
              id: 'petition',
              label: 'Get the stop to sign a petition',
              reply: 'A petition. Yes. Everyone at that stop owes me something: change, cigarettes, gossip. Now they will owe me a signature.',
              effects: [{ do: 'flag', flag: 'dilnoza_petition' }, { do: 'rep', group: 'neighbourhood', delta: T.rep.small }, { do: 'trust', who: 'dilnoza', delta: T.trust.warm }],
            },
            { id: 'sorry', label: 'I’m sorry. That’s the council', reply: 'The council. The council never bought one samsa from me. That is the whole problem.', effects: [{ do: 'trust', who: 'dilnoza', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'dilnoza.kept',
      when: [after('dilnoza.letter', 18, ['petition'])],
      chance: 0.5,
      final: true,
      visit: {
        who: 'dilnoza',
        kind: 'scene',
        scene: {
          lines: [
            'Three hundred and twelve signatures. Valentin Egorovich signed twice, once for his wife. The tram driver signed on the tram. The detective lady signed and said she had not.',
            'The council is “reviewing”. In Mostograd, reviewing means they forget. I am staying. Here, the first samsa of the reprieve. Hot. Careful.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'dilnoza_kiosk_stays' }, { do: 'endArc' }] } },
      },
    },
    {
      id: 'dilnoza.moved',
      when: [after('dilnoza.letter', 18, ['sorry'])],
      chance: 0.5,
      final: true,
      visit: {
        who: 'dilnoza',
        kind: 'scene',
        scene: {
          lines: [
            'They came at night with a crane, like thieves, and took the kiosk away on a lorry. Eleven years on a lorry. I watched from the stop.',
            'Lyusya from the bakery gave me a corner by her ovens. Now her bread and my samsa sit side by side, and the queue is twice as long, and she says it is the bread. It is the samsa.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'dilnoza_bakery' }, { do: 'endArc' }] } },
      },
    },
  ],
}

export const jamshid = {
  id: 'jamshid',
  title: 'Jamshid Rakhimov',
  beats: [
    {
      id: 'jamshid.monday',
      when: [visits('jamshid', 1), { if: 'loan', who: 'jamshid', not: true }],
      chance: 0.45,
      visit: {
        who: 'jamshid',
        kind: 'seller',
        wants: 'pawn',
        scene: {
          lines: [
            'Good day. The foreman has not paid us for two months. He says Monday. My mother needs an operation on her eyes in Samarkand, and the doctor does not say Monday, he says now.',
            'Bakhtiyor says pawn, don’t sell, because the foreman will pay. One day. Bakhtiyor believes in people. I believe in Bakhtiyor.',
          ],
        },
        item: { defId: 'watch_vostok_komandirskie', authenticity: 'genuine', provenance: 'heirloom', condition: [55, 75], story: 'His grandfather’s army watch. Pawned until the foreman pays.' },
        line: 'My grandfather’s watch. I will come back for it. On a Monday, maybe.',
        redeem: {
          days: [10, 18],
          chance: 0.85,
          line: 'He paid! All of it, both months. I will tell you how. First, the watch, please. Here is the money and the interest. I counted on the tram.',
          thanks: 'Hello, grandfather. You see, I told you this city is not so bad.',
        },
        after: {
          pawned: { line: 'Thank you. I will send the money tonight. My mother will say I am a good son. I am a son with a pawn ticket.' },
          passed: { line: 'Then I will ask the men in the cabin. They have nothing either, but they will give me half of it.' },
          walked: { line: 'That is not enough for an eye. Not even one.' },
        },
      },
    },
    {
      id: 'jamshid.paid',
      when: [{ if: 'beat', beat: 'jamshid.monday' }, { if: 'pledge', beat: 'jamshid.monday', is: ['redeemed'], daysAgo: { gte: 1 } }, { if: 'volkova', met: true }],
      chance: 0.5,
      visit: {
        who: 'jamshid',
        kind: 'scene',
        scene: {
          lines: [
            'I promised to tell you how the foreman paid. A detective came to the site. A lady, a tired one, in a brown jacket. She was asking about a stolen van, nothing to do with us.',
            'But the foreman saw police and suddenly he found two months of wages in his car. In an envelope! Everyone got paid before she finished her first question. She looked very confused.',
            'My mother’s operation went well. She can see again. The first thing she saw was my photograph and she said I look thin.',
          ],
        },
        after: { talked: { effects: [{ do: 'trust', who: 'jamshid', delta: T.trust.nod }, { do: 'flag', flag: 'jamshid_mother_sees' }] } },
      },
    },
    {
      id: 'jamshid.home',
      when: [visits('jamshid', 3), after('jamshid.monday', 20), { if: 'day', gte: 70 }],
      chance: 0.35,
      final: true,
      visit: {
        who: 'jamshid',
        kind: 'scene',
        scene: {
          lines: [
            'Good day. I came to say goodbye, for the summer. I am going home to Urgut. My mother has found me a wife. I have seen her photograph; she has seen mine. We were both disappointed and both said yes.',
            'In the autumn I come back. Bakhtiyor says the next building is twelve floors. I will carry every brick and think of my wife and this city, and which is colder.',
          ],
          choices: [{ id: 'safe', label: 'Safe journey. Come back', reply: 'I will. Keep the cold here for me.', effects: [{ do: 'trust', who: 'jamshid', delta: T.trust.nod }, { do: 'flag', flag: 'jamshid_wedding' }] }],
        },
      },
    },
  ],
}

export const patimat = {
  id: 'patimat',
  title: 'Patimat Aliyeva',
  beats: [
    {
      id: 'patimat.invite',
      when: [visits('patimat', 3)],
      chance: 0.4,
      visit: {
        who: 'patimat',
        kind: 'scene',
        scene: {
          lines: [
            'Today I am not selling. Today I am inviting. Here: a card. Gold letters. The hall in Makhachkala holds five hundred, and we are four hundred and six, so there is room for you.',
            'I know you will not come. It is a long way and you have a shop. But in our family you invite everyone who was kind, so that God sees the list.',
          ],
          choices: [
            {
              id: 'gift',
              label: 'Send a gift for the couple',
              reply: 'A gift! For my son, from the pawn shop in Mostograd. He will put it on the table with the others and tell everyone the story. He tells stories badly. I will tell it for him.',
              effects: [{ do: 'cash', amount: -T.cash.patimatGift, text: 'Wedding present, Patimat Aliyeva’s son' }, { do: 'flag', flag: 'heart.patimat_gift' }, { do: 'trust', who: 'patimat', delta: T.trust.big }],
            },
            { id: 'decline', label: 'Thank you. I’m honoured', reply: 'Honoured is enough. Not everyone is honoured. Some people just ask how many courses.', effects: [{ do: 'trust', who: 'patimat', delta: T.trust.nod }] },
          ],
        },
      },
    },
    {
      id: 'patimat.photos',
      when: [after('patimat.invite', 20)],
      chance: 0.5,
      final: true,
      visit: {
        who: 'patimat',
        kind: 'scene',
        scene: {
          lines: [
            'Look. No, look properly, you’re going too fast. That is the hall. That is my son, in a suit I took in by two centimetres the night before. That is the bride. She is a pharmacist; she will keep him alive.',
            'Four hundred and twelve came. Six more than invited. Nobody knows who they were. They danced the best.',
          ],
        },
        after: { talked: { effects: [{ do: 'trust', who: 'patimat', delta: T.trust.nod }] } },
      },
    },
  ],
}
