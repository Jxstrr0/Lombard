/**
 * Stanislav Edgarovich Lyubimov, antiques dealer (GDD § 2b): never wrong,
 * rarely honest, friends with the crew. Leaves a card (seeds Protection);
 * sends round a seller with "family silver"; offers to have a word with the
 * crew while Protection runs. His fourth beat (an icon through your books)
 * needs Volkova and The Collector, so it waits for M5 (docs/05 § Parked).
 *
 * Flags other arcs read: protection.stanislav_card (he left his card),
 * stanislav_owed and protection.stanislav_word (you let him have a word: no
 * pressure for a month from that beat's day: the Protection ladder's rungs wait
 * tuning.protection.ladder.wordDays, and pressure drops). Reads protection.running.
 */
import { tuning } from '../tuning'

export default {
  id: 'stanislav',
  title: 'Stanislav Edgarovich Lyubimov',
  specialist: 'antiquary',
  beats: [
    {
      id: 'stanislav.card',
      when: [{ if: 'retainedMonths', id: 'antiquary', gte: 1 }],
      chance: 0.5,
      visit: {
        who: 'antiquary',
        kind: 'scene',
        scene: {
          lines: [
            'My dear, what a charming little shop. The light! The damp! One could almost believe in honest trade.',
            'You know, I’m friendly with the gentlemen who look after this street. Thoughtful men. Very clean cars.',
            'My card. If anyone is ever unkind to you, or to your windows, ring me before you ring anyone else.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'protection.stanislav_card' }] } },
      },
    },
    {
      id: 'stanislav.silver',
      when: [
        { if: 'beat', beat: 'stanislav.card' },
        { if: 'retainedMonths', id: 'antiquary', gte: 2 },
      ],
      chance: 0.5,
      visit: {
        who: 'antiquary',
        as: { name: 'Arkady', archetype: 'hustler', look: 'male_adult_07', temperament: 'flexible', knowledge: 0.6, desperation: 0.7 },
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: [
            'Stanislav Edgarovich sent me. He said you’re discreet. I’m discreet too, so that’s two of us.',
            'Family silver. My grandmother’s. She kept it in the sideboard with the good spoons. The spoons are gone. This isn’t.',
          ],
        },
        item: { defId: 'coin_rouble_1877', authenticity: 'genuine', provenance: 'stolen', condition: [70, 90], story: 'Family silver, Stanislav Edgarovich said you’d understand.' },
        line: 'Grandmother’s. Or Grandfather’s. One of them. They’re in Sochi. Or the cemetery. Look, do you want it or not?',
        after: {
          bought: {
            line: 'Pleasure. Stanislav Edgarovich will be pleased. He likes it when everybody is pleased.',
            effects: [{ do: 'flag', flag: 'dirty.stanislav_silver' }, { do: 'heat', delta: 0.05 }],
          },
          passed: {
            line: 'Your loss. He won’t like this, you know. He’s sensitive.',
            effects: [{ do: 'specialist', id: 'antiquary', change: 'stanislav.turned_away' }],
          },
        },
      },
    },
    {
      id: 'stanislav.word',
      when: [
        { if: 'beat', beat: 'stanislav.card' },
        { if: 'flag', flag: 'protection.running' },
        { if: 'specialist', id: 'antiquary', relationship: { gte: 0.4 } },
      ],
      chance: 0.6,
      visit: {
        who: 'antiquary',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'My dear. I hear our friends with the clean cars have been to see you. Tiresome of them.',
            'I could have a word. Nothing vulgar. A word over dinner, and they would forget your address for a month.',
            'And one day I might ask a small kindness in return. That’s all. That’s how friends work.',
          ],
          choices: [
            {
              id: 'accept',
              label: 'Have a word',
              reply: 'Consider it done. Sleep well, my dear. You owe me nothing. Yet.',
              // M5: the crew eases off (pressure), and the Protection ladder waits tuning.protection.ladder.wordDays.
              effects: [
                { do: 'flag', flag: 'stanislav_owed' },
                { do: 'flag', flag: 'protection.stanislav_word' },
                { do: 'pressure', delta: tuning.protection.pressure.stanislavWord },
              ],
            },
            {
              id: 'decline',
              label: 'I’ll manage',
              reply: 'How brave. How tiring. Well, the offer stands until it doesn’t.',
            },
          ],
        },
      },
    },
  ],
} as const
