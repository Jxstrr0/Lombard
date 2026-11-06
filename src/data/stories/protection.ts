/**
 * Protection (GDD §8 Pressure, §9). The previous owner, Gusev, left owing the wrong
 * people, and his debt turns out to live at the address.
 *
 * First half (M4):
 *   Week 1     protection.asking   Zhora comes in asking for Gusev, with Gusev's IOU.
 *   Week 2–3   protection.offer    Eduard Lvovich offers "insurance": a share of the
 *                                  till each month (tuning.protection). Accept, talk him
 *                                  down, or refuse. Sets protection.running.
 *   Refused    protection.glue     Glue in the door lock overnight (a locksmith's bill).
 *                                  Pay after all, say you'll go to the police, or hold out.
 *              protection.bakery   Still refusing: the bakery that refused had a fire.
 *                                  Next month he'll "ask properly".
 *   Paying     protection.box      After the first month's payment: keep a box in the
 *              protection.box_late back room, off the books. No answer yet.
 *
 * Second half (M5), the ladder for refusers. Each rung waits for the last and for the
 * pressure dial (tuning.protection.ladder). Stanislav Lyubimov's word (stanislav.word)
 * holds every rung for a month and lowers the dial, so a rung may never come:
 *              protection.properly    He asks properly. Pay, or no: that night, a brick
 *                                     through the counter case (src/game/crime/vandalism.ts).
 *              protection.brick_news  The morning paper.
 *              protection.window      He's heard about your glass. Pay, or no.
 *              protection.ultimatum   The landlord is a friend of theirs. Pay what you "owe"
 *                                     and the monthly share, or no.
 *              protection.street      A week later, if the street stands with you
 *                                     (neighbourhood standing): they go elsewhere. Arc over.
 *              protection.out         Otherwise the lease ends: pushed out (endCareer).
 * And for payers (M5): fewer thefts (src/game/shop/theft.ts), Zhora's answer about the box
 * (protection.box_answer), and the crew's own deliveries (protection.delivery_*): stolen
 * pieces that open at half what they'd fetch, and draw heat if you buy.
 *
 * The monthly charge is in src/game/economy/expenses.ts and runs while protection.paying is
 * set; each month paid counts dirty on the ending axes, each "no" clean. Playing the crew
 * against the police (protection.told_police, Volkova) is a later beat. Violence stays
 * off-screen: threats, aftermath, the morning paper.
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
  /** Turned the offer down (cleared once you pay). */
  refused: 'protection.refused',
  /** Told Eduard Lvovich you were going to the police about the glue. */
  toldPolice: 'protection.told_police',
  /** Refusing cliffhanger played: he'll come and "ask properly" next month. */
  warned: 'protection.warned',
  /** Paying cliffhanger played: they want a box kept off the books; no answer yet. */
  boxAsked: 'protection.box_asked',
  // --- M5 ---
  /** Said yes to the box: it sat in the back room for a week. */
  boxKept: 'protection.box_kept',
  /** Said no to the box. */
  boxRefused: 'protection.box_refused',
  /** Refused the landlord's message: next week settles it. */
  lastRefused: 'protection.last_refused',
  /** Held out to the end and the crew went elsewhere (the honest shop's arc). */
  heldOut: 'protection.held_out',
  /** Pushed out: the lease ended, and the career with it. */
  pushedOut: 'protection.pushed_out',
  /** Stanislav Lyubimov had a word for you (his arc sets it; the ladder reads it). */
  stanislavWord: 'protection.stanislav_word',
} as const

