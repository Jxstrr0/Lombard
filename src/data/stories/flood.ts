/**
 * The Flood (M6, GDD § 9: "city event: canal floods, demand and supply shift, chance to be a
 * hero or a vulture"). The water itself is src/game/city/flood.ts (the seeded day, the paper,
 * the flood morning, the flooded-out sellers, demand); these are the people it washes in.
 * Kuzmich the caretaker owns the beats (src/data/flood.ts); the neighbours he sends are strangers.
 * Numbers: tuning.flood. `D` = days since the flood day (the `flood` condition's `day`).
 *
 * Arc `flood` (first in ARCS, so on its few days it gets a beat slot before the others):
 *   flood.sandbags      D −5 … −1  Kuzmich with a cart of sandbags: lay them (cash), lift the stock
 *                                  (a walkout's worth of time), or "it never floods here".
 *   flood.pump          D 0 … 2    Arkady from the basement at number eleven needs the old pump in
 *                                  your back room: lend it (hero), sell it fair, or name your price
 *                                  (vulture: fifteen times over).
 *   flood.family        D 0 … 3    Larisa from the Fourth Line sells her mother's earrings (genuine,
 *                                  an heirloom, desperate). Two days on, by what you paid:
 *     flood.family_fair             ≥ half: Kuzmich passes on her thanks (hero).
 *     flood.family_cheap            ≤ 30%: her son comes to say the Fourth Line knows (vulture).
 *   flood.storage       D 1 … 4    Nina Arkadyevna's accordion and albums in your back room for two
 *                                  weeks: free (hero), for a fee (vulture), or no room.
 *     flood.storage_thanks / flood.storage_collect   12+ days on she collects (jam, or a count).
 *   flood.credit        D 1 … 5    Misha the electrician needs six thousand on his word (hero).
 *     flood.repaid / flood.unpaid   14+ days on: he pays it back (most often), or a postcard from Tver.
 *   flood.salvage       D 1 … 6    The crew, if Protection is running: Zhora with a gold bracelet
 *                                  that "floated out" of the flooded jeweller's on Lodochnaya.
 *                                  Stolen and cheap; buying it is buying loot (vulture).
 *
 * Arc `flood_talk` (last in ARCS): what people say afterwards.
 *   flood_talk.complaint  D 3 … 12  You gouged on the pump: Volkova has a complaint. Refund the
 *                                   difference, or explain the free market (heat).
 *   flood_talk.praise     D 3 … 12  You were a hero and gouged nobody: Volkova rings, briefly human.
 *   flood_talk.<regular>_<hero|vulture|plain>  D 6 … 20  Rimma, Yevstafy Lukich, Zinaida Petrovna
 *                                   and Valentin Egorovich drop in (if you've met them) and say
 *                                   what the street says. Lines only.
 *   flood_talk.paper_hero / paper_vulture  D 7 … 25  The paper, if the street has a verdict.
 *
 * Hero and vulture choices set flood.hero_* and flood.vulture_* flags (counted by the `flood`
 * condition); heart.* flags count on the heart axis, the vulture choices take tuning.axes weights
 * off it. Choice ids are unique to this arc (the sim prefers by id): flood_sandbags / flood_lift /
 * flood_ignore, pump_lend / pump_sell / pump_gouge, store_free / store_charge / store_no,
 * credit_lend / credit_no, gouge_refund / gouge_shrug.
 */
import { FLOOD_PEOPLE } from '../flood'
import { tuning } from '../tuning'

const F = tuning.flood
const R = F.rep
const rub = (n: number) => `${n.toLocaleString('en-US')} ₽`
const WHO = 'kuzmich'

const D = (gte: number, lte: number) => ({ if: 'flood', day: { gte, lte } }) as const

/** The street's verdict on the shop, as the `flood` condition counts it. */
const HERO = { if: 'flood', hero: { gte: F.heroAt }, vulture: { lte: 0 } } as const
const VULTURE = { if: 'flood', vulture: { gte: F.vultureAt } } as const
const PLAIN = [
  { if: 'flood', vulture: { lte: F.vultureAt - 1 } },
  { if: 'any', of: [{ if: 'flood', hero: { lte: F.heroAt - 1 } }, { if: 'flood', vulture: { gte: 1 } }] },
] as const

