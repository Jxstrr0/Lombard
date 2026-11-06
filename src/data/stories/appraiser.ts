/**
 * The Appraiser (M6, GDD § 9 "competent, hiding something"). Lev Andreyevich Sablin
 * (src/data/appraiser.ts), hired at the second counter (src/game/staff/appraiser.ts), is better
 * at this than you are. He is also Yuri Gusev's younger brother: he has been paying Yura's debt
 * to Zhora out of his wages, and he knows the money Yura skimmed from the crew's deliveries is
 * still under the storeroom floor. Numbers in tuning.appraiser.arc.
 *
 *   His first day  appraiser.start          He knows the shop too well. Welcome him, or ask.
 *   8+ days on     appraiser.zhora          Zhora sees him at the second counter: "Ask him where
 *                                           his brother is." Ask Lev yourself, or ask Zhora.
 *   Warm (trust)   appraiser.confide        He tells you. Keep him on (heart), or let him go.
 *     kept on      appraiser.tin            The biscuit tin under the floor: to Zhora (the debt
 *                                           paid), to Volkova (clean; the crew is not pleased), or
 *                                           half each (dirty).
 *       to Zhora   appraiser.yuri           Yura comes home to thank you. Lev's eye sharpens.
 *       to police  appraiser.paper          The morning paper.
 *       half each  appraiser.zhora_back     Zhora counted. Pay your half back, or "what floor?"
 *                                           (a brick, like the ladder's).
 *   Cold           appraiser.vanish         A voicemail. He is gone, and so is the tin.
 *                  appraiser.zhora_vanished The crew think you have it. Pay something, or nothing.
 *
 * His trust in you (state.customers.appraiser) moves with how you treat him: the hire, these
 * choices, and his wage at each month end (short pay costs more than full pay earns). Letting
 * him go from the office ends his part (his beats wait on appraiser.on_staff). Violence stays
 * off-screen: a brick, the paper, what people say.
 */
import { APPRAISER_FLAGS } from '../appraiser'
import { tuning } from '../tuning'

const A = tuning.appraiser.arc
const T = A.trust
const half = Math.round(A.tin / 2)

/** Story flags this arc sets (his epilogue card reads them). */
export const APPRAISER_ARC_FLAGS = {
  /** Zhora told you who he is before he did. */
  knows: 'appraiser.knows',
  /** He told you himself and you kept him on. */
  kept: 'heart.appraiser_kept',
  /** He told you and you let him go. */
  toldGo: 'appraiser.told_go',
  /** The tin went to the crew: Yura's debt is paid. */
  debtPaid: 'appraiser.debt_paid',
  /** The tin went to Volkova. */
  tinPolice: 'appraiser.tin_police',
  /** Half each. */
  tinSplit: 'dirty.appraiser_tin',
  /** Yura came home. */
  yuriHome: 'appraiser.yuri_home',
  /** After the split: you paid your half back to Zhora. */
  paidBack: 'appraiser.paid_back',
  /** After the split: "what floor?" */
  denied: 'appraiser.denied',
  /** He went in the night. */
  vanished: 'appraiser.vanished',
  /** ...and you paid Zhora something for it. */
  vanishPaid: 'appraiser.vanish_paid',
} as const

const F = APPRAISER_ARC_FLAGS
const onStaff = { if: 'flag', flag: APPRAISER_FLAGS.onStaff } as const

