/**
 * The Collector (M5, GDD § 9: "wants one specific icon; pays absurdly; it's stolen from a
 * church"). Leopold Germanovich Bessmertny, src/data/collector.ts. Numbers in tuning.collector.
 *
 *   collector.wish       From day 18: he comes in with a photograph from a 1912 parish album
 *                        and describes her (the dent, the wax, the little boat). Leaves a card.
 *   collector.icon       6+ days on: Seryozha the roofer brings her in, "my gran's", cheap
 *                        (visit.anchor). The loupe finds the parish number on the back.
 *                        Buying her is buying a stolen piece (the clean axis, a police trail).
 *   collector.news       The next morning's paper: taken from the Intercession church during
 *                        roof repairs; Father Ioann wants her back, no questions.
 *   collector.stanislav  If Stanislav is on retainer: he rings, amused. He knows the icon, and
 *                        the Collector. (Flavour; Stanislav's own icon is a different piece.)
 *   collector.offer      4+ days after you bought her, if you still hold her: the hatbox.
 *                        sell (350,000 ₽, dirty, heat, the police cooler) / return her to the
 *                        church (heart and clean, nothing paid back, the street warmer) / take
 *                        her to the police (clean, heat down, the police warmer).
 *   collector.museum / .thanks / .recovered   The paper afterwards, for each answer. Ends the arc.
 *   collector.missed     You bought her but she's gone by the time he comes (sold on, or Volkova
 *                        took her): he is heartbroken, beautifully. Ends the arc.
 *   collector.elsewhere  You passed on her: the museum opens with her anyway, bought across the
 *                        river. Ends the arc.
 *
 * Flags other arcs and the endings read: collector.asked, collector.bought / .passed, collector.sold, collector.returned,
 * collector.handed_in, collector.missed; dirty.collector_icon, heart.collector_icon.
 * Choice ids: sell is the dirty answer, return the clean one (the sim's careful policy
 * prefers return, mobFriendly and the fence policy sell).
 */
import { COLLECTOR_ICON, ROOFER } from '../collector'
import { tuning } from '../tuning'

const C = tuning.collector
const PRICE = `${C.price.toLocaleString('en-US')} ₽`

const bought = { if: 'beat', beat: 'collector.icon', outcome: ['bought'] } as const

/** The paper on the morning after an ending. */
const after = (choice: 'sell' | 'return' | 'police', days: number) =>
  ({ if: 'beat', beat: 'collector.offer', outcome: [choice], daysAgo: { gte: days } }) as const

