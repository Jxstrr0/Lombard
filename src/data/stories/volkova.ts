/**
 * Detective Volkova (GDD § 9 "Volkova"): Alla Sergeevna, Kanal district, eleven pawnshops
 * on this side of the water. Her systemic visits (questions, envelopes, the raid) are
 * src/game/crime/volkova.ts; she always drops in once, days 8–20, for a courtesy call
 * (tuning.police.volkova.introDays), which sets crime.volkova.met. This arc is her own
 * story, and it branches on how you've treated her at the counter (crime.volkova and the
 * police.* flags). Numbers: tuning.volkovaArc.
 *
 * Her life outside the job: her father Sergei Ilyich, thirty years in the militia, now
 * fishing under the no-fishing sign on the Seventh Bridge and wanting an outboard motor;
 * the bayan (button accordion) at evening classes, the youngest by thirty years; a cactus
 * on her desk called Prosecutor; an ex-husband who lied about small things and lives in Tver.
 *
 *   Everyone   volkova.father        Off duty, her father's Pobeda to sell for the motor.
 *              volkova.father_fair   …a fair price: she rings to say he's on the river (heart).
 *              volkova.father_low    …a lowball: she rings to say she knows.
 *   Honest     volkova.source        Never lied, never an envelope: will you ring her when
 *   (no lie,                         something makes your neck go cold?
 *   no envelope) volkova.stakeout    A man with a hot bracelet: stall him and ring her, or buy.
 *              volkova.patrol        You rang: a patrol car on your corner while the crew leans.
 *              volkova.recital       You rang: her bayan recital (heart).
 *   Bought     volkova.short         Envelopes went one way; now she's short for the motor.
 *   (an envelope) volkova.audit      Internal security asks whether she took anything.
 *              volkova.reprimand_news / volkova.reprimand   You told: docked pay, and a cold peace.
 *              volkova.liability     You kept quiet: now she needs a bag kept off the book (dirty).
 *   Lied to    volkova.personal      Off duty: her husband lied about small things. Come clean,
 *   (caught, or                      or don't (volkova.grudge).
 *   two lies)  volkova.tver          You came clean: Tver wants the bayan back. Friends.
 *              volkova.inspection    The grudge: an anonymous fire inspection (a fine).
 *              volkova.parked        The grudge: her car outside at lunch all week (walkouts).
 *   Anyone     volkova.icon          Stanislav's icon went through your books: she asks.
 *              volkova.inform        Playing the crew against the police: tell her about Eduard
 *                                    Lvovich (pressure jumps), then either the crew finds out
 *                                    (volkova.leak / volkova.leak_bought: a brick, more pressure;
 *                                    likelier if her precinct is the kind that takes envelopes)
 *                                    or she gets them (volkova.crackdown: pressure falls).
 *
 * Branch entries (source, short, personal) shut each other out, so a career gets one second
 * half. Nothing here ends the arc: the inform and icon beats can still come after a branch is
 * done. heart.* and dirty.* flags count on the ending axes; helpedPolice and informed are
 * clean-axis weights (tuning.axes). Violence stays off-screen.
 *
 * Flags set: volkova.father_sold, volkova.lowballed, volkova.source, volkova.rang,
 * volkova.reported, volkova.cold, volkova.grudge, volkova.friend, volkova.parked,
 * volkova.informed, volkova.leaked, volkova.crackdown, volkova.icon_truth.
 */
import { VOLKOVA } from '../police'
import { tuning } from '../tuning'

const A = tuning.volkovaArc
const T = A.trust
const H = A.heat
const R = A.rep
const C = A.cash
const N = A.inform

const met = { if: 'volkova', met: true } as const
const started = { if: 'day', gte: A.startDay } as const

/** The three second halves start from these beats, and only one of them ever plays. */
const ENTRIES = ['volkova.source', 'volkova.short', 'volkova.personal'] as const
const noOtherBranch = (self: (typeof ENTRIES)[number]) => ENTRIES.filter((b) => b !== self).map((beat) => ({ if: 'beat', beat, not: true }) as const)

