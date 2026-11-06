/**
 * The fence (M5, GDD § 8): Venya Mostovoy, the night man on the Kupetsky drawbridge
 * (src/data/fence.ts). Three authored beats; his ordinary calls and drop-ins between
 * them are planned by src/game/crime/fence.ts, not by beats.
 *
 * - meet: he comes in to keep the previous owner's Tuesdays. Keep them, or say this
 *   isn't that kind of shop (his first no, in the notebook). Either way he's met and
 *   keeps in touch; how often, at what prices and in what voice depends on what you
 *   do from then on.
 * - notebook: after tuning.fence.notebookAt refusals, he rings and reads you his
 *   notebook. Ask him to bring something good (he comes soon, a little warmer), or
 *   tell him to lose your number (one more no, and he leaves you alone for a month).
 * - standing: after enough deals and trust, he brings his mother's pirozhki and
 *   asks to make it standing. Yes is a dirty choice (dirty.fence_standing).
 *
 * Choice ids: fence_yes is the friendly answer, refuse the clean one (the sim's
 * careful policy prefers refuse, its fence policy fence_yes).
 */
import { tuning } from '../tuning'

const F = tuning.fence

export default {
  id: 'fence',
  title: 'Venya Mostovoy',
  beats: [
    {
      id: 'fence.meet',
      when: [{ if: 'day', gte: F.meetDay }],
      chance: F.meetChance,
      visit: {
        who: 'fence',
        kind: 'scene',
        scene: {
          lines: [
            'Good morning. You’re the new owner. I’m Venya. People say Mostovoy, because of the bridge: I raise the Kupetsky at twenty-five past one and lower it at ten to five.',
            'Yuri Gusev and I had Tuesdays. Things come over the river while the bridge is up, and some of them need a new home by morning. Some of his things needed one too, near the end.',
            'No pressure. I’m not those gentlemen with the clean cars. I’m a man with a cardigan and a mother. Shall I keep the Tuesdays?',
          ],
          choices: [
            {
              id: 'fence_yes',
              label: 'Keep the Tuesdays',
              reply: 'Lovely. I’ll ring, or I’ll drop by. I’m never late. The bridge taught me that.',
              effects: [{ do: 'fence', change: 'meet_yes' }],
            },
            {
              id: 'refuse',
              label: 'Not that kind of shop',
              reply: 'Nobody is, at first. I’ll write it down, if you don’t mind. Not to hold it against you. I just have a terrible memory, so I keep a notebook.',
              effects: [{ do: 'fence', change: 'meet_no' }],
            },
          ],
        },
      },
    },
    {
      id: 'fence.notebook',
      when: [
        { if: 'beat', beat: 'fence.meet' },
        { if: 'fence', met: true, refusals: { gte: F.notebookAt } },
      ],
      chance: 0.5,
      visit: {
        who: 'fence',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Venya. Mostovoy. The bridge. I was going through my notebook last night, between two barges.',
            'You’re on three pages. All no. In pencil, with the dates. My mother says important things go in pen, but pencil is kinder.',
            'I’m not angry. I’m thorough. But a man stops ringing a number that only ever says no. So: do I keep ringing?',
          ],
          choices: [
            {
              id: 'fence_yes',
              label: 'Bring me something good',
              reply: 'Something good. Yes. And a fair price, to start again. I’ll rub out a page.',
              effects: [{ do: 'fence', change: 'notebook_yes' }],
            },
            {
              id: 'refuse',
              label: 'Lose my number',
              reply: 'I don’t lose things. That’s rather my whole profession. But I’ll stop ringing for a while. The notebook stays open.',
              effects: [{ do: 'fence', change: 'notebook_no' }],
            },
          ],
        },
      },
    },
    {
      id: 'fence.standing',
      when: [
        { if: 'beat', beat: 'fence.meet' },
        { if: 'fence', met: true, deals: { gte: F.standing.deals }, trust: { gte: F.standing.trust } },
      ],
      chance: 0.5,
      visit: {
        who: 'fence',
        kind: 'scene',
        scene: {
          lines: [
            'Pirozhki. Cabbage. My mother made too many. She always makes too many; she thinks I still have a bridge crew to feed.',
            'We’ve done well, you and I. Nobody has come asking. Nobody comes asking because I’m careful what I bring you.',
            'So I’d like to make it standing. I ring you first, before the Fly on Sennaya, before anyone. And when something gets warm on your shelf, I take it. No questions, either way.',
          ],
          choices: [
            {
              id: 'fence_yes',
              label: 'Ring me first',
              reply: 'Then it’s standing. I’ll move you into pen.',
              effects: [
                { do: 'fence', change: 'standing' },
                { do: 'flag', flag: 'dirty.fence_standing' },
                { do: 'heat', delta: F.standing.heat },
                { do: 'rep', group: 'mob', delta: F.standing.mobRep },
              ],
            },
            {
              id: 'refuse',
              label: 'Let’s keep it casual',
              reply: 'Casual. Like the weather. Eat the pirozhki anyway; they don’t know what you said.',
              effects: [{ do: 'fence', change: 'casual' }],
            },
          ],
        },
      },
    },
  ],
} as const