export default {
  id: 'appraiser',
  title: 'The Appraiser',
  beats: [
    {
      id: 'appraiser.start',
      when: [onStaff],
      visit: {
        who: 'appraiser',
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'Good morning. I’ve put the kettle on. The tube in the back wants two taps before it lights; I hope you don’t mind, I tapped it.',
            'Third drawer sticks. You lift it, then pull. And the bell over the door is a semitone flat, which is how you know it’s the door and not the tram.',
            'I worked in a shop like this once. They’re all the same shop, really.',
          ],
          choices: [
            { id: 'welcome', label: 'Welcome aboard, Lev.', reply: 'Thank you. I’ll take the ones you haven’t time for. I’ll try not to make you sorry.', effects: [{ do: 'trust', who: 'appraiser', delta: T.welcome }] },
            { id: 'ask', label: 'How do you know the drawer sticks?', reply: 'All third drawers stick. It’s the Soviet cabinet standard. I’ll be at the second counter.', effects: [{ do: 'trust', who: 'appraiser', delta: T.ask }] },
          ],
        },
      },
    },
    {
      id: 'appraiser.zhora',
      when: [onStaff, { if: 'beat', beat: 'appraiser.start', daysAgo: { gte: A.zhoraAfter } }, { if: 'beat', beat: 'protection.asking' }],
      chance: A.zhoraChance,
      visit: {
        who: 'zhora',
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'New man. Suit. Loupe.',
            'Lev. Little Lev. He thinks I don’t know his face because he combs his hair back now. I knew his face when it had jam on it.',
            'Ask him where his brother is. Ask him nice. Then tell me.',
          ],
          choices: [
            { id: 'ask_lev', label: 'I’ll ask him. Not for you.', reply: 'Not for me. Fine. For whoever. Eduard Lvovich is patient. I’m not, but he is.', effects: [{ do: 'trust', who: 'appraiser', delta: T.askLev }] },
            {
              id: 'ask_zhora',
              label: 'Whose brother?',
              reply: 'Gusev’s. Yura’s little brother. Sablin, he calls himself now: his mother’s name. He’s behind you. He heard all that.',
              effects: [{ do: 'trust', who: 'appraiser', delta: T.askZhora }, { do: 'flag', flag: F.knows }],
            },
          ],
        },
      },
    },
    {
      id: 'appraiser.confide',
      when: [onStaff, { if: 'beat', beat: 'appraiser.zhora', daysAgo: { gte: A.confideAfter } }, { if: 'trust', who: 'appraiser', gte: A.confideTrust }],
      chance: A.confideChance,
      visit: {
        who: 'appraiser',
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'Before you open. Sablin was my mother’s name. I’m Lev Gusev. Yura is my brother. He had this counter for eleven years, and he left owing the people Zhora works for.',
            'I’ve been paying them out of my wages. A little every week, to keep them off him wherever he is. I took this job because I knew the shop. That part was true.',
            'One more thing, and then you can decide. Yura used to take a little off the top of what the crew sent through here. Venya kept his Tuesdays, Yura kept the change. It’s under the storeroom floor, in a biscuit tin. I never touched it.',
          ],
          choices: [
            { id: 'keep_on', label: 'You’re staying. We’ll sort it.', reply: 'Then tomorrow I’ll show you the board. You lift it, then pull. Like the drawer.', effects: [{ do: 'flag', flag: F.kept }] },
            {
              id: 'let_go',
              label: 'I can’t have this here. Go.',
              reply: 'That’s fair. More than fair. The key’s on the counter. Lift the third board from the wall, if you want it. I never will.',
              effects: [{ do: 'staff', change: 'leave' }, { do: 'flag', flag: F.toldGo }, { do: 'endArc' }],
            },
          ],
        },
      },
    },
    {
      id: 'appraiser.tin',
      when: [onStaff, { if: 'beat', beat: 'appraiser.confide', outcome: ['keep_on'], daysAgo: { gte: 1 } }],
      visit: {
        who: 'appraiser',
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'Third board from the wall. Lift, then pull.',
            'A round biscuit tin from the Mostograd Confectionery Works, a bear on the lid. A hundred and eighty thousand roubles in old notes and rubber bands. Yura always did like bears.',
            'It isn’t mine and it isn’t yours. It’s theirs, or it’s evidence, or it’s ours. You decide. I’ve decided enough for one family.',
          ],
          choices: [
            {
              id: 'tin_crew',
              label: 'To Zhora. Yura’s debt is paid.',
              reply: 'Then it’s over. For him, I mean. I’ll walk it round myself. I’d like to see Zhora count it.',
              effects: [{ do: 'pressure', delta: A.crewPressure }, { do: 'rep', group: 'mob', delta: A.crewRep }, { do: 'flag', flag: F.debtPaid }],
            },
            {
              id: 'tin_police',
              label: 'To Volkova. It’s evidence.',
              reply: 'She’ll want to know where it came from. I’ll tell her. It’s about time somebody in my family did.',
              effects: [
                { do: 'heat', delta: A.policeHeat },
                { do: 'pressure', delta: A.policePressure },
                { do: 'rep', group: 'police', delta: A.policeRep },
                { do: 'volkova', trust: A.policeTrust },
                { do: 'axis', axis: 'clean', weight: 'tinHandedIn' },
                { do: 'flag', flag: F.tinPolice },
              ],
            },
            {
              id: 'tin_split',
              label: 'Half each. Nobody knows.',
              reply: 'Somebody always knows. But all right. Half each.',
              effects: [{ do: 'cash', amount: half, text: 'Half a biscuit tin, from under the storeroom floor' }, { do: 'heat', delta: A.splitHeat }, { do: 'flag', flag: F.tinSplit }],
            },
          ],
        },
      },
    },
    {
      id: 'appraiser.yuri',
      when: [{ if: 'beat', beat: 'appraiser.tin', outcome: ['tin_crew'], daysAgo: { gte: A.afterTin } }],
      visit: {
        who: 'appraiser',
        kind: 'scene',
        first: true,
        as: { name: 'Yuri Gusev', archetype: 'pensioner', look: 'male_adult_05', temperament: 'flexible', knowledge: 0.9, desperation: 0.2 },
        scene: {
          lines: [
            'Yuri Gusev. I had this counter, before you. Eleven years. You’ve moved the scales; they were better by the window.',
            'Lev says you paid what I owed with what I hid. That’s either very clever or very funny. I’m home either way. My wife says thank you. She says it louder than I do.',
            'He’s wasted on the overflow, you know. He’s the best eye on the canal. Don’t tell him I said so.',
          ],
        },
        after: { talked: { effects: [{ do: 'staff', change: 'sharper' }, { do: 'flag', flag: F.yuriHome }, { do: 'endArc' }] } },
      },
    },
    {
      id: 'appraiser.paper',
      when: [{ if: 'beat', beat: 'appraiser.tin', outcome: ['tin_police'], daysAgo: { gte: A.afterTin } }],
      visit: {
        who: 'appraiser',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'Biscuit tin of cash handed in at Canal district station',
            'A pawn shop employee walked into the station on Sadovaya with 180,000 roubles in a biscuit tin and, according to a source, “a very long statement”. Detective L. Volkova would not comment except to say that the tin had a bear on it. Several shops on the embankment were closed early that evening.',
          ],
        },
        after: { talked: { effects: [{ do: 'endArc' }] } },
      },
    },
    {
      id: 'appraiser.zhora_back',
      when: [{ if: 'beat', beat: 'appraiser.tin', outcome: ['tin_split'], daysAgo: { gte: A.afterTin } }],
      visit: {
        who: 'zhora',
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'Yura used to give us change. Eleven years, a little every week. Eduard Lvovich counted. Eduard Lvovich always counts.',
            'Somebody found a tin. Little Lev is buying his mother a new fridge. Little Lev never had money for a fridge.',
            'Half of a hundred and eighty. That’s ninety. Or you tell me about a floor I never heard of.',
          ],
          choices: [
            {
              id: 'pay_back',
              label: 'Here. Ninety. We’re done.',
              reply: 'Done. Eduard Lvovich likes neat people. You are almost neat.',
              effects: [{ do: 'cash', amount: -half, text: 'Paid back to Zhora: half a biscuit tin' }, { do: 'pressure', delta: A.paidBackPressure }, { do: 'flag', flag: F.paidBack }, { do: 'endArc' }],
            },
            {
              id: 'what_floor',
              label: 'What floor?',
              reply: 'That’s what I said you’d say. Glass is expensive this year.',
              effects: [{ do: 'vandalism', kind: 'brick' }, { do: 'pressure', delta: A.deniedPressure }, { do: 'rep', group: 'mob', delta: A.deniedRep }, { do: 'flag', flag: F.denied }, { do: 'endArc' }],
            },
          ],
        },
      },
    },
    {
      id: 'appraiser.vanish',
      when: [
        onStaff,
        { if: 'beat', beat: 'appraiser.zhora', daysAgo: { gte: A.vanishAfter } },
        { if: 'beat', beat: 'appraiser.confide', not: true },
        { if: 'trust', who: 'appraiser', lte: A.vanishTrust },
      ],
      chance: A.vanishChance,
      visit: {
        who: 'appraiser',
        kind: 'scene',
        via: 'phone',
        // The first thing you hear when you open: he never came in.
        first: true,
        scene: {
          lines: [
            'A voicemail, left at four in the morning. Lev’s voice, quiet, a train somewhere behind it.',
            '“I’m sorry about the short notice. My key is under the mat. The third board from the wall in the storeroom: you’ll find it’s loose, and you’ll find there’s nothing under it. Not any more.”',
            '“If anyone asks, you never knew me. That’s true, really. Goodbye.”',
          ],
        },
        after: { talked: { effects: [{ do: 'staff', change: 'vanish' }, { do: 'pressure', delta: A.vanishPressure }, { do: 'flag', flag: F.vanished }] } },
      },
    },
    {
      id: 'appraiser.zhora_vanished',
      when: [{ if: 'beat', beat: 'appraiser.vanish', daysAgo: { gte: A.afterVanish } }],
      visit: {
        who: 'zhora',
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'Little Lev took a train. With a biscuit tin. From under your floor.',
            'Eduard Lvovich thinks the floor came with the shop. Like the debt. You see how he thinks.',
            'So. Something, or nothing.',
          ],
          choices: [
            {
              id: 'pay_some',
              label: 'Here’s forty. That’s all there is.',
              reply: 'Forty. He’ll say it’s a start. He says everything’s a start.',
              effects: [{ do: 'cash', amount: -A.vanishPay, text: 'Paid to Zhora: for a tin you never saw' }, { do: 'pressure', delta: A.paidBackPressure }, { do: 'flag', flag: F.vanishPaid }, { do: 'endArc' }],
            },
            {
              id: 'pay_none',
              label: 'I never saw a tin.',
              reply: 'Nobody sees anything on this canal. Funny. Glass breaks anyway.',
              effects: [{ do: 'vandalism', kind: 'brick' }, { do: 'pressure', delta: A.deniedPressure }, { do: 'rep', group: 'mob', delta: A.deniedRep }, { do: 'endArc' }],
            },
          ],
        },
      },
    },
  ],
} as const