/** After a beat (any outcome or the given choices), `days` or more ago. */
const after = (beat: string, days: number, outcome?: readonly string[]) => ({ if: 'beat', beat, daysAgo: { gte: days }, ...(outcome ? { outcome: [...outcome] } : {}) }) as const

/** The crew hasn't gone elsewhere or pushed you out yet. */
const crewAround = [
  { if: 'flag', flag: 'protection.running' },
  { if: 'flag', flag: 'protection.held_out', not: true },
  { if: 'flag', flag: 'protection.pushed_out', not: true },
] as const

/** The crew finds out who talked: a brick tonight, and they lean harder. */
const leaked = [
  { do: 'flag', flag: 'volkova.leaked' },
  { do: 'vandalism', kind: 'brick' },
  { do: 'pressure', delta: N.leakPressure },
  { do: 'rep', group: 'mob', delta: N.leakRep },
] as const
const leakSettles = [after('volkova.inform', N.after, ['inform']), { if: 'beat', beat: 'volkova.crackdown', not: true }] as const

export default {
  id: 'volkova',
  title: 'Detective Volkova',
  beats: [
    // --- Playing the crew against the police (any branch) ----------------------------------
    // Listed first so the day it settles goes to the leak roll, then to her crackdown.
    {
      id: 'volkova.leak_bought',
      when: [...leakSettles, { if: 'beat', beat: 'volkova.leak', not: true }, { if: 'volkova', bribes: { gte: 1 } }],
      chance: N.leakBought,
      visit: {
        who: 'eduard',
        kind: 'scene',
        scene: {
          lines: [
            'Funny thing. The people who take your envelopes at the Kanal precinct take mine too. Small world. Small, leaky world.',
            'One of them tells me a shop on the embankment has been talking to Alla Sergeevna about me. I said, surely not. Not after everything we’ve been to each other.',
            'I’m not angry. Angry is for films. I’m disappointed, and disappointment is cheaper to say. Tonight, mind your glass.',
          ],
        },
        after: { talked: { effects: leaked } },
      },
    },
    {
      id: 'volkova.leak',
      when: [...leakSettles, { if: 'beat', beat: 'volkova.leak_bought', not: true }, { if: 'volkova', bribes: { lte: 0 } }],
      chance: N.leak,
      visit: {
        who: 'eduard',
        kind: 'scene',
        scene: {
          lines: [
            'I had lunch with a man from a nice office on Sadovaya. Lovely soup. He tells me a shop on the embankment talks to Detective Volkova about me.',
            'Police stations are like pawnshops, you know. Everything that comes in goes out again, for a price.',
            'I’m not angry. Angry is for films. I’m disappointed, and disappointment is cheaper to say. Tonight, mind your glass.',
          ],
        },
        after: { talked: { effects: leaked } },
      },
    },
    {
      id: 'volkova.crackdown',
      when: [after('volkova.inform', N.after, ['inform']), { if: 'beat', beat: 'volkova.leak', not: true }, { if: 'beat', beat: 'volkova.leak_bought', not: true }],
      chance: 1,
      visit: {
        who: 'volkova',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'Police stop cars on the embankment; two men held',
            'Kanal district police stopped and searched several cars on the embankment yesterday afternoon. Two men were held for questioning about “insurance” sold to local businesses and released on Sunday. A detective at the scene declined to comment beyond saying she “liked a clean car as much as anybody”. A baker on the corner gave the officers rolls.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'flag', flag: 'volkova.crackdown' },
              { do: 'pressure', delta: N.crackdownPressure },
            ],
          },
        },
      },
    },
    {
      id: 'volkova.inform',
      when: [met, started, ...crewAround, { if: 'volkova', trust: { gte: 0 } }],
      chance: 0.35,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'There’s a man called Eduard Lvovich who drives a very clean car up and down your embankment. I know what he is. Everybody knows what he is. Knowing isn’t evidence.',
            'Who comes in, when, what they say, what they take away in an envelope. Tell me, and I’ll do the rest.',
            'I won’t put your name anywhere. That’s a promise, and I know what promises are worth in my building, so I’ll make it twice. I won’t.',
          ],
          choices: [
            {
              id: 'inform',
              label: 'Write this down',
              reply: 'Slower. Zhora with a Zh? And the envelope, last day of the month. Good. Now go on as if I was never here. That’s the hard part.',
              effects: [
                { do: 'flag', flag: 'volkova.informed' },
                { do: 'axis', axis: 'clean', weight: 'informed' },
                { do: 'pressure', delta: N.pressure },
                { do: 'volkova', trust: T.informed },
                { do: 'heat', delta: H.informed },
                { do: 'rep', group: 'police', delta: R.informed },
              ],
            },
            {
              id: 'stay_out',
              label: 'I don’t know the man',
              reply: 'No. Nobody does. He’s the best-known stranger in the district.',
              effects: [{ do: 'volkova', trust: T.informNo }],
            },
          ],
        },
      },
    },

    // --- Stanislav's icon (his beat 4; any branch) -----------------------------------------
    {
      id: 'volkova.icon',
      when: [met, after('stanislav.icon', A.gap, ['book'])],
      chance: 0.5,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'An icon. Saint Nicholas, northern school, very sad eyes. It left the country last week with a beautiful history: an unredeemed pledge, from your shop, last April.',
            'I read your book for last April. It’s a lovely book. That page is in a different pen.',
            'Who brought it in? Think before you answer. I already have.',
          ],
          choices: [
            {
              id: 'truth',
              label: 'Stanislav Lyubimov',
              reply: 'Thank you. He’s already taking the waters somewhere warm, I expect. They always do. But now I know where to send the postcard.',
              effects: [
                { do: 'flag', flag: 'volkova.icon_truth' },
                { do: 'axis', axis: 'clean', weight: 'helpedPolice' },
                { do: 'specialist', id: 'antiquary', change: 'stanislav.vanishes' },
                { do: 'volkova', trust: T.iconTruth },
                { do: 'heat', delta: H.iconTruth },
                { do: 'rep', group: 'police', delta: R.iconTruth },
              ],
            },
            {
              id: 'cover',
              label: 'A widow pawned it',
              reply: 'A widow. With a cough, I expect. They always have a cough. Your book can keep her; I’ll keep the page.',
              effects: [
                { do: 'flag', flag: 'dirty.volkova_icon_cover' },
                { do: 'volkova', trust: T.iconCover },
                { do: 'heat', delta: H.iconCover },
              ],
            },
          ],
        },
      },
    },

    // --- Everyone: her father's watch ------------------------------------------------------
    {
      id: 'volkova.father',
      when: [met, started],
      chance: 0.3,
      visit: {
        who: 'volkova',
        // Off duty: herself, not the detective (her look; she wants the motor for him, and haggles like a daughter).
        as: { name: 'Alla Volkova', archetype: 'detective', look: VOLKOVA.look, temperament: 'flexible', knowledge: 0.5, desperation: 0.5 },
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: [
            'I’m not here. I mean, I’m not here as police. It’s my day off; this is my other jacket.',
            'My father’s watch. Sergei Ilyich, thirty years in the militia, and now he wants an outboard motor so he can fish off the Seventh Bridge, under the sign that says no fishing.',
            'He’d have brought it himself, but he’d tell you the whole history of the watch and you’d pay whatever he asked out of exhaustion.',
          ],
        },
        item: { defId: 'watch_pobeda_gold', authenticity: 'genuine', provenance: 'heirloom', condition: [60, 82], story: 'Papa’s Pobeda. He wound it every morning for forty years. The motor will have it out of him in a month.' },
        line: 'A fair price, please. I’ll know, by the way. Not because I’m police. Because I’m his daughter and he’ll ask.',
        after: {
          bought: {
            line: 'Thank you. He’ll grumble it was worth more. He grumbles about the weather too, and he’s usually wrong about that.',
            effects: [{ do: 'flag', flag: 'volkova.father_sold' }],
          },
          passed: { line: 'Fine. He’ll take it across the bridge and tell them about it for an hour. Serves them right.' },
        },
      },
    },
    {
      id: 'volkova.father_fair',
      when: [{ if: 'beat', beat: 'volkova.father', outcome: ['bought'], ratio: { gte: A.father.fair }, daysAgo: { gte: 2 } }],
      chance: 0.6,
      visit: {
        who: 'volkova',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'It’s Volkova. No, nothing’s wrong. Papa bought his motor. He was on the river at five this morning, under the sign. I’ve asked the river patrol to look the other way, which I suppose is corruption.',
            'He made me ring you. He says you gave an old man a fair price for his watch, and that’s rarer than an honest policeman. He’d know; he was one.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'flag', flag: 'heart.volkova_father' },
              { do: 'volkova', trust: T.fatherFair },
            ],
          },
        },
      },
    },
    {
      id: 'volkova.father_low',
      when: [{ if: 'beat', beat: 'volkova.father', outcome: ['bought'], ratio: { lte: A.father.low }, daysAgo: { gte: 2 } }],
      chance: 0.6,
      visit: {
        who: 'volkova',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'It’s Volkova. Papa took the watch’s photograph to a man on Nevsky Lane to be valued. For fun! He doesn’t know what you paid. I do.',
            'It isn’t a crime. I checked, in case. I just wanted you to know that I know. Have a good day.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'flag', flag: 'volkova.lowballed' },
              { do: 'volkova', trust: T.fatherLow },
            ],
          },
        },
      },
    },

    // --- Honest: never lied to her, never an envelope ---------------------------------------
    {
      id: 'volkova.source',
      when: [met, started, { if: 'volkova', trust: { gte: A.honestTrust }, lies: { lte: 0 }, caught: { lte: 0 }, bribes: { lte: 0 } }, ...noOtherBranch('volkova.source')],
      chance: 0.3,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'I’ll be straight with you, since you’ve been straight with me. In this job that’s a novelty, and I like to encourage novelties.',
            'Things come through your door before they get to me. A set of medals off a dead man’s jacket. A ring with somebody else’s name inside it.',
            'If one of them makes the back of your neck go cold, ring me. Before you pay for it, ideally.',
          ],
          choices: [
            {
              id: 'source_yes',
              label: 'I’ll ring you',
              reply: 'Good. My desk number. If a man answers, that’s Prosecutor. He’s a cactus; he won’t take a message.',
              effects: [
                { do: 'flag', flag: 'volkova.source' },
                { do: 'volkova', trust: T.sourceYes },
              ],
            },
            {
              id: 'source_no',
              label: 'I’m not an informer',
              reply: 'Good answer. Neither am I; I’m a detective. The offer stays open, like your kettle.',
              effects: [{ do: 'volkova', trust: T.sourceNo }],
            },
          ],
        },
      },
    },
    {
      id: 'volkova.stakeout',
      when: [after('volkova.source', A.gap, ['source_yes'])],
      chance: 0.4,
      visit: {
        who: 'volkova',
        as: { name: 'Tolik', archetype: 'hustler', look: 'male_adult_10', temperament: 'flexible', knowledge: 0.4, desperation: 0.8 },
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: [
            'Bracelet. Gold. Heavy. My aunt’s. She’s, er, travelling.',
            'Cash, today, no paperwork, no passport, because I left it in my other trousers. In my aunt’s flat. Where she isn’t.',
          ],
          choices: [
            {
              id: 'ring',
              label: 'Wait here a minute',
              reply: 'Sure, I’ll wait. Nice shop. Is that a siren? Oh. Alla Sergeevna. How’s your father? No, my aunt’s fine, she’s travelling…',
              end: true,
              effects: [
                { do: 'flag', flag: 'volkova.rang' },
                { do: 'axis', axis: 'clean', weight: 'helpedPolice' },
                { do: 'volkova', trust: T.stakeoutRang },
                { do: 'heat', delta: H.stakeoutRang },
                { do: 'rep', group: 'police', delta: R.stakeoutRang },
              ],
            },
            { id: 'look', label: 'Let’s have a look', reply: 'That’s the spirit. Heavy, see? Feel it. That’s gold, that is. Aunt’s gold.' },
          ],
        },
        item: { defId: 'gold_bracelet_585', authenticity: 'genuine', provenance: 'stolen', condition: [72, 90], story: 'My aunt’s. She’s travelling.' },
        line: 'Whatever you think. Quickly, though. I’ve got a bus.',
        after: {
          bought: {
            line: 'Lovely. Pleasure. If anybody asks, I was never here, and neither was my aunt.',
            effects: [
              { do: 'flag', flag: 'dirty.volkova_stakeout' },
              { do: 'volkova', trust: T.stakeoutBought },
              { do: 'heat', delta: H.stakeoutBought },
            ],
          },
        },
      },
    },
    {
      id: 'volkova.patrol',
      when: [after('volkova.stakeout', A.gap, ['ring']), ...crewAround],
      chance: 0.5,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'Tolik’s aunt is in Kolpino, by the way, with her bracelet back on and very cross with Tolik. You did me a favour. Here’s a small one back.',
            'There’s a patrol car that needs somewhere to eat its lunch for a fortnight. Your corner has a lovely view of the canal, and of anyone with a clean car.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'pressure', delta: N.patrolPressure },
              { do: 'volkova', trust: T.patrol },
            ],
          },
        },
      },
    },
    {
      id: 'volkova.recital',
      when: [after('volkova.stakeout', A.gap + 3, ['ring'])],
      chance: 0.4,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'A confession. Nothing criminal. I’m learning the bayan. Evening classes at the House of Culture; I’m the youngest by thirty years and the worst by further.',
            'There’s a recital on Saturday. Papa’s coming, my teacher’s coming, and Prosecutor is staying at home on my desk, the coward.',
            'You could come. Sit at the back. Leave at the interval if you have any taste.',
          ],
          choices: [
            {
              id: 'go',
              label: 'I’ll be there',
              reply: 'Really? Good. Don’t clap between pieces. Don’t clap during them either; it puts me off.',
              effects: [
                { do: 'flag', flag: 'heart.volkova_recital' },
                { do: 'volkova', trust: T.recital },
              ],
            },
            { id: 'no', label: 'I can’t, sorry', reply: 'Probably wise. I’ll tell you how it went. Badly, is my guess, and loudly.' },
          ],
        },
      },
    },

    // --- Bought: an envelope changed hands --------------------------------------------------
    {
      id: 'volkova.short',
      when: [met, started, { if: 'volkova', bribes: { gte: 1 } }, { if: 'cash', gte: -C.shortLoan }, ...noOtherBranch('volkova.short')],
      chance: 0.35,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'Envelopes. Let’s not pretend there haven’t been envelopes. Today I want to talk about money the other way round.',
            `My father wants an outboard motor. ${(-C.shortLoan).toLocaleString('en-US')} roubles. My salary is my salary, and Papa doesn’t know where his daughter’s extra comes from, and he mustn’t.`,
            'A loan. Between friends. I’ll pay it back. Listen to me: I almost believe it.',
          ],
          choices: [
            {
              id: 'lend',
              label: 'Here. Don’t mention it.',
              reply: 'I won’t. I won’t mention a lot of things. That’s what we are now, isn’t it.',
              effects: [
                { do: 'cash', amount: C.shortLoan, text: 'Volkova: a loan, for a boat motor' },
                { do: 'flag', flag: 'dirty.volkova_loan' },
                { do: 'volkova', trust: T.shortLent },
                { do: 'heat', delta: H.shortLent },
              ],
            },
            {
              id: 'refuse',
              label: 'I’m not a bank',
              reply: 'No. You’re a pawnshop. I’ll remember the difference.',
              effects: [
                { do: 'volkova', trust: T.shortRefused },
                { do: 'heat', delta: H.shortRefused },
              ],
            },
          ],
        },
      },
    },
    {
      id: 'volkova.audit',
      when: [after('volkova.short', A.gap)],
      chance: 0.4,
      visit: {
        who: 'volkova',
        as: { name: 'Major Kuznetsov', archetype: 'office', look: 'male_adult_08', temperament: 'stubborn', knowledge: 0.9, desperation: 0 },
        kind: 'scene',
        scene: {
          lines: [
            'Major Kuznetsov, internal security. Don’t get up; it isn’t you I’m interested in. Probably.',
            'Detective Volkova, Kanal district. Her father has a new outboard motor, and her salary hasn’t changed in four years. I’m going to all eleven shops on her list.',
            'Has she ever taken anything from this one?',
          ],
          choices: [
            {
              id: 'quiet',
              label: 'Never. She’s a good officer.',
              reply: 'Of course. They all are. That’s what all eleven of you say; it’s very moving.',
              effects: [
                { do: 'flag', flag: 'dirty.volkova_audit' },
                { do: 'heat', delta: H.auditQuiet },
              ],
            },
            {
              id: 'tell',
              label: 'Envelopes. More than once.',
              reply: 'Thank you. You’ll keep this to yourself, naturally. She’ll know anyway. They always know.',
              effects: [
                { do: 'flag', flag: 'volkova.reported' },
                { do: 'axis', axis: 'clean', weight: 'helpedPolice' },
                { do: 'volkova', trust: T.auditTold },
                { do: 'heat', delta: H.auditTold },
                { do: 'rep', group: 'police', delta: R.auditTold },
              ],
            },
          ],
        },
      },
    },
    {
      id: 'volkova.reprimand_news',
      when: [after('volkova.audit', 1, ['tell'])],
      chance: 1,
      visit: {
        who: 'volkova',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'Kanal district detective disciplined',
            'A detective of the Kanal district police has been reprimanded and docked three months’ pay after an internal inquiry into gifts from local businesses. She remains in post. Her father, reached on the Seventh Bridge, said he had never heard such nonsense, and that the fish weren’t biting either.',
          ],
        },
      },
    },
    {
      id: 'volkova.reprimand',
      when: [after('volkova.audit', A.gap, ['tell'])],
      chance: 0.5,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'Three months’ pay. Papa sold the motor back. He says it was too loud anyway, which is a lie, and now I know where I get it from.',
            'You did right. I’d have done the same, probably. I’d still rather you hadn’t.',
            'From now on it’s the book, and the law, and me. No kettle.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'volkova.cold' }] } },
      },
    },
    {
      id: 'volkova.liability',
      when: [after('volkova.audit', A.gap, ['quiet'])],
      chance: 0.5,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'Kuznetsov came to see you. He went to all eleven. You all kept your mouths shut, which I find touching and a little frightening.',
            'So now we’re the kind of friends who can sink each other. That’s the best kind, in my experience. The most reliable.',
            'A favour. There’s a bag from our evidence room that needs to be somewhere else for a month. Your back room. Off the book.',
          ],
          choices: [
            {
              id: 'keep',
              label: 'Bring the bag',
              reply: 'Tuesday. Don’t open it. I mean that as a kindness, not a threat. Mostly.',
              effects: [
                { do: 'flag', flag: 'dirty.volkova_evidence' },
                { do: 'cash', amount: C.liabilityFee, text: 'Volkova: for the back room' },
                { do: 'volkova', trust: T.liabilityKept },
                { do: 'heat', delta: H.liabilityKept },
              ],
            },
            {
              id: 'refuse',
              label: 'No more favours',
              reply: 'Hm. Then we’ll find out how clean your book is, won’t we. I’ll start with April.',
              effects: [
                { do: 'volkova', trust: T.liabilityRefused },
                { do: 'heat', delta: H.liabilityRefused },
              ],
            },
          ],
        },
      },
    },

    // --- Lied to: caught once, or two lies -------------------------------------------------
    {
      id: 'volkova.personal',
      when: [
        met,
        started,
        { if: 'volkova', bribes: { lte: 0 } },
        { if: 'any', of: [{ if: 'volkova', caught: { gte: 1 } }, { if: 'volkova', lies: { gte: A.lies } }] },
        ...noOtherBranch('volkova.personal'),
      ],
      chance: 0.35,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'Day off. I was at the market and my feet brought me here, which says something bad about my feet.',
            'I was married. He lied about small things: where he’d been, what things cost, whose scarf. Not one big lie; a thousand small ones. Now he lives in Tver, and I can’t abide a small lie.',
            'You’ve told me a few. Is there anything you’d like to say? I’m not working. Nothing today goes in a notebook.',
          ],
          choices: [
            {
              id: 'clean',
              label: 'I lied to you. I’m sorry.',
              reply: 'There. Was that so terrible? Don’t do it again and we’ll say no more about it. Well, I’ll say a little more. I’m Russian.',
              effects: [
                { do: 'flag', flag: 'heart.volkova_truth' },
                { do: 'volkova', trust: T.comeClean },
                { do: 'heat', delta: H.comeClean },
              ],
            },
            {
              id: 'nothing',
              label: 'I’ve nothing to say',
              reply: 'No. Of course not. Enjoy your day.',
              effects: [
                { do: 'flag', flag: 'volkova.grudge' },
                { do: 'volkova', trust: T.grudge },
                { do: 'heat', delta: H.grudge },
                { do: 'rep', group: 'police', delta: R.grudge },
              ],
            },
          ],
        },
      },
    },
    {
      id: 'volkova.tver',
      when: [after('volkova.personal', A.gap, ['clean'])],
      chance: 0.4,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'Tver rang. He wants the bayan back. My bayan! Bought with my money, for my lessons, in my flat. He says it was a present to both of us.',
            'I told him to come and fetch it. He won’t. He’s frightened of Papa, which is the one sensible thing about him.',
            'Anyway. Thank you, for the other day. It’s been a long time since anyone told me the truth to my face and then didn’t look at the floor.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'volkova.friend' }] } },
      },
    },
    {
      id: 'volkova.inspection',
      when: [{ if: 'flag', flag: 'volkova.grudge' }, after('volkova.personal', A.gap, ['nothing'])],
      chance: 0.4,
      visit: {
        who: 'volkova',
        as: { name: 'Inspector Gromova', archetype: 'office', look: 'female_adult_05', temperament: 'stubborn', knowledge: 0.7, desperation: 0 },
        kind: 'scene',
        scene: {
          lines: [
            'Fire inspection. Somebody rang in a concern. Anonymous. Very public-spirited of them.',
            `An extension cable under the counter, a bucket in front of the fire exit, and an extinguisher from the year of the Moscow Olympics. ${(-C.fireFine).toLocaleString('en-US')} roubles.`,
            'Sign here. And here. I don’t know who rang. I never know who rings.',
          ],
        },
        after: { talked: { effects: [{ do: 'cash', amount: C.fireFine, text: 'Fire inspection: a fine' }] } },
      },
    },
    {
      id: 'volkova.parked',
      when: [{ if: 'flag', flag: 'volkova.grudge' }, after('volkova.inspection', A.gap)],
      chance: 0.4,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'I’m not here. I’m outside, in my car, having my lunch. For an hour. Every day this week, I expect.',
            'People get nervous when there’s a police car outside a pawnshop. I can’t think why. Enjoy your afternoon.',
          ],
        },
        after: {
          talked: {
            effects: [{ do: 'flag', flag: 'volkova.parked' }, { do: 'walkout' }, { do: 'walkout' }],
          },
        },
      },
    },
  ],
} as const
