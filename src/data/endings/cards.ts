/**
 * "What became of them" (M5, GDD § 12): one card per major regular and arc character
 * you met, each specialist you kept on, and Volkova and the fence if you met them. A
 * card shows when its `show` conditions hold; its text is the first variant whose
 * conditions hold (the last has none: the fallback). Conditions: src/game/schema/endings.ts.
 *
 * Trust thresholds follow tuning.regulars (warm from 0.35, cold at −0.25). Fictional
 * people; nobody is hurt on the page.
 *
 * Detective Volkova reads crime.volkova (trust, lies caught, bribes) and the police.*
 * flags; her fallback needs nothing but her introduction. Venya Mostovoy (the
 * fence, src/data/fence.ts) reads crime.fence (deals vs refusals), fenceTrust and the
 * standing arrangement (dirty.fence_standing).
 *
 * Leopold Germanovich Bessmertny (the Collector, src/data/collector.ts) shows once he has
 * asked after his icon (collector.asked) and reads how it left the shop: collector.sold,
 * .returned, .handed_in, .missed, or .passed (you never bought her).
 */
import type { z } from 'zod'
import type { EpilogueCard } from '../../game/schema/endings'
import { COLLECTOR } from '../collector'
import { FENCE } from '../fence'
import { tuning } from '../tuning'

type Raw = z.input<typeof EpilogueCard>

const WARM = 0.35
const COLD = -0.25
/** Venya's card reads the fence's own thresholds: standing deals, warm trust, sore refusals. */
const F = tuning.fence