const flood = {
  id: 'flood',
  title: 'The Flood',
  beats: [
    {
      id: 'flood.sandbags',
      when: [D(-5, -1)],
      chance: 1,
      visit: {
        who: WHO,
        kind: 'scene',
        first: true,
        scene: {
          lines: [
            'Morning. Kuzmich, from the yards. You’ve read the paper? Read it. The ice is stuck under the Kupetsky and the river has nowhere to go but up our street.',
            'In eighty-six it came to here. In ninety-nine, to here. The man who had this shop before you lost a whole shelf of tape recorders, and he didn’t even like tape recorders.',
            `I’ve got sandbags on the cart. Filled them myself, out of the children’s sandpit. ${rub(F.sandbagsCost)} for the doorway, laid properly. Or carry your stock up off the floor. Or trust in the Lord; He has a lot on this week.`,
          ],
          choices: [
            {
              id: 'flood_sandbags',
              label: 'Lay the sandbags',
              reply: 'Good. I’ll do the back step too, no charge. Tell nobody I said no charge.',
              effects: [
                { do: 'cash', amount: -F.sandbagsCost, text: 'Sandbags for the door, laid by Kuzmich' },
                { do: 'flag', flag: 'flood.sandbags' },
              ],
            },
            {
              id: 'flood_lift',
              label: 'We’ll lift the stock ourselves',
              reply: 'Top shelves, and nothing in boxes on the floor. Boxes float, and then they don’t. I’ll leave you to it; your queue is getting bored.',
              effects: [{ do: 'flag', flag: 'flood.lifted' }, { do: 'walkout' }],
            },
            {
              id: 'flood_ignore',
              label: 'It never floods here',
              reply: 'Said the tape-recorder man. I’ll leave a couple of bags by the bins, in case you change your mind. You won’t.',
              effects: [{ do: 'flag', flag: 'flood.unprepared' }],
            },
          ],
        },
      },
    },
    {
      id: 'flood.pump',
      when: [D(0, 2)],
      chance: 1,
      visit: {
        who: WHO,
        as: FLOOD_PEOPLE.arkady,
        kind: 'scene',
        scene: {
          lines: [
            'Sorry, sorry, I’m dripping on your floor. Arkady, the basement at number eleven. Kuzmich said to come here.',
            'The water’s at the top of my bed. I’m bailing with a saucepan, and the saucepan is losing.',
            'Kuzmich says the man before you left an electric pump in your back room. There isn’t a pump left on the ring road. Please. Anything.',
          ],
          choices: [
            {
              id: 'pump_lend',
              label: 'Take it. Bring it back',
              reply: 'You… Thank you. I’ll bring it back dry. Drier. Thank you.',
              effects: [
                { do: 'flag', flag: 'flood.hero_pump' },
                { do: 'flag', flag: 'heart.flood_pump' },
                { do: 'rep', group: 'neighbourhood', delta: R.hero },
              ],
            },
            {
              id: 'pump_sell',
              label: `Yours for ${rub(F.pump.fair)}`,
              reply: 'Fair. More than fair, this week. Here.',
              effects: [{ do: 'cash', amount: F.pump.fair, text: 'Sold the old pump from the back room to Arkady' }],
            },
            {
              id: 'pump_gouge',
              label: `${rub(F.pump.gouge)}. Cash.`,
              reply: 'Fifteen… That’s my rent. Fine. Fine! What choice have I got? I’ll remember this. Everybody on the street will.',
              effects: [
                { do: 'cash', amount: F.pump.gouge, text: 'Sold the old pump from the back room to Arkady, at a flood price' },
                { do: 'flag', flag: 'flood.vulture_pump' },
                { do: 'flag', flag: 'flood.gouged' },
                { do: 'axis', axis: 'heart', weight: 'floodGouged' },
                { do: 'rep', group: 'neighbourhood', delta: R.vulture },
              ],
            },
          ],
        },
      },
    },
    {
      id: 'flood.family',
      when: [D(0, 3)],
      chance: 1,
      visit: {
        who: WHO,
        as: FLOOD_PEOPLE.larisa,
        kind: 'seller',
        wants: 'sell',
        scene: {
          lines: [
            'Kuzmich sent me. Larisa. We’re in the basement on the Fourth Line. Were.',
            'The water came up through the floor. The children’s beds, the fridge, my husband’s tools. He’s on nights at the yard; he doesn’t know how bad it is yet.',
          ],
        },
        item: {
          defId: 'gold_earrings_583',
          authenticity: 'genuine',
          provenance: 'heirloom',
          condition: [72, 88],
          story: 'My mother’s earrings. She wore them at my wedding. I said I’d never sell them. I said a lot of things before Tuesday.',
        },
        line: 'Whatever you think is fair. I don’t know what fair is any more.',
        after: {
          bought: { line: 'Thank you. I’ll buy them back one day. People say that, don’t they.' },
          passed: { line: 'All right. Somebody will.' },
          walked: { line: 'Forget it. I’ll try across the river.' },
        },
      },
    },
    {
      id: 'flood.family_fair',
      when: [{ if: 'beat', beat: 'flood.family', outcome: ['bought'], ratio: { gte: 0.5 }, daysAgo: { gte: 2 } }],
      chance: 1,
      visit: {
        who: WHO,
        kind: 'scene',
        scene: {
          lines: [
            'Larisa from the Fourth Line asked me to tell you. They got a dehumidifier with your money, and the children slept in their own beds last night. She’d have come herself, but she’s scrubbing.',
            'She says you didn’t push her down when you could have. I said that doesn’t sound like a pawnbroker. She said that’s what she thought.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'flag', flag: 'flood.hero_family' },
              { do: 'flag', flag: 'heart.flood_family' },
              { do: 'rep', group: 'neighbourhood', delta: R.small },
            ],
          },
        },
      },
    },
    {
      id: 'flood.family_cheap',
      when: [{ if: 'beat', beat: 'flood.family', outcome: ['bought'], ratio: { lte: 0.3 }, daysAgo: { gte: 2 } }],
      chance: 1,
      visit: {
        who: WHO,
        as: FLOOD_PEOPLE.danya,
        kind: 'scene',
        scene: {
          lines: [
            'You bought my gran’s earrings off my mum. The day after the water.',
            'I looked in the jeweller’s window on Kanatnaya. You know what they’re worth. You knew on Tuesday.',
            'Mum says don’t make a scene. This isn’t a scene. I’m just telling you everybody on the Fourth Line knows.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'flag', flag: 'flood.vulture_family' },
              { do: 'axis', axis: 'heart', weight: 'floodCheapBuy' },
              { do: 'rep', group: 'neighbourhood', delta: R.smallVulture },
            ],
          },
        },
      },
    },
    {
      id: 'flood.storage',
      when: [D(1, 4)],
      chance: 1,
      visit: {
        who: WHO,
        as: FLOOD_PEOPLE.nina,
        kind: 'scene',
        scene: {
          lines: [
            'Nina Arkadyevna, from across the yard. Ground floor, which this week is a misfortune.',
            'My husband’s accordion, the photograph albums, his mother’s sewing machine. Everything else can drown, frankly. But those.',
            'Could they sit in your back room until my walls dry? Two weeks. Everybody has a back room except me.',
          ],
          choices: [
            {
              id: 'store_free',
              label: 'Bring them in',
              reply: 'Bless you. I’ll carry the accordion myself; it doesn’t trust anybody.',
              effects: [
                { do: 'flag', flag: 'flood.hero_storage' },
                { do: 'flag', flag: 'heart.flood_storage' },
                { do: 'rep', group: 'neighbourhood', delta: R.hero },
              ],
            },
            {
              id: 'store_charge',
              label: `${rub(F.storageCharge / 2)} a week, two weeks`,
              reply: 'A rental. Of course. Everything is a rental this week. Here. Count it, if you like.',
              effects: [
                { do: 'cash', amount: F.storageCharge, text: 'Storage for two weeks: Nina Arkadyevna’s things' },
                { do: 'flag', flag: 'flood.vulture_storage' },
                { do: 'axis', axis: 'heart', weight: 'floodCharged' },
                { do: 'rep', group: 'neighbourhood', delta: R.smallVulture },
              ],
            },
            {
              id: 'store_no',
              label: 'No room, I’m sorry',
              reply: 'No. No, of course. Nobody has room this week.',
            },
          ],
        },
      },
    },
    {
      id: 'flood.storage_thanks',
      when: [{ if: 'beat', beat: 'flood.storage', outcome: ['store_free'], daysAgo: { gte: 12 } }],
      chance: 0.5,
      visit: {
        who: WHO,
        as: FLOOD_PEOPLE.nina,
        kind: 'scene',
        scene: {
          lines: [
            'My walls are dry, more or less. I’ve come for my husband’s things. The accordion says it was very comfortable.',
            'Blackcurrant. My own, from the dacha, from before. It’s the only jar that survived; I want it to go somewhere that deserves it.',
          ],
        },
        after: { talked: { effects: [{ do: 'rep', group: 'neighbourhood', delta: R.small }] } },
      },
    },
    {
      id: 'flood.storage_collect',
      when: [{ if: 'beat', beat: 'flood.storage', outcome: ['store_charge'], daysAgo: { gte: 12 } }],
      chance: 0.5,
      visit: {
        who: WHO,
        as: FLOOD_PEOPLE.nina,
        kind: 'scene',
        scene: {
          lines: [
            'I’ve come for my things. Thirteen days. I counted. I won’t ask for the day back.',
            'Thank you for keeping them dry. I mean that. I also mean the other thing.',
          ],
        },
      },
    },
    {
      id: 'flood.credit',
      when: [D(1, 5)],
      chance: 1,
      visit: {
        who: WHO,
        as: FLOOD_PEOPLE.misha,
        kind: 'scene',
        scene: {
          lines: [
            'Misha, the electrician at number nine. I’m wiring half the street back up, and nobody can pay me until the insurance comes, which is to say never.',
            `I need a dehumidifier for my own place, and parts. ${rub(F.credit)}. I’ve nothing to pawn: my tools are how I work, and the rest is wet.`,
            'I’ll pay you back when the street pays me. I know how that sounds.',
          ],
          choices: [
            {
              id: 'credit_lend',
              label: 'On your word, then',
              reply: 'On my word. I’ll write it down as well, so it’s on paper as well as my word. Thank you.',
              effects: [
                { do: 'cash', amount: -F.credit, text: 'Lent to Misha the electrician, on his word' },
                { do: 'flag', flag: 'flood.hero_credit' },
                { do: 'flag', flag: 'heart.flood_credit' },
              ],
            },
            {
              id: 'credit_no',
              label: 'I lend on things, not words',
              reply: 'Fair. That’s the job. I’d say the same. I wouldn’t, but I’d want to.',
            },
          ],
        },
      },
    },
    {
      id: 'flood.repaid',
      when: [
        { if: 'beat', beat: 'flood.credit', outcome: ['credit_lend'], daysAgo: { gte: F.repaid.after } },
        { if: 'beat', beat: 'flood.unpaid', not: true },
      ],
      chance: F.repaid.chance,
      visit: {
        who: WHO,
        as: FLOOD_PEOPLE.misha,
        kind: 'scene',
        scene: {
          lines: [
            'Misha. Count it. The insurance paid in the end, after I sat in their office for a day with a thermos and a very long face.',
            'And this is from my uncle in the country. Don’t drink it near anything electrical. Or anything.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'cash', amount: F.credit, text: 'Misha the electrician paid back what he owed' },
              { do: 'flag', flag: 'flood.credit_repaid' },
              { do: 'rep', group: 'neighbourhood', delta: R.small },
            ],
          },
        },
      },
    },
    {
      id: 'flood.unpaid',
      when: [
        { if: 'beat', beat: 'flood.credit', outcome: ['credit_lend'], daysAgo: { gte: F.repaid.after } },
        { if: 'beat', beat: 'flood.repaid', not: true },
      ],
      chance: F.repaid.skipChance,
      visit: {
        who: WHO,
        kind: 'scene',
        scene: {
          lines: [
            'Misha from number nine has gone to his brother’s in Tver. The insurance never paid. He left this for you, in an envelope, no stamp.',
            'A postcard of the Kupetsky Bridge. “I’ll pay. One day. M.” He will, too. One day is a long time on this street.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'flood.credit_lost' }] } },
      },
    },
    {
      id: 'flood.salvage',
      when: [D(1, 6), { if: 'arc', arc: 'protection', is: 'running' }],
      chance: 0.6,
      visit: {
        who: 'zhora',
        kind: 'seller',
        wants: 'sell',
        anchor: 0.35,
        scene: {
          lines: [
            'Eduard Lvovich sends his regards, and his sympathies about the water. The jeweller on Lodochnaya had a worse night than you.',
            'Things floated out of his window. Things float into our hands. That’s the river. Cheap, today only.',
          ],
        },
        item: {
          defId: 'gold_bracelet_585',
          authenticity: 'genuine',
          provenance: 'stolen',
          condition: [80, 92],
          story: 'Floated out of a window on Lodochnaya. Gold doesn’t mind a bath.',
        },
        line: 'Half of nothing. Gold doesn’t mind a bath.',
        after: {
          bought: {
            line: 'The river provides. Eduard Lvovich will be pleased you’re a practical person.',
            effects: [
              { do: 'flag', flag: 'flood.vulture_salvage' },
              { do: 'rep', group: 'mob', delta: R.small },
            ],
          },
          passed: { line: 'Suit yourself. The river gives. It gives to somebody else.' },
        },
      },
    },
  ],
} as const

