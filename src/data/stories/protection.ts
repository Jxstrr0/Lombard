/**
 * Protection, first half (GDD §8 Pressure, §9; M4). The previous owner, Gusev,
 * left owing the wrong people, and his debt turns out to live at the address.
 *
 *   Week 1     protection.asking   Zhora comes in asking for Gusev, with Gusev's IOU.
 *   Week 2–3   protection.offer    Eduard Lvovich offers "insurance": a share of the
 *                                  till each month (tuning.protection). Accept, talk him
 *                                  down, or refuse. Sets protection.running.
 *   Refused    protection.glue     Glue in the door lock overnight (a locksmith's bill).
 *                                  Pay after all, say you'll go to the police, or hold out.
 *              protection.bakery   Still refusing: the bakery that refused had a fire.
 *                                  Next month he'll "ask properly". (M5: the brick.)
 *   Paying     protection.box      After the first month's payment: keep a box in the
 *              protection.box_late back room, off the books. No answer yet. (M5: fencing.)
 *
 * The monthly charge is in src/game/economy/expenses.ts and runs while
 * protection.paying is set. The arc doesn't end here: M5 picks it up from the
 * flags below. Violence stays off-screen: threats, aftermath, hearsay.
 */
import { tuning } from '../tuning'

/** Story flags this arc sets. Other arcs and M5 read these; don't rename them. */
export const PROTECTION_FLAGS = {
  /** Zhora has told you about Gusev's debt. */
  debt: 'protection.gusev_debt',
  /** The crew has made its offer: the arc is running (Stanislav Lyubimov's beat 3 reads this). */
  running: 'protection.running',
  /** Paying insurance every month. */
  paying: 'protection.paying',
  /** Paying, at the haggled rate. */
  haggled: 'protection.haggled',
  /** Turned the offer down (cleared if you pay after the glue). */
  refused: 'protection.refused',
  /** Told Eduard Lvovich you were going to the police about the glue. */
  toldPolice: 'protection.told_police',
  /** Refusing cliffhanger played: he'll come and "ask properly" next month. */
  warned: 'protection.warned',
  /** Paying cliffhanger played: they want a box kept off the books; no answer yet. */
  boxAsked: 'protection.box_asked',
} as const