export default {
  id: 'collector',
  title: 'The Collector',
  beats: [
    {
      id: 'collector.wish',
      when: [{ if: 'day', gte: C.wishDay }],
      chance: C.wishChance,
      visit: {
        who: 'bessmertny',
        kind: 'scene',
        scene: {
          lines: [
            'Good morning. Forgive me, I always apologise to a shop before I come in. Leopold Germanovich Bessmertny. Yes, really. It was a family joke until 1917.',
            'I am looking for a lady. This one. The photograph is from a parish album of 1912; she has had a hard century. Silver cover, a dent at the top left, a drip of wax on her hem.',
            'And at her feet, a little canal boat with one oar. Nobody else ever painted the boat. Eleven years I have looked for her.',
            `If she ever comes through your door, I will pay ${PRICE}. In cash. I would pay it twice, but Kostya says I mustn't say so. My card. It smells of lilies; that isn’t on purpose.`,
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'collector.asked' }] } },
      },
    },
    {
      id: 'collector.icon',
      when: [{ if: 'beat', beat: 'collector.wish', daysAgo: { gte: C.iconAfter } }],
      chance: C.iconChance,
      visit: {
        who: 'bessmertny',
        as: ROOFER,
        kind: 'seller',
        wants: 'sell',
        anchor: C.anchor,
        scene: {
          lines: [
            'Morning. Seryozha. I do roofs. Domes too, copper, when the church has the money, which is never.',
            'This was my gran’s. She kept it over the stove. I don’t pray, so. Somebody should have it who does.',
          ],
        },
        item: { defId: COLLECTOR_ICON, authenticity: 'genuine', provenance: 'stolen', condition: [62, 80], story: 'My gran’s. She kept it on the shelf over the stove. She’s gone now, God rest her.', same: 'collector_icon' },
        line: 'Whatever you think. Cash. I’ve got a job across the river at two.',
        after: {
          bought: { line: 'Thanks. Don’t, er, don’t put it in the window, eh? Gran was shy.', effects: [{ do: 'flag', flag: 'collector.bought' }] },
          passed: { line: 'Fair enough. Somebody across the river will have her.', effects: [{ do: 'flag', flag: 'collector.passed' }] },
          walked: { line: 'Forget it. Somebody across the river will have her.', effects: [{ do: 'flag', flag: 'collector.passed' }] },
        },
      },
    },
    {
      id: 'collector.news',
      when: [{ ...bought, daysAgo: { gte: 1 } }],
      chance: 1,
      visit: {
        who: 'bessmertny',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'Icon taken from the Intercession church',
            'A late 18th-century icon of the Mother of God, known in the parish as Our Lady of the Embankment, was taken from the Church of the Intercession on Kozhevennaya Street while the dome was being re-roofed. It has a silver cover with a dented corner and a small boat painted at her feet. Father Ioann asks whoever has it to bring it back: “No questions. We have enough questions of our own.”',
          ],
        },
      },
    },
    {
      id: 'collector.stanislav',
      when: [
        { ...bought, daysAgo: { gte: 1 } },
        { if: 'specialist', id: 'antiquary' },
        { if: 'holds', defId: COLLECTOR_ICON },
      ],
      chance: 0.6,
      visit: {
        who: 'antiquary',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'My dear. A little bird tells me a certain Mother of God came through your door. With a little boat. Don’t tell me; I can hear you not telling me.',
            'Leopold Germanovich has been looking for her for eleven years. Father Ioann, rather longer. One of them pays better. Neither of them is me, which is a pity.',
            'I won’t ask for a commission. He already knows your address. He knows everybody’s address; it’s his only vulgarity.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'collector.stanislav_knew' }] } },
      },
    },
    {
      id: 'collector.offer',
      when: [
        { ...bought, daysAgo: { gte: C.offerAfter } },
        { if: 'holds', defId: COLLECTOR_ICON },
      ],
      chance: C.offerChance,
      visit: {
        who: 'bessmertny',
        kind: 'scene',
        scene: {
          lines: [
            'You have her. I knew it in the doorway; a room is different with her in it. Forgive me, I am sentimental about rooms.',
            `${PRICE}. In this hatbox. Kostya counted it twice; he counts everything twice, even his children.`,
            'I know where she has been. Churches lose things. I find them and give them a better life: humidity control, a little spotlight, nobody lighting candles under her. Is that so terrible?',
          ],
          choices: [
            {
              id: 'sell',
              label: 'Take the hatbox',
              reply: 'Thank you. You have made an old man very happy, and I am not even old. Kostya, the car. Gently. She hates potholes.',
              effects: [
                { do: 'collector', change: 'sold' },
                { do: 'flag', flag: 'collector.sold' },
                { do: 'flag', flag: 'dirty.collector_icon' },
                { do: 'heat', delta: C.heat.sold },
                { do: 'rep', group: 'police', delta: C.rep.soldPolice },
              ],
            },
            {
              id: 'return',
              label: 'She goes back to her church',
              reply: 'Ah. A believer. Or worse, a decent person. You have broken my heart very beautifully. I shall have to visit her there, like everybody else. Good day.',
              effects: [
                { do: 'collector', change: 'returned' },
                { do: 'flag', flag: 'collector.returned' },
                { do: 'flag', flag: 'heart.collector_icon' },
                { do: 'axis', axis: 'clean', weight: 'iconReturned' },
                { do: 'heat', delta: C.heat.returned },
                { do: 'rep', group: 'neighbourhood', delta: C.rep.returnedNeighbourhood },
              ],
            },
            {
              id: 'police',
              label: 'She goes to the police',
              reply: 'The police! Like a lost umbrella. Well. I shall write to the newspapers about it, and they will not print it. Good day.',
              effects: [
                { do: 'collector', change: 'handedIn' },
                { do: 'flag', flag: 'collector.handed_in' },
                { do: 'axis', axis: 'clean', weight: 'iconHandedIn' },
                { do: 'heat', delta: C.heat.handedIn },
                { do: 'rep', group: 'police', delta: C.rep.handedInPolice },
              ],
            },
          ],
        },
      },
    },
    {
      id: 'collector.museum',
      when: [after('sell', C.museumAfter)],
      chance: 1,
      visit: {
        who: 'bessmertny',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'A museum in the old bathhouse',
            'The Bessmertny Foundation for Domestic Beauty opened its private museum in the old Embankment bathhouse last night, by invitation only. Guests praised the humidity control. The centrepiece, a Mother of God with a little boat at her feet, is described as “from a private collection”. Father Ioann of the Intercession church was not invited and said he would come anyway.',
          ],
        },
        after: { talked: { effects: [{ do: 'endArc' }] } },
      },
    },
    {
      id: 'collector.thanks',
      when: [after('return', C.paperAfter)],
      chance: 1,
      visit: {
        who: 'bessmertny',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'Lost icon comes home',
            'Our Lady of the Embankment is back in the Church of the Intercession on Kozhevennaya Street. Father Ioann says she was brought in by “a pawnbroker from the canal who wouldn’t give a name and wouldn’t take a kopek”. The candles are lit again. A man in a good suit was seen at the back of the evening service, crying into a velvet glove.',
          ],
        },
        after: { talked: { effects: [{ do: 'endArc' }] } },
      },
    },
    {
      id: 'collector.recovered',
      when: [after('police', C.paperAfter)],
      chance: 1,
      visit: {
        who: 'bessmertny',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'Police recover stolen icon',
            'The icon taken from the Church of the Intercession during roof repairs has been returned to the parish by Kanal district police. Detective A. S. Volkova thanked “a shop that picked up the phone, which is rarer than icons”. A roofer is helping with enquiries.',
          ],
        },
        after: { talked: { effects: [{ do: 'endArc' }] } },
      },
    },
    {
      id: 'collector.missed',
      when: [
        { ...bought, daysAgo: { gte: C.offerAfter } },
        { if: 'holds', defId: COLLECTOR_ICON, not: true },
        { if: 'beat', beat: 'collector.offer', not: true },
      ],
      chance: C.offerChance,
      visit: {
        who: 'bessmertny',
        kind: 'scene',
        scene: {
          lines: [
            'She was here. I can tell; a room remembers. And now she isn’t.',
            'No, don’t tell me where she went. I would only follow her, and Kostya has a bad back.',
            'Eleven years. Well. Twelve is a nicer number. Good day to you. Truly.',
          ],
        },
        after: { talked: { effects: [{ do: 'flag', flag: 'collector.missed' }, { do: 'endArc' }] } },
      },
    },
    {
      id: 'collector.elsewhere',
      when: [{ if: 'beat', beat: 'collector.icon', outcome: ['passed', 'walked'], daysAgo: { gte: C.elsewhereAfter } }],
      chance: 1,
      visit: {
        who: 'bessmertny',
        kind: 'scene',
        via: 'paper',
        scene: {
          lines: [
            'A museum in the old bathhouse',
            'The Bessmertny Foundation for Domestic Beauty opened its private museum in the old Embankment bathhouse last night. Its centrepiece, a Mother of God with a little boat at her feet, was bought “from a dealer across the river”. Father Ioann of the Intercession church, where an icon very like it went missing this spring, said he would be writing to the police. Again.',
          ],
        },
        after: { talked: { effects: [{ do: 'endArc' }] } },
      },
    },
  ],
} as const
