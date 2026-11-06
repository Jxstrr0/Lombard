/**
 * Stanislav Edgarovich Lyubimov, antiques dealer (GDD § 2b): never wrong,
 * rarely honest, friends with the crew. Leaves a card (seeds Protection);
 * sends round a seller with "family silver"; offers to have a word with the
 * crew while Protection runs; and (M5) asks you to put one of his icons through
 * your books as an unredeemed pawn, to give it a past (stanislav.icon). That
 * icon is his own client's business, not The Collector's church icon: its own
 * flags (stanislav.icon_*), and Volkova's arc asks about it (volkova.icon).
 *
 * Flags other arcs read: protection.stanislav_card (he left his card),
 * stanislav_owed and protection.stanislav_word (you let him have a word: no
 * pressure for a month from that beat's day: the Protection ladder's rungs wait
 * tuning.protection.ladder.wordDays, and pressure drops), stanislav.icon_booked
 * (the icon went through your books), stanislav.icon_told (you told the police;
 * he's gone abroad and off your retainer). Reads protection.running, crime.volkova.
 */
import { tuning } from '../tuning'

const I = tuning.volkovaArc.stanislavIcon

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
    {
      // GDD § 2b beat 4: you owe him one, or the police know your shop. Do it, refuse, or tell Volkova.
      id: 'stanislav.icon',
      when: [
        { if: 'beat', beat: 'stanislav.card' },
        { if: 'retainedMonths', id: 'antiquary', gte: I.months },
        { if: 'any', of: [{ if: 'flag', flag: 'stanislav_owed' }, { if: 'volkova', met: true }] },
      ],
      chance: 0.4,
      final: true,
      visit: {
        who: 'antiquary',
        kind: 'scene',
        scene: {
          lines: [
            'My dear. A small kindness, as promised. An icon: Saint Nicholas, northern school, very sad eyes. A client of mine adores it, and a client of mine is buying it.',
            'The trouble is it has no past. Things without a past make customs officers curious. So: it sits in your book as a pledge from last spring, nobody comes back for it, and you sell it to me. Paper, that’s all.',
            'There’s a fee, naturally. I’m not a barbarian.',
          ],
          choices: [
            {
              id: 'book',
              label: 'Put it in my book',
              reply: 'You’re a treasure. A pledge from last April; a widow, I think, with a cough. Her name will come to me.',
              effects: [
                { do: 'flag', flag: 'stanislav.icon_booked' },
                { do: 'flag', flag: 'dirty.stanislav_icon' },
                { do: 'cash', amount: I.fee, text: 'Stanislav Edgarovich: for the paperwork' },
                { do: 'heat', delta: I.bookedHeat },
                { do: 'rep', group: 'mob', delta: I.bookedRep },
              ],
            },
            {
              id: 'refuse',
              label: 'Not in my book',
              reply: 'Pity. I’d so hoped we were friends. Our friends with the clean cars will be sorry to hear we aren’t.',
              effects: [
                { do: 'flag', flag: 'stanislav.icon_refused' },
                { do: 'specialist', id: 'antiquary', change: 'stanislav.turned_away' },
                { do: 'rep', group: 'mob', delta: I.refusedRep },
                { do: 'pressure', delta: I.refusedPressure },
              ],
            },
            {
              id: 'tell',
              label: 'I’ll mention it to the police',
              reply: 'Will you. Well. My doctor has been begging me to take the waters somewhere far away. I think I’ll listen to him at last.',
              effects: [
                { do: 'flag', flag: 'stanislav.icon_told' },
                { do: 'specialist', id: 'antiquary', change: 'stanislav.vanishes' },
                { do: 'heat', delta: I.toldHeat },
                { do: 'pressure', delta: I.toldPressure },
                { do: 'volkova', trust: tuning.volkovaArc.trust.iconTruth },
              ],
            },
          ],
        },
      },
    },
  ],
} as const