export const CARDS: Raw[] = [
  // --- regulars and arc people -------------------------------------------------
  {
    id: 'zinaida',
    name: 'Zinaida Petrovna',
    role: 'Widow, third floor across the canal',
    show: [{ if: 'met', who: 'zinaida' }],
    variants: [
      {
        when: [{ if: 'beat', beat: 'medals.found_out' }],
        text: 'Zinaida Petrovna buys her bread on the far side of the canal now, so she doesn’t have to pass your window. She tells the story of the two medals to anyone in a queue. It gets longer every time, and you are never the hero.',
      },
      {
        when: [{ if: 'flag', flag: 'medals_kolya_story' }],
        text: 'Kolya’s story, the one from Gennady Pavlovich’s archive, hangs framed above her television beside his photograph. Her roof was mended in the end. She reads the story to the plumber, the postman and anyone else who stands still long enough.',
      },
      {
        when: [{ if: 'flag', flag: 'medals_conman_known' }],
        text: 'The man at Sennaya stopped selling medals to widows the month Zinaida Petrovna started warning them. She still brings pirozhki. Cabbage. She still says don’t make that face.',
      },
      {
        when: [{ if: 'trust', who: 'zinaida', gte: WARM }],
        text: 'Zinaida Petrovna tells the whole stairwell you are the only honest pair of hands on the canal, then lists your faults, so nobody thinks she has gone soft.',
      },
      {
        when: [{ if: 'trust', who: 'zinaida', lte: COLD }],
        text: 'Zinaida Petrovna took her mother’s earrings to the man on Sadovaya, who shouts. She says at least you know where you are with shouting.',
      },
      {
        when: [],
        text: 'Zinaida Petrovna got her roof mended by a nephew who had to be asked three times. She still crosses herself when she passes the shop. Out of habit, or as a review; it is hard to say.',
      },
    ],
  },
  {
    id: 'fedya',
    name: 'Fedya Ryabov',
    role: 'The student with the laptop',
    show: [{ if: 'met', who: 'fedya' }],
    variants: [
      {
        when: [{ if: 'flag', flag: 'laptop_graduated' }, { if: 'beat', beat: 'laptop.renew', outcome: ['waive'] }],
        text: 'Fedya defended his diploma in a borrowed tie and works for a heating firm now, designing boilers he swears are thermodynamically sound. Every New Year a postcard arrives addressed to “the shop, the canal”. It always gets there.',
      },
      {
        when: [{ if: 'flag', flag: 'laptop_graduated' }],
        text: 'Fedya passed his retake, defended his diploma and still has the Tosaki, held together with tape and gratitude. He tells his first-year interns about the pawnbroker who explained interest to him better than the Polytechnic did.',
      },
      {
        when: [{ if: 'flag', flag: 'laptop_forfeited' }],
        text: 'Fedya finished the year on library computers after the laptop went to the safe. He graduated late and doesn’t pawn anything any more. He says that’s the lesson. He doesn’t say whose.',
      },
      {
        when: [{ if: 'beat', beat: 'laptop.mum' }],
        text: 'Fedya’s mother paid in the end, with a speech. He graduated, mostly to stop her making the speech again.',
      },
      {
        when: [],
        text: 'Fedya still rents the room by the tram depot and still has deadlines. He waves when he passes the window, laptop under his arm, like a man carrying a cat he has rescued.',
      },
    ],
  },
  {
    id: 'edik',
    name: 'Edik Sorokin',
    role: 'The Dubai Rolex Guy',
    show: [{ if: 'met', who: 'edik' }],
    variants: [
      {
        when: [{ if: 'flag', flag: 'rolex_friends' }],
        text: 'Edik and Ramil run a phone-case stall by the metro now. Every case is “from Dubai”. Ramil’s wife still sends baklava on the day the shop first opened, and Edik still pretends he made it.',
      },
      {
        when: [{ if: 'flag', flag: 'rolex_real_missed' }],
        text: 'Edik tells everyone about the pawnbroker who waved away a real Rolland. The story improves with every telling; in the latest version you also turned down a Fabergé egg and a small yacht.',
      },
      {
        when: [{ if: 'flag', flag: 'rolex_called_liar' }],
        text: 'Edik sells his Dubai watches across the river now, to a pawnbroker who doesn’t call him names. He wears his purple shirt past your window on Sundays, slowly, so you see.',
      },
      {
        when: [],
        text: 'Edik’s friend in Dubai stopped sending watches. Edik is now importing perfume from a friend in Milan. Nobody has met the friend in Milan either.',
      },
    ],
  },
  {
    id: 'valentin',
    name: 'Valentin Egorovich',
    role: 'Retired tram driver, coin collector',
    show: [{ if: 'met', who: 'valentin' }],
    variants: [
      {
        when: [{ if: 'trust', who: 'valentin', gte: WARM }],
        text: 'Valentin Egorovich’s wife is well enough to scold him again, which he says is the best sign there is. He still brings a coin now and then out of habit, shows it to whoever is behind the counter, and takes it home again.',
      },
      {
        when: [{ if: 'trust', who: 'valentin', lte: COLD }],
        text: 'Valentin Egorovich found a dealer on the far side of the river who weighs the coins in front of him. It is two trams each way. He says it is worth it.',
      },
      {
        when: [],
        text: 'Valentin Egorovich sold the last of his doubles in the spring and told his wife they were worthless, as always. She knew, as always. They take the No. 9 to the end of the line on Sundays, for the view.',
      },
    ],
  },
  {
    id: 'yevstafy',
    name: 'Yevstafy Lukich',
    role: 'Engineer captain, retired, Northern Fleet',
    show: [{ if: 'met', who: 'yevstafy' }],
    variants: [
      {
        when: [{ if: 'trust', who: 'yevstafy', gte: WARM }],
        text: 'Yevstafy Lukich ran out of instruments to sell and started coming in anyway, to check your barometer against his memory of the Barents Sea. He has left you his sextant in his will, with a note: “Keep it dry, and keep it.”',
      },
      {
        when: [{ if: 'trust', who: 'yevstafy', lte: COLD }],
        text: 'Yevstafy Lukich sells his instruments to a dealer in the Admiralty district now, who calls him Captain. He says the dealer knows nothing about instruments, but the dealer knows how to say Captain.',
      },
      {
        when: [],
        text: 'Yevstafy Lukich teaches knots to the sea cadets on Wednesdays. The flat is still too quiet, but less on Wednesdays.',
      },
    ],
  },
  {
    id: 'margarita',
    name: 'Margarita Vdovina',
    role: 'The widow with the very new things',
    show: [{ if: 'met', who: 'margarita' }],
    variants: [
      {
        when: [{ if: 'ending', kind: ['raided'] }],
        text: 'Margarita Vdovina is helping the police with their enquiries into her late husband, who turned out to have been several men, all of them missing a watch.',
      },
      {
        when: [{ if: 'band', is: 'dirty' }],
        text: 'Margarita Vdovina has remarried, a retired customs officer. His things are also very new. She still wears black, in a better cut.',
      },
      {
        when: [],
        text: 'Margarita Vdovina moved to the seaside, where her late husband was, she says, a lighthouse keeper. She sends no postcards. A detective asked after her twice.',
      },
    ],
  },
  {
    id: 'crew',
    name: 'Eduard Lvovich',
    role: 'Looks after the street',
    show: [{ if: 'arc', arc: 'protection', is: 'started' }],
    variants: [
      {
        when: [{ if: 'ending', kind: ['pushedOut'] }],
        text: 'Eduard Lvovich’s nephew stands behind your old counter now, under a new lease from Semyon Markovich. Eduard Lvovich drops by in the mornings to see that the glass is clean. He says please. He remembers everything.',
      },
      {
        when: [{ if: 'flag', flag: 'protection.held_out' }],
        text: 'Eduard Lvovich still drives past the bakery, slowly, and nobody comes out with a broom any more because nobody needs to. He collects on other streets. He tells them about yours, as a warning, and they take it as a recommendation.',
      },
      {
        when: [{ if: 'title', is: ['front'] }],
        text: 'Eduard Lvovich sends a card every New Year with a calendar of the bridges. The card thanks you for your years of service. Zhora signs it too, in capitals.',
      },
      {
        when: [{ if: 'flag', flag: 'protection.box_kept' }],
        text: 'Eduard Lvovich still has a key to the back room that he swears he gave back. The box that sat there for a week went somewhere else, and so did whatever was in it. He has never once mentioned it. That is how you know he remembers.',
      },
      {
        when: [{ if: 'flag', flag: 'protection.paying' }],
        text: 'Eduard Lvovich still makes his rounds on the canal, polite, on time, a little greyer. The new owner pays on the first of the month. Zhora still stands by the door and says nothing at all.',
      },
      {
        when: [{ if: 'flag', flag: 'protection.told_police' }],
        text: 'Eduard Lvovich works other streets now. A detective spent a long afternoon with him, and he has been very careful about glue ever since.',
      },
      {
        when: [{ if: 'flag', flag: 'protection.refused' }],
        text: 'Eduard Lvovich crossed the canal to collect elsewhere. The bakery that burned reopened with a new oven. The baker says the shop down the road showed them how to say no.',
      },
      {
        when: [],
        text: 'Eduard Lvovich and Zhora were never seen on the canal again. The previous owner’s debt, as far as anyone knows, still stays with the address, like the damp.',
      },
    ],
  },
  {
    id: 'zhora',
    name: 'Zhora',
    role: 'Eduard Lvovich’s man at the door',
    show: [{ if: 'arc', arc: 'protection', is: 'started' }, { if: 'met', who: 'zhora' }],
    variants: [
      {
        when: [{ if: 'ending', kind: ['pushedOut'] }],
        text: 'Zhora carried your stock out to the van himself, carefully, one box at a time, and put the cat on the step of the shop next door. He did not say sorry. He held the door for the last box.',
      },
      {
        when: [{ if: 'flag', flag: 'protection.held_out' }],
        text: 'Zhora still buys his bread at the bakery that wouldn’t pay. The baker serves him, slowly, and gives him the burnt one. He eats it on the pavement outside your old window and seems, somehow, to approve.',
      },
      {
        when: [{ if: 'any', of: (['gold', 'phones', 'camera'] as const).map((d) => ({ if: 'beat' as const, beat: `protection.delivery_${d}`, outcome: ['bought'] })) }],
        text: 'Zhora brings his deliveries to the new owner now, the same holdall, the same price: half of what it would fetch. He mentions you as a reference. It is not the kind of reference anyone frames.',
      },
      {
        when: [{ if: 'flag', flag: 'protection.paying' }],
        text: 'Zhora still collects the envelope on the first of the month, counts it in front of you without moving his lips, and says “good”. It is the only word he has ever said in the shop. He says it the same way every time.',
      },
      {
        when: [],
        text: 'Zhora still has Gusev’s IOU folded in his wallet. He shows it to people sometimes, as if it explained something. Nobody has ever asked him what.',
      },
    ],
  },
  // --- specialists you kept on ---------------------------------------------------
  {
    id: 'faina',
    name: 'Faina Gelfand',
    role: 'Jeweller, the arcade',
    show: [{ if: 'hired', id: 'jeweler' }],
    variants: [
      {
        when: [{ if: 'flag', flag: 'faina_book_bought' }],
        text: 'Faina’s customer book went to whoever took over your shop, with your notes in the margins. Faina moved in with her sister and complains about the sister’s gold, which she says is plated.',
      },
      {
        when: [{ if: 'flag', flag: 'faina_book_declined' }],
        text: 'Faina gave her bench and her book to her nephew, who doesn’t know 585 from 375. She still pops in to tell him. Your name comes up; she remembers how you treated her, both ways.',
      },
      {
        when: [{ if: 'specialist', id: 'jeweler', retained: true, relationship: { gte: 0.5 } }],
        text: 'Faina Gelfand still sits at her bench in the arcade, loupe in her eye, and still asks for anything heavy in 585 first. She sends you a card that says only: “You learned.”',
      },
      {
        when: [],
        text: 'Faina Gelfand still buys good gold cheaply and sells it dear. She says it is not cheating if the other person could have looked it up.',
      },
    ],
  },
  {
    id: 'ilya',
    name: 'Ilya Semyonovich Brodsky',
    role: 'Watchmaker',
    show: [{ if: 'hired', id: 'watchmaker' }],
    variants: [
      {
        when: [{ if: 'flag', flag: 'heart.ilya_operation' }],
        text: 'After the operation Ilya Semyonovich can read a dial across the room again. He finished the widow’s pocket watch and a hundred others. His granddaughter has started an apprenticeship at his bench; he makes her describe every watch slowly.',
      },
      {
        when: [{ if: 'flag', flag: 'ilya_no_operation' }],
        text: 'Ilya Semyonovich retired at the year’s end, his eyes too far gone for movements. His granddaughter reads him the paper. He asks her to look for watches in the small ads, just to hear them described.',
      },
      {
        when: [{ if: 'flag', flag: 'ilya_let_go' }],
        text: 'Ilya Semyonovich took on a few old customers who don’t mind waiting. He says you let him go like a gentleman, which is more than his eyes did.',
      },
      {
        when: [],
        text: 'Ilya Semyonovich still mends watches for the neighbours, slowly, by the window where the light is best. He says watches are honest. They tell you when they’re wrong.',
      },
    ],
  },
  {
    id: 'gennady',
    name: 'Gennady Pavlovich Shurygin',
    role: 'Militaria collector',
    show: [{ if: 'hired', id: 'collector' }],
    variants: [
      {
        when: [{ if: 'flag', flag: 'heart.gennady_family' }],
        text: 'The medal you let Gennady Pavlovich have went back to the family who had been looking for it. They invited him for dinner. He went, and wore his best jacket, and talked about archives for three hours. They have invited him again.',
      },
      {
        when: [{ if: 'flag', flag: 'gennady_first_refusal' }],
        text: 'Gennady Pavlovich still rings the evening after any good piece turns up on the canal, offering his mid-range price. The new owner doesn’t know who he is. He explains, at length.',
      },
      {
        when: [],
        text: 'Gennady Pavlovich is writing a book about the Orders of the canal district. You are in a footnote. He says footnotes are where the truth lives.',
      },
    ],
  },
  {
    id: 'stanislav',
    name: 'Stanislav Edgarovich Lyubimov',
    role: 'Antiques dealer',
    show: [{ if: 'hired', id: 'antiquary' }],
    variants: [
      {
        when: [{ if: 'flag', flag: 'stanislav_owed' }],
        text: 'Stanislav Edgarovich never did call in the favour you owed him. He mentions it at parties, as a thing he is keeping, like a good icon.',
      },
      {
        when: [{ if: 'flag', flag: 'dirty.stanislav_silver' }],
        text: 'Stanislav Edgarovich’s “family silver” turned up in an auction catalogue with a better story and a higher price. He sent you the catalogue, with a bookmark.',
      },
      {
        when: [],
        text: 'Stanislav Edgarovich is still never wrong and rarely honest. He has opened a gallery on the embankment. The gentlemen who look after the street visit it often and buy nothing.',
      },
    ],
  },
  {
    id: 'zhenya',
    name: 'Zhenya Kroshkina',
    role: 'Electronics tech',
    show: [{ if: 'hired', id: 'technician' }],
    variants: [
      {
        when: [{ if: 'flag', flag: 'zhenya_desk' }, { if: 'ending', kind: ['retired'] }],
        text: 'Zhenya kept the repair desk in the corner after you left. The new owner tried to charge her more rent, so she fixed his phone very slowly. The rent stayed where it was.',
      },
      {
        when: [{ if: 'flag', flag: 'zhenya_desk' }],
        text: 'Zhenya packed up her repair desk the day the shop closed and set it up on the pavement outside, under an umbrella. She still has your biscuit tin. She says it’s collateral.',
      },
      {
        when: [],
        text: 'Zhenya fixes phones from a kiosk across the river now: cheap, fast, a little careless. She still eats biscuits as if somebody might take them away.',
      },
    ],
  },
  // --- the police and the trade ----------------------------------------------------
  {
    id: 'collector',
    name: COLLECTOR.name,
    role: COLLECTOR.role,
    show: [{ if: 'flag', flag: 'collector.asked' }],
    variants: [
      {
        when: [{ if: 'flag', flag: 'collector.sold' }],
        text: 'The Bessmertny Foundation for Domestic Beauty is open to the public on the first Sunday of the month, by appointment. Our Lady of the Embankment hangs in a room of her own at exactly fifty per cent humidity. Leopold Germanovich visits her every evening. Father Ioann visits on the first Sunday, by appointment, and stands there until they close.',
      },
      {
        when: [{ if: 'flag', flag: 'collector.returned' }],
        text: 'Leopold Germanovich goes to the evening service at the Intercession church on Kozhevennaya Street, at the back, in a good suit. He paid for the new dome in the end, anonymously, which in his case means everybody knows. He still sends you a card every Easter. It still smells of lilies.',
      },
      {
        when: [{ if: 'flag', flag: 'collector.handed_in' }],
        text: 'Leopold Germanovich wrote eleven letters to the newspapers about the icon you gave to the police. None was printed. He had them bound in green leather and gave a copy to Detective Volkova, who has, against all expectation, read it.',
      },
      {
        when: [{ if: 'flag', flag: 'collector.missed' }],
        text: 'Leopold Germanovich is still looking for her. Twelve years, then thirteen. He says it is a nicer number every year. Kostya’s back is worse.',
      },
      {
        when: [{ if: 'flag', flag: 'collector.passed' }],
        text: 'Leopold Germanovich found her across the river in the end, as he always finds things. He never told you how much he paid. He sent you a photograph of her in her new room, with a note: “You could have been part of this.” It was meant kindly. Mostly.',
      },
      {
        when: [],
        text: 'Leopold Germanovich is still looking for a lady with a little boat at her feet. His card is still in your drawer. It still smells of lilies.',
      },
    ],
  },
  {
    id: 'volkova',
    name: 'Detective Volkova',
    role: 'Canal district police',
    show: [{ if: 'volkova', met: true }],
    variants: [
      {
        when: [{ if: 'ending', kind: ['raided'] }],
        text: 'Volkova led the search herself and wrote the report the same night, in neat capitals. She keeps a copy in her desk, under the one about the bicycle thief who became a priest.',
      },
      {
        when: [{ if: 'flag', flag: 'police.bribe_refused' }],
        text: 'Volkova still has the envelope you offered her, unopened, in a drawer marked “for special occasions”. She has never said what the occasion would be. She tells the story at retirements, without names. Everyone on the canal knows the name.',
      },
      {
        when: [{ if: 'volkova', met: true, bribes: { gte: 1 } }],
        text: 'Volkova was transferred to the port, where the envelopes are thicker and the questions are the same. She remembers what you gave her and what it was for. She writes everything down.',
      },
      {
        when: [{ if: 'volkova', met: true, caught: { gte: 1 } }],
        text: 'Volkova still drinks her tea standing up and still remembers the day you lied to her, to the item and the hour. She keeps one mistake for special occasions. Yours is the one she mentions, kindly, to every new officer on the canal.',
      },
      {
        when: [{ if: 'volkova', met: true, trust: { gte: 0.4 } }],
        text: 'Volkova made inspector. She tells the new pawnbrokers on the canal there was one shop where you could ask a question and get an answer, and a passport book that was actually filled in, and that they should try it.',
      },
      {
        when: [{ if: 'flag', flag: 'police.cooperated' }],
        text: 'Volkova still does the pawn shops on this side of the water, all eleven, one fewer now. Once, you handed her a watch without being asked twice. She has not forgotten. She has not quite forgiven you for making her job easy, either.',
      },
      {
        when: [],
        text: 'Volkova still does the pawn shops on this side of the water, all eleven, one fewer now. She nods at your old window as she passes. It is not quite a greeting. From her, it is close.',
      },
    ],
  },
  {
    id: 'fence',
    name: FENCE.name,
    role: FENCE.role,
    show: [{ if: 'fence', met: true }],
    variants: [
      {
        when: [{ if: 'ending', kind: ['raided'] }, { if: 'fence', met: true, deals: { gte: 1 } }],
        text: 'The night before the raid a relief man sat in the Kupetsky cabin; Venya had swapped his shift, the first in nineteen years. Nobody has asked him why. In his notebook, that night has no entry at all.',
      },
      {
        when: [{ if: 'flag', flag: 'dirty.fence_standing' }],
        text: 'Venya still keeps Tuesdays, with a new shop on another canal. Your name stays in pen on the inside cover, next to his mother’s number. He says it would feel rude to rub it out. He says it as if it were a kindness.',
      },
      {
        when: [{ if: 'fence', met: true, deals: { gte: F.standing.deals }, trust: { gte: F.warmAt } }],
        text: 'Venya brought pirozhki on your last day, cabbage, too many. He talked about barges and his mother’s knitting and never once about business. Things still cross the river while the bridge is up. You are glad, mostly, not to know which.',
      },
      {
        when: [{ if: 'fence', met: true, refusals: { gte: F.soreAt }, deals: { lte: 1 } }],
        text: 'Venya sent a postcard of the Kupetsky Bridge, raised, at night. On the back, in pencil, a list of dates: every no you ever gave him. Underneath: “Thorough people should know each other. Regards to the shop.”',
      },
      {
        when: [{ if: 'fence', met: true, deals: { gte: 1 } }],
        text: 'Venya remembers every price you two ever settled on, to the rouble, and the weather on each of those days. He raises the bridge at twenty-five past one and lowers it at ten to five. In between, he does not think about you. He has a notebook for that.',
      },
      {
        when: [],
        text: 'Venya still raises the Kupetsky at twenty-five past one. Your page in the notebook is short: one meeting, one no, in pencil. He says pencil is kinder. He says he has never needed the eraser.',
      },
    ],
  },
]