const F = PROTECTION_FLAGS
const P = tuning.protection

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen']
/** 0.1 → "ten percent". */
function percent(share: number): string {
  const n = Math.round(share * 100)
  return `${WORDS[n] ?? String(n)} percent`
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const RATE = percent(P.share)
const LOW_RATE = percent(P.haggledShare)

/** After the first month's payment: the favour. No choice yet; M5 asks for the answer. */
const boxScene = {
  lines: [
    'Your first month. Zhora says it was all there, counted, in an envelope. We like neat people.',
    'A small thing, between friends. On Thursday a man brings you a box. Nothing alive, nothing that ticks. It sits in your back room for a week, and it doesn’t go in your book.',
    'Then somebody else collects it and we all forget there was a box. Don’t answer now. Zhora will come for your answer.',
  ],
} as const
const boxAfter = { talked: { effects: [{ do: 'flag', flag: F.boxAsked }] } } as const

export default {
  id: 'protection',
  title: 'Protection',
  beats: [
    {
      id: 'protection.asking',
      when: [{ if: 'day', gte: 3 }],
      chance: 0.5,
      visit: {
        who: 'zhora',
        kind: 'scene',
        // Waiting at the door when you open: he's looking for the owner, not shopping.
        first: true,
        scene: {
          lines: [
            'Gusev.',
            'Yuri Gusev. Had this place. I came in February. He said come back in March. It’s March.',
            'He owes. A hundred and forty thousand. That’s his signature, there. Look.',
          ],
          choices: [
            { id: 'gone', label: 'He’s gone. I bought the shop.', reply: 'Gone. Everybody’s gone. Eduard Lvovich will come by. He likes to talk.' },
            { id: 'not_mine', label: 'His debts aren’t mine.', reply: 'Didn’t say they were. Eduard Lvovich will explain. He explains nice.' },
            { id: 'never_met', label: 'I never met the man.', reply: 'Nobody’s met him. Eleven years behind this counter, and nobody’s met him. Eduard Lvovich will come by.' },
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: F.debt }, { do: 'pressure', delta: P.pressure.asked }] } },
      },
    },
    {
      id: 'protection.offer',
      when: [
        { if: 'beat', beat: 'protection.asking', daysAgo: { gte: 5 } },
        { if: 'day', gte: 9 },
      ],
      chance: 0.4,
      visit: {
        who: 'eduard',
        kind: 'scene',
        scene: {
          lines: [
            'Good afternoon. Eduard Lvovich. Zhora’s waiting outside; he likes the fresh air. He says you were polite with him. That’s rare.',
            'About Gusev’s little paper. We’re not animals. A debt belongs to the man who signed it, and Gusev is in Sochi, or somewhere colder. But the paper stays with the address. Like the damp.',
            'So let’s start clean. This street has broken glass, bored kids and old wiring. We see that none of it happens here.',
            `${cap(RATE)} of what the till clears, last day of the month, never under ${P.minimum.toLocaleString('en-US')} roubles. Insurance. Gusev’s paper goes in the stove.`,
          ],
          choices: [
            {
              id: 'accept',
              label: `${cap(RATE)}. All right.`,
              reply: 'There. A grown-up conversation. Last day of the month, Zhora comes by. You don’t even have to count. Zhora counts.',
              effects: [
                { do: 'flag', flag: F.paying },
                { do: 'rep', group: 'mob', delta: P.rep.accepted },
                { do: 'pressure', delta: P.pressure.accepted },
              ],
            },
            {
              id: 'haggle',
              label: `${cap(LOW_RATE)}, not ${WORDS[Math.round(P.share * 100)]}.`,
              reply: `${cap(LOW_RATE.split(' ')[0]!)}. Because it’s your first month, and because you asked nicely. I’ll remember that you asked.`,
              effects: [
                { do: 'flag', flag: F.paying },
                { do: 'flag', flag: F.haggled },
                { do: 'rep', group: 'mob', delta: P.rep.haggled },
              ],
            },
            {
              id: 'refuse',
              label: 'No. I don’t need insurance.',
              reply: 'Everybody needs insurance. They just don’t know it until the day. Think it over. The offer isn’t going anywhere. Neither are we.',
              effects: [
                { do: 'flag', flag: F.refused },
                { do: 'rep', group: 'mob', delta: P.rep.refused },
                { do: 'pressure', delta: P.pressure.refused },
              ],
            },
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: F.running }] } },
      },
    },
    {
      id: 'protection.glue',
      when: [{ if: 'beat', beat: 'protection.offer', outcome: ['refuse'], daysAgo: { gte: 3 } }],
      chance: 0.5,
      visit: {
        who: 'eduard',
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'Good morning! I passed your locksmith on the bridge. Glue in the lock, he said? Superglue, a whole tube?',
            'Kids, probably. No respect for anything. It isn’t even theft, a thing like that. It’s more of a letter. Shame nobody signed it.',
            'With insurance, Zhora would find the boys and have a word. He’s very good with young people. They listen to him.',
          ],
          choices: [
            {
              id: 'pay',
              label: `All right. ${cap(RATE)}.`,
              reply: 'There, you see? And nobody had to lose a window over it. Last day of the month.',
              effects: [
                { do: 'flag', flag: F.paying },
                { do: 'unflag', flag: F.refused },
                { do: 'rep', group: 'mob', delta: P.rep.gluePaid },
                { do: 'pressure', delta: P.pressure.gluePaid },
              ],
            },
            {
              id: 'police',
              label: 'I’m taking this to the police.',
              reply: 'Do. Ask for the duty officer; he has beautiful handwriting. Then come back and tell me what he wrote.',
              effects: [
                { do: 'flag', flag: F.toldPolice },
                { do: 'rep', group: 'mob', delta: P.rep.gluePolice },
                { do: 'pressure', delta: P.pressure.gluePolice },
              ],
            },
            {
              id: 'refuse',
              label: 'Still no.',
              reply: 'Still no. Fine. I respect it, I honestly do. Only, glass costs more than glue. That’s all I’ll say.',
              effects: [
                { do: 'rep', group: 'mob', delta: P.rep.glueRefused },
                { do: 'pressure', delta: P.pressure.glueRefused },
              ],
            },
          ],
        },
        after: { talked: { effects: [{ do: 'cash', amount: -P.locksmith, text: 'Locksmith: glue in the door lock' }] } },
      },
    },
    {
      id: 'protection.bakery',
      when: [{ if: 'beat', beat: 'protection.glue', outcome: ['police', 'refuse'], daysAgo: { gte: 5 } }],
      chance: 0.5,
      visit: {
        who: 'eduard',
        kind: 'scene',
        scene: {
          lines: [
            'You know Larisa’s bakery, on the corner by the footbridge? Lovely woman. Terrible poppy-seed rolls, but a lovely woman.',
            'She didn’t want insurance either. Tuesday night the wiring went. The whole front room. Nobody hurt, thank God. She lives upstairs; she got out in her dressing gown.',
            'Old buildings. Old wiring. I’m only saying. Next month I’ll come and ask you properly. The way I asked her.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: F.warned }, { do: 'pressure', delta: P.pressure.bakery }] } },
      },
    },
    {
      id: 'protection.box',
      when: [{ if: 'beat', beat: 'protection.offer', outcome: ['accept', 'haggle'], daysAgo: { gte: 21 } }],
      chance: 0.5,
      visit: { who: 'eduard', kind: 'scene', scene: boxScene, after: boxAfter },
    },
    {
      id: 'protection.box_late',
      when: [{ if: 'beat', beat: 'protection.glue', outcome: ['pay'], daysAgo: { gte: 18 } }],
      chance: 0.5,
      visit: { who: 'eduard', kind: 'scene', scene: boxScene, after: boxAfter },
    },
  ],
} as const