/** A regular drops in after the water and says what the street says (hero, vulture or neither). */
function reactions(who: string, lines: { hero: readonly string[]; vulture: readonly string[]; plain: readonly string[] }) {
  const ids = { hero: `flood_talk.${who}_hero`, vulture: `flood_talk.${who}_vulture`, plain: `flood_talk.${who}_plain` } as const
  const others = (k: keyof typeof ids) =>
    (Object.keys(ids) as (keyof typeof ids)[]).filter((x) => x !== k).map((x) => ({ if: 'beat', beat: ids[x], not: true }) as const)
  const base = [D(6, 20), { if: 'visits', who, gte: 1 }] as const
  return (['hero', 'vulture', 'plain'] as const).map((k) => ({
    id: ids[k],
    when: [...base, ...(k === 'hero' ? [HERO] : k === 'vulture' ? [VULTURE] : PLAIN), ...others(k)],
    chance: 0.35,
    visit: { who, kind: 'scene', scene: { lines: lines[k] } },
  }))
}

const floodTalk = {
  id: 'flood_talk',
  title: 'The Flood: afterwards',
  beats: [
    {
      id: 'flood_talk.complaint',
      when: [D(3, 12), { if: 'flag', flag: 'flood.gouged' }, { if: 'volkova', met: true }],
      chance: 0.7,
      visit: {
        who: 'volkova',
        kind: 'scene',
        scene: {
          lines: [
            'Volkova. Off the record, which is to say on it. I’ve had a complaint. Arkady from number eleven says you sold him a pump.',
            'At a price. There’s a district order this week about prices in an emergency. Not a law, exactly. A sort of reminder with teeth.',
            'You can give him the difference back, and I write “resolved”. Or you can explain the free market to me. I have twenty minutes and a pen.',
          ],
          choices: [
            {
              id: 'gouge_refund',
              label: 'Give him the difference',
              reply: 'Resolved. I’ll tell him. He’ll still tell everybody, but he’ll tell it with a different ending.',
              effects: [
                { do: 'cash', amount: F.pump.fair - F.pump.gouge, text: 'Gave Arkady back the difference on the pump' },
                { do: 'unflag', flag: 'flood.vulture_pump' },
                { do: 'flag', flag: 'flood.refunded' },
                { do: 'heat', delta: F.complaint.refundHeat },
                { do: 'volkova', trust: F.complaint.refundTrust },
              ],
            },
            {
              id: 'gouge_shrug',
              label: 'It’s a free market',
              reply: 'It is. So is my notebook. Good afternoon.',
              effects: [
                { do: 'flag', flag: 'flood.shrugged' },
                { do: 'heat', delta: F.complaint.shrugHeat },
                { do: 'volkova', trust: F.complaint.shrugTrust },
                { do: 'rep', group: 'police', delta: F.complaint.policeRep },
              ],
            },
          ],
        },
      },
    },
    {
      id: 'flood_talk.praise',
      when: [D(3, 12), HERO, { if: 'flag', flag: 'flood.gouged', not: true }, { if: 'volkova', met: true }],
      chance: 0.6,
      visit: {
        who: 'volkova',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Volkova. Don’t worry, nobody has complained. That’s why I’m ringing; it’s unusual.',
            'Kuzmich from the yards says you lent out a pump and kept an old woman’s accordion dry. In my job I mostly hear the other kind of story. Good afternoon.',
          ],
        },
        after: {
          talked: {
            effects: [
              { do: 'flag', flag: 'flood.volkova_praised' },
              { do: 'volkova', trust: F.praise.trust },
              { do: 'rep', group: 'police', delta: F.praise.policeRep },
            ],
          },
        },
      },
    },
    ...reactions('rimma', {
      hero: [
        'My salon was a paddling pool on Wednesday. The dryer floated. I’ve got clients under towels in my kitchen.',
        'The whole chair is talking about you. The pump, the old lady’s accordion. I had to stop a perm halfway because nobody was listening to the timer. Don’t let it go to your head. Let it go a little.',
      ],
      vulture: [
        'My salon was a paddling pool on Wednesday. I’m doing cuts in my kitchen, and everybody who sits in that chair tells me a story.',
        'This week every story has your shop in it, and none of them have a nice ending. I’m only the messenger. I’m a messenger with scissors, so mind your fringe.',
      ],
      plain: [
        'My salon was a paddling pool on Wednesday. The dryer floated, the mirrors are fine, the landlord says it’s my problem.',
        'You came through it, I see. A tidemark on your wall like everybody. Welcome to Kanatnaya Street, properly now.',
      ],
    }),
    ...reactions('yevstafy', {
      hero: [
        'In the fleet, when a compartment floods, you find out in a minute who closes the hatch and who closes it behind him.',
        'I heard about the pump. You closed it in front of you. That is the right way round. That is all I came to say.',
      ],
      vulture: [
        'In the fleet, when a compartment floods, you find out in a minute who closes the hatch and who closes it behind him.',
        'I heard about the pump, and the price. Behind you, then. I have nothing to sell today. I wanted to see your face.',
      ],
      plain: [
        'Forty years at sea, and the water finally came for me in a ground-floor flat on the canal. The Navy would laugh.',
        'You kept your head, I hear. Good. Water is patient. It always comes back for the people who don’t.',
      ],
    }),
    ...reactions('zinaida', {
      hero: [
        'I’m on the third floor, so I watched the whole thing from the window like the television.',
        'Nina from the ground floor told me about her accordion. I told her I’d always said you were all right. I hadn’t, but I’m saying it now, so it counts backwards.',
      ],
      vulture: [
        'I’m on the third floor, so I watched the whole thing from the window like the television.',
        'And I heard. Everybody heard. My Kolya used to say you find out what people are in the cold and the wet. I don’t need to tell you what he’d say.',
      ],
      plain: [
        'I’m on the third floor, so I watched the whole thing from the window like the television. A swan on the tram line!',
        'Kolya would have been out there with a bucket. I made tea for the ones who were. You look as if you could use some too.',
      ],
    }),
    ...reactions('valentin', {
      hero: [
        'They stopped the trams for three days. Thirty-one years and I never saw the depot under water. The men were fishing from the platform.',
        'The drivers’ room is saying the pawn shop on the canal behaved like people. That’s high praise from the depot. They don’t say it about the management.',
      ],
      vulture: [
        'They stopped the trams for three days. Thirty-one years and I never saw the depot under water.',
        'The drivers’ room is saying things about the pawn shop on the canal. I told them they didn’t know the whole story. Then I wondered whether I did.',
      ],
      plain: [
        'They stopped the trams for three days. Thirty-one years and I never saw the depot under water. The men were fishing from the platform.',
        'My wife says the flat smells of the canal. I say the canal smells of the flat. We are having this argument for the rest of our lives.',
      ],
    }),
    {
      id: 'flood_talk.paper_hero',
      when: [D(7, 25), HERO],
      chance: 0.5,
      visit: {
        who: WHO,
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'The shop that kept its head above water',
            'In a fortnight when most traders on the embankment charged what the water would bear, Kuzmich, the caretaker of the Kanatnaya yards, wants it known that one did not. The pawnbroker on the canal, he says, lent out what was needed and charged what was fair. He asked us to print it twice. We have printed it once.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'flood.paper_hero' }] } },
      },
    },
    {
      id: 'flood_talk.paper_vulture',
      when: [D(7, 25), VULTURE],
      chance: 0.5,
      visit: {
        who: WHO,
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'Flood prices on Kanatnaya Street',
            'Families from the flooded basements say one shop on the canal did very well out of the spring water, and they will list the ways at length to anybody with a notebook. The district reminds traders that an emergency is not a sale. The shop declined to comment, or was not asked.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'flood.paper_vulture' }] } },
      },
    },
  ],
} as const

export { floodTalk }
export default flood