const F = PROTECTION_FLAGS
const P = tuning.protection
const L = P.ladder
const PR = P.pressure
const REP = P.rep
const D = P.delivery

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen']
/** 0.1 → "ten percent". */
function percent(share: number): string {
  const n = Math.round(share * 100)
  return `${WORDS[n] ?? String(n)} percent`
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const RATE = percent(P.share)
const LOW_RATE = percent(P.haggledShare)

/** Stanislav's word holds the ladder: no rung while it's fresh. */
const quiet = {
  if: 'any',
  of: [
    { if: 'flag', flag: F.stanislavWord, not: true },
    { if: 'beat', beat: 'stanislav.word', daysAgo: { gte: L.wordDays } },
  ],
} as const

/** Saying no to the crew: it counts clean, and costs standing with them. */
const no = (rep: number, pressure: number) =>
  [
    { do: 'axis', axis: 'clean', weight: 'protectionRefused' },
    { do: 'rep', group: 'mob', delta: rep },
    { do: 'pressure', delta: pressure },
  ] as const

/** Paying after all: the monthly charge runs from now on. */
const pay = (rep: number, pressure: number) =>
  [
    { do: 'flag', flag: F.paying },
    { do: 'unflag', flag: F.refused },
    { do: 'rep', group: 'mob', delta: rep },
    { do: 'pressure', delta: pressure },
  ] as const

/** Every beat where you start paying, with the answers that mean yes. */
const PAY_BEATS = [
  ['protection.offer', ['accept', 'haggle']],
  ['protection.glue', ['pay']],
  ['protection.properly', ['pay']],
  ['protection.window', ['pay']],
  ['protection.ultimatum', ['pay']],
] as const

/** Paying, and you started at least `days` ago. */
const payingFor = (days: number) =>
  [
    { if: 'flag', flag: F.paying },
    { if: 'any', of: PAY_BEATS.map(([beat, outcome]) => ({ if: 'beat', beat, outcome: [...outcome], daysAgo: { gte: days } })) },
  ] as const

/** After any of the crew's deliveries. */
const deliveryAfter = {
  bought: {
    line: 'Good. Nobody asks, nobody tells. Same as the envelope.',
    effects: [
      { do: 'heat', delta: D.heat },
      { do: 'rep', group: 'mob', delta: REP.deliveryBought },
    ],
  },
  passed: {
    line: 'Your choice. Eduard Lvovich will hear you’re choosy.',
    effects: [
      { do: 'rep', group: 'mob', delta: REP.deliveryPassed },
      { do: 'pressure', delta: PR.deliveryPassed },
    ],
  },
  walked: {
    line: 'Too cheap for you, too dear for you. Hm.',
    effects: [
      { do: 'rep', group: 'mob', delta: REP.deliveryPassed },
      { do: 'pressure', delta: PR.deliveryPassed },
    ],
  },
} as const

/** The crew's own delivery: Zhora with a stolen piece, opening at half what it'd fetch. */
function delivery(
  id: string,
  after: readonly unknown[],
  item: { defId: string; condition: [number, number]; story: string },
  scene: [string, ...string[]],
  line: string,
) {
  return {
    id,
    when: [...payingFor(D.firstAfter), ...after],
    chance: 0.5,
    visit: {
      who: 'zhora',
      kind: 'seller',
      wants: 'sell',
      anchor: D.anchor,
      scene: { lines: scene },
      item: { ...item, authenticity: 'genuine', provenance: 'stolen' },
      line,
      after: deliveryAfter,
    },
  } as const
}

/** After the first month's payment: the favour. No choice yet; Zhora comes for the answer. */
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
        after: { talked: { effects: [{ do: 'flag', flag: F.debt }, { do: 'pressure', delta: PR.asked }] } },
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
                { do: 'rep', group: 'mob', delta: REP.accepted },
                { do: 'pressure', delta: PR.accepted },
              ],
            },
            {
              id: 'haggle',
              label: `${cap(LOW_RATE)}, not ${WORDS[Math.round(P.share * 100)]}.`,
              reply: `${cap(LOW_RATE.split(' ')[0]!)}. Because it’s your first month, and because you asked nicely. I’ll remember that you asked.`,
              effects: [
                { do: 'flag', flag: F.paying },
                { do: 'flag', flag: F.haggled },
                { do: 'rep', group: 'mob', delta: REP.haggled },
              ],
            },
            {
              id: 'refuse',
              label: 'No. I don’t need insurance.',
              reply: 'Everybody needs insurance. They just don’t know it until the day. Think it over. The offer isn’t going anywhere. Neither are we.',
              effects: [{ do: 'flag', flag: F.refused }, ...no(REP.refused, PR.refused)],
            },
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: F.running }] } },
      },
    },
    {
      id: 'protection.glue',
      when: [{ if: 'beat', beat: 'protection.offer', outcome: ['refuse'], daysAgo: { gte: 3 } }, quiet],
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
              effects: pay(REP.gluePaid, PR.gluePaid),
            },
            {
              id: 'police',
              label: 'I’m taking this to the police.',
              reply: 'Do. Ask for the duty officer; he has beautiful handwriting. Then come back and tell me what he wrote.',
              effects: [{ do: 'flag', flag: F.toldPolice }, ...no(REP.gluePolice, PR.gluePolice)],
            },
            {
              id: 'refuse',
              label: 'Still no.',
              reply: 'Still no. Fine. I respect it, I honestly do. Only, glass costs more than glue. That’s all I’ll say.',
              effects: no(REP.glueRefused, PR.glueRefused),
            },
          ],
        },
        after: { talked: { effects: [{ do: 'cash', amount: -P.locksmith, text: 'Locksmith: glue in the door lock' }] } },
      },
    },
    {
      id: 'protection.bakery',
      when: [{ if: 'beat', beat: 'protection.glue', outcome: ['police', 'refuse'], daysAgo: { gte: 5 } }, quiet],
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
        after: { talked: { effects: [{ do: 'flag', flag: F.warned }, { do: 'pressure', delta: PR.bakery }] } },
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

    // --- M5: the ladder for refusers ---------------------------------------------------
    {
      id: 'protection.properly',
      when: [
        { if: 'beat', beat: 'protection.bakery', daysAgo: { gte: L.properlyAfter } },
        { if: 'flag', flag: F.refused },
        { if: 'pressure', gte: L.properlyAt },
        quiet,
      ],
      chance: 0.5,
      visit: {
        who: 'eduard',
        kind: 'scene',
        scene: {
          lines: [
            'I said I’d come back and ask properly. Here I am. No Zhora today; I asked him to wait by the car. This is between us.',
            'You’ve been brave. People on the street talk about it. Brave is lovely in a film. In a shop it’s expensive.',
            `So, properly. ${cap(RATE)}, last day of the month, and we never have this talk again.`,
          ],
          choices: [
            { id: 'pay', label: `All right. ${cap(RATE)}.`, reply: 'Thank you. I mean it. I hate the other kind of conversation.', effects: pay(REP.properlyPaid, PR.properlyPaid) },
            {
              id: 'refuse',
              label: 'The answer’s still no.',
              reply: 'Then I’ve asked properly, and you’ve answered properly. Lock up carefully tonight.',
              effects: [...no(REP.properlyRefused, PR.properlyRefused), { do: 'vandalism', kind: 'brick' }],
            },
          ],
        },
      },
    },
    {
      id: 'protection.brick_news',
      when: [{ if: 'beat', beat: 'protection.properly', outcome: ['refuse'], daysAgo: { gte: 1 } }],
      chance: 1,
      visit: {
        who: 'eduard',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'Brick through a pawnshop window by the canal',
            'A pawnshop on the embankment had its counter case smashed in the night. Nobody was hurt. Police took a statement. The owner said the shop would open as usual. A neighbour said it was “kids, or not kids”.',
          ],
        },
      },
    },
    {
      id: 'protection.window',
      when: [{ if: 'beat', beat: 'protection.properly', outcome: ['refuse'], daysAgo: { gte: L.windowAfter } }, quiet],
      chance: 0.5,
      visit: {
        who: 'eduard',
        kind: 'scene',
        scene: {
          lines: [
            'I read about your glass. In the paper, imagine. Kids, or not kids. I liked that.',
            'Glass is the cheap part. Glass you can buy. What you can’t buy is a landlord who likes you.',
            'This is the last time I ask before somebody else does.',
          ],
          choices: [
            { id: 'pay', label: `Fine. ${cap(RATE)}.`, reply: 'There. And the glazier gets to keep his Sundays. Last day of the month.', effects: pay(REP.windowPaid, PR.windowPaid) },
            { id: 'refuse', label: 'I’ll buy more glass.', reply: 'Buy a lot of it.', effects: no(REP.windowRefused, PR.windowRefused) },
          ],
        },
      },
    },
    {
      id: 'protection.ultimatum',
      when: [
        { if: 'beat', beat: 'protection.window', outcome: ['refuse'], daysAgo: { gte: L.ultimatumAfter } },
        { if: 'pressure', gte: L.ultimatumAt },
        quiet,
      ],
      chance: 0.5,
      visit: {
        who: 'eduard',
        kind: 'scene',
        scene: {
          lines: [
            'Semyon Markovich sends his regards. Your landlord. A careful man; he worries about his building. Fires, bricks, the wrong tenants.',
            'He asked me whether you’re the wrong tenant. I said I’d find out.',
            `Three months you didn’t pay, ${P.backPay.toLocaleString('en-US')} roubles, and ${RATE} from now on. Or I tell Semyon Markovich what I think.`,
          ],
          choices: [
            {
              id: 'pay',
              label: 'All right. I’ll pay.',
              reply: 'Good. Zhora will count it. Semyon Markovich will sleep tonight, and so will you.',
              effects: [...pay(REP.ultimatumPaid, PR.ultimatumPaid), { do: 'cash', amount: -P.backPay, text: 'Eduard Lvovich: three months of “insurance”' }],
            },
            {
              id: 'refuse',
              label: 'Tell him what you like.',
              reply: 'I will. Give it a week. Enjoy the week.',
              effects: [...no(REP.ultimatumRefused, PR.ultimatumRefused), { do: 'flag', flag: F.lastRefused }],
            },
          ],
        },
      },
    },
    // Listed before protection.out on purpose: on the morning it's settled, when the street
    // stands with you this beat is picked (one beat per arc a day) and ends the arc.
    {
      id: 'protection.street',
      when: [
        { if: 'beat', beat: 'protection.ultimatum', outcome: ['refuse'], daysAgo: { gte: L.settleAfter } },
        { if: 'rep', group: 'neighbourhood', gte: L.streetStands },
      ],
      chance: 1,
      visit: {
        who: 'eduard',
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'I came to finish our conversation. I parked, and your baker came out with a broom and just stood there. Then the woman from the salon. Then the old tram driver, with his coffee.',
            'Half the street on the pavement, looking at my car. Not a word out of any of them. People like you here. That I didn’t count on.',
            'Semyon Markovich has decided he likes you too. Keep your glass. We have other streets.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'flag', flag: F.heldOut },
              { do: 'axis', axis: 'clean', weight: 'protectionHeldOut' },
              { do: 'pressure', delta: PR.streetStood },
              { do: 'endArc' },
            ],
          },
        },
      },
    },
    {
      id: 'protection.out',
      when: [{ if: 'beat', beat: 'protection.ultimatum', outcome: ['refuse'], daysAgo: { gte: L.settleAfter } }],
      chance: 1,
      visit: {
        who: 'eduard',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'Pawnshop by the canal to close',
            'The landlord of a building on the embankment has ended the lease on its ground-floor pawnshop, citing “repeated damage and the safety of the residents”. The owner has until the end of the week. Neighbours said the shop was quiet and the owner polite. A man in a clean car outside declined to comment.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: F.pushedOut }, { do: 'endCareer', kind: 'pushedOut' }, { do: 'endArc' }] } },
      },
    },

    // --- M5: payers -----------------------------------------------------------------------
    {
      id: 'protection.box_answer',
      when: [
        { if: 'flag', flag: F.boxAsked },
        {
          if: 'any',
          of: [
            { if: 'beat', beat: 'protection.box', daysAgo: { gte: 5 } },
            { if: 'beat', beat: 'protection.box_late', daysAgo: { gte: 5 } },
          ],
        },
      ],
      chance: 0.5,
      visit: {
        who: 'zhora',
        kind: 'scene',
        scene: {
          lines: ['The box.', 'Thursday. Back room. One week. Yes or no.'],
          choices: [
            {
              id: 'keep',
              label: 'Yes. One week.',
              reply: 'Thursday. That’s for the room. Count it.',
              effects: [
                { do: 'flag', flag: F.boxKept },
                { do: 'flag', flag: 'dirty.protection_box' },
                { do: 'cash', amount: P.box.fee, text: 'Zhora: for the use of the back room' },
                { do: 'heat', delta: P.box.heat },
                { do: 'rep', group: 'mob', delta: REP.boxKept },
                { do: 'pressure', delta: PR.boxKept },
              ],
            },
            {
              id: 'refuse',
              label: 'Not in my back room.',
              reply: 'I’ll tell him. He won’t like it. The envelope still comes.',
              effects: [{ do: 'flag', flag: F.boxRefused }, ...no(REP.boxRefused, PR.boxRefused)],
            },
          ],
        },
      },
    },
    delivery(
      'protection.delivery_phones',
      [],
      { defId: 'phone_galaxia_nota3', condition: [80, 95], story: 'Boxed. From somebody’s lorry.' },
      ['Eduard Lvovich says you’re a good customer. Good customers get first look.', 'From a lorry. The lorry won’t miss it.'],
      'Half what you’d sell it for. Cash. Don’t write my name.',
    ),
    delivery(
      'protection.delivery_camera',
      [{ if: 'beat', beat: 'protection.delivery_phones', daysAgo: { gte: D.gap } }],
      { defId: 'camera_kanon_ae2', condition: [70, 88], story: 'With the strap. From a flat nobody lives in now.' },
      ['Camera. With the strap.', 'Don’t ask whose. He doesn’t need it.'],
      'Cheap. You know it’s cheap.',
    ),
    delivery(
      'protection.delivery_gold',
      [{ if: 'beat', beat: 'protection.delivery_camera', daysAgo: { gte: D.gap } }],
      { defId: 'gold_bracelet_585', condition: [65, 85], story: 'A bracelet. The clasp works.' },
      ['Gold. Somebody owed somebody.', 'Eduard Lvovich says half. Half is generous.'],
      'Weigh it. Then pay me half.',
    ),
  ],
} as const
