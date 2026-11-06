/**
 * M6: "what became of them" for the twenty new regulars (src/data/regulars, M6 section).
 * Same rules as cards.ts: a card shows when `show` holds, and its text is the first variant
 * that holds (the last has no conditions). These show only for someone you got to know
 * (three visits or more), so a long career's epilogue isn't forty cards of strangers.
 * They read the regular's thread flags (src/data/stories/threads) and their trust.
 */
import type { z } from 'zod'
import type { EpilogueCard } from '../../game/schema/endings'

type Raw = z.input<typeof EpilogueCard>

const WARM = 0.35
const COLD = -0.25
const known = (who: string) => [{ if: 'met', who }, { if: 'visits', who, gte: 3 }] as const
const warm = (who: string) => ({ if: 'trust', who, gte: WARM }) as const
const cold = (who: string) => ({ if: 'trust', who, lte: COLD }) as const
const flag = (f: string) => ({ if: 'flag', flag: f }) as const

export const REGULAR_CARDS: Raw[] = [
  {
    id: 'artur',
    name: 'Artur Kim',
    role: 'DJ at Podval',
    show: [...known('artur')],
    variants: [
      { when: [flag('artur_weddings')], text: 'Artur plays weddings now, in a waistcoat, and is booked into next spring. He still does one night a month at Podval for free, “to stay honest”. Nobody there knows what that means.' },
      { when: [warm('artur')], text: 'Artur still pawns the good headphones before a big night and still comes back for them, two days later, smelling of smoke machine. He introduces you to people as “my bank”.' },
      { when: [cold('artur')], text: 'Artur takes his headphones to a place on Sennaya now. He says the music there is worse, but so is the interest.' },
      { when: [], text: 'Podval closed for a month for the fire inspector and reopened with the same fire. Artur is still behind the decks, still a hundred roubles short of a new needle.' },
    ],
  },
  {
    id: 'bakhtiyor',
    name: 'Bakhtiyor Rakhimov',
    role: 'Builder, Friday afternoons',
    show: [...known('bakhtiyor')],
    variants: [
      { when: [flag('bakhtiyor_madina')], text: 'Bakhtiyor’s eldest, Madina, got a place at the Medical Institute. He has told the whole building site, the site foreman, and the foreman’s mother. He still works Saturdays, and calls it her tuition.' },
      { when: [flag('bakhtiyor_handed_in')], text: 'The gold watch from the wall went back to the family whose flat it was, through the police, and they sent Bakhtiyor a cake. He shared it with the crew. Nobody on a building site has ever been thanked before.' },
      { when: [warm('bakhtiyor')], text: 'Every Friday Bakhtiyor leaves the site at three, buys bread, and comes past the shop to say nothing in particular. You would notice if he stopped.' },
      { when: [], text: 'Bakhtiyor plasters other people’s flats for a living and is saving for one of his own. Fourteen square metres, he says, and every one of them straight.' },
    ],
  },
  {
    id: 'dilnoza',
    name: 'Dilnoza Rakhimova',
    role: 'The kiosk by the tram stop',
    show: [...known('dilnoza')],
    variants: [
      { when: [flag('dilnoza_kiosk_stays')], text: 'The kiosk by the tram stop is still there, with your name on the petition taped inside the glass. Dilnoza gives you the newspaper a minute before anyone else. It is the only kind of rich she cares about.' },
      { when: [flag('dilnoza_bakery')], text: 'Dilnoza sells samsa at the back of Lyusya’s bakery now. The kiosk went for a parking space. She says the samsa are better than the kiosk ever was. She doesn’t say she misses it.' },
      { when: [], text: 'Dilnoza still sells cigarettes, phone credit and sunflower seeds from a box two metres square, and knows more about the street than the district police.' },
    ],
  },
  {
    id: 'jamshid',
    name: 'Jamshid Rakhimov',
    role: 'Bakhtiyor’s cousin',
    show: [...known('jamshid')],
    variants: [
      { when: [flag('jamshid_wedding')], text: 'Jamshid married a girl from Samarkand in a hall with three hundred guests and a cake shaped like a mosque. The Komandirskie was on his wrist, and his mother saw it.' },
      { when: [flag('jamshid_mother_sees')], text: 'Jamshid’s mother came for a month and he took her everywhere, watch on, like a man who had never pawned anything. She knows. Mothers know. She didn’t say.' },
      { when: [{ if: 'pledge', beat: 'jamshid.monday', is: ['forfeited'] }], text: 'Jamshid never came back for his grandfather’s watch. He works further out now, on the new estates. He takes the long way round, so he doesn’t pass the window.' },
      { when: [], text: 'Jamshid sends money home on the first of every month and keeps exactly enough for tea. He is the most organised man in Mostograd and has never once had any money.' },
    ],
  },
  {
    id: 'patimat',
    name: 'Patimat Aliyeva',
    role: 'Tailor in the underpass',
    show: [...known('patimat')],
    variants: [
      { when: [flag('heart.patimat_gift')], text: 'There is a wedding photograph in Makhachkala with four hundred and six people in it, and on the gift table, if you look closely, a card from a pawn shop in Mostograd. Patimat turns up your trousers for free, forever.' },
      { when: [warm('patimat')], text: 'Patimat still sits in the underpass with her machine, taking up hems for half the city. She mends the shop’s curtain every spring without being asked and refuses money in three languages.' },
      { when: [], text: 'Patimat’s booth in the underpass has a new sign, hand-painted: “Repairs. Alterations. Advice.” The advice is free and you will get it.' },
    ],
  },
  {
    id: 'snezhana',
    name: 'Snezhana Lapina',
    role: 'Nails by day, karaoke by night',
    show: [...known('snezhana')],
    variants: [
      { when: [flag('snezhana_repaid')], text: 'Snezhana sings on the evening cruise boat, under the bridges, all summer. The train fare came back in tips. Every time the boat passes the canal she does the high note at your window. You can set your clock by it.' },
      { when: [flag('snezhana_boat')], text: 'Snezhana found her stage on a tour boat on the Mostovaya. Eleven seconds of television, and then a whole river. She says that’s a better ratio than most people get.' },
      { when: [], text: 'Snezhana still does nails at the salon on Kirpichny and still sings at the karaoke bar on Thursdays. The bar has a plaque now. It says her name and “do not give her the microphone after midnight”.' },
    ],
  },
  {
    id: 'kira',
    name: 'Kira Bessonova',
    role: 'Croupier at the Avrora',
    show: [...known('kira')],
    variants: [
      { when: [flag('kira_school')], text: 'Kira teaches ballroom to small children in a wedding hall that used to be a Pioneer Palace. She deals cards to nobody now. She says six-year-olds cheat worse than bankers, and are easier to forgive.' },
      { when: [flag('kira_warned')], text: 'Kira was never anywhere and never said anything. Still: someone once warned you about thin glass, and you remember who.' },
      { when: [], text: 'Kira still deals at the Avrora, smiling at men losing their flats a chip at a time. The jar is nearly full. She has not decided what with.' },
    ],
  },
  {
    id: 'alyona',
    name: 'Alyona Zharkova',
    role: 'Young mother, on leave from the bank',
    show: [...known('alyona')],
    variants: [
      { when: [flag('heart.alyona_waived')], text: 'Alyona is back at teller window four. When someone comes in pawning a wedding ring she gives them the good pen and your address. Dima still calls you a terrible businessman. He means it as the highest praise.' },
      { when: [flag('alyona_home')], text: 'Dima’s shifts in the north are over; he drives a bus in Mostograd now and comes home every night, which Alyona says is almost too much. The ring hasn’t been off since.' },
      { when: [{ if: 'pledge', beat: 'alyona.ring', is: ['forfeited'] }], text: 'Alyona’s ring went to the safe. She bought a plain one from a jeweller on Sadovaya with the first month back at the bank. Dima says it’s the same ring. It isn’t, and they both know it.' },
      { when: [], text: 'Alyona is back at the bank, explaining interest to people who don’t want to hear it, with a photograph of a very round baby taped to the till.' },
    ],
  },
  {
    id: 'grisha',
    name: 'Grisha Zubov',
    role: 'Zhora’s brother, out after six years',
    show: [...known('grisha')],
    variants: [
      { when: [flag('grisha_depot')], text: 'Grisha runs the night shift at the tyre depot on Obvodny now, with a locker, a pension contribution and his name spelled wrong on his overalls. Your reference is framed in the depot office. He asked for it back.' },
      { when: [flag('grisha_drifted')], text: 'Grisha drives for a man now, short hours, cash, don’t ask. He nods when he passes the window. He doesn’t come in.' },
      { when: [], text: 'Grisha still washes cars on Kirpichny and goes to his circle on Tuesdays. He says it’s like confession, only nobody forgives you, which he prefers.' },
    ],
  },
  {
    id: 'vitya',
    name: 'Vitya Gruzdev',
    role: 'Lift mechanic, hockey dad',
    show: [...known('vitya')],
    variants: [
      { when: [flag('vitya_shirts'), flag('vitya_final')], text: 'Mostovik Under-12 still wear your shop’s name, front and back, two sizes bigger now. Lyova is in the city youth team, in goal. Vitya has the final on tape and has shown it to every lift in the district.' },
      { when: [flag('vitya_final')], text: 'Lyova saved forty-one in the final and Vitya hasn’t stopped talking about it. The lifts in his blocks have never worked better. Joy, he says, is good for the cables.' },
      { when: [], text: 'Vitya mends lifts in the canal blocks and drives to the rink at five every morning. He says the lifts can wait. The lifts disagree.' },
    ],
  },
  {
    id: 'prokhor',
    name: 'Prokhor Lukich Brashpilev',
    role: 'River pilot, retired',
    show: [...known('prokhor')],
    variants: [
      { when: [flag('heart.brashpilevs')], text: 'There are two folding stools on the Kupetsky embankment now, a metre apart. The Brashpilev brothers fish there on Thursdays and do not talk about the boat. The smelt don’t care which of them was right.' },
      { when: [flag('prokhor_alone')], text: 'Prokhor still says his brother’s name to his back every Thursday, a little louder each time. One of these Thursdays the tram will be late.' },
      { when: [], text: 'Prokhor sits on his stool on the embankment, catching smelt in spring and opinions all year, and steers every boat that passes from the shore.' },
    ],
  },
  {
    id: 'zakhar',
    name: 'Zakhar Svirelin',
    role: 'Chess on the Lion Bridge',
    show: [...known('zakhar')],
    variants: [
      { when: [flag('zakhar_secret'), flag('zakhar_played')], text: 'Zakhar still plays the tourists on the Lion Bridge, and still keeps the game you lost on a card in his breast pocket. Gleb’s book is on his bench, read soft. Neither brother has said a word about it.' },
      { when: [flag('zakhar_secret')], text: 'Somebody told Gleb that a stranger read his poems twice. Gleb has been insufferable since. Zakhar, on his bench, loses a game on purpose every time Gleb walks past, which is how Svirelins say they’re proud.' },
      { when: [], text: 'Zakhar plays blitz on the Lion Bridge for a hundred roubles a game and loses exactly often enough. He has never once lost on purpose to anyone he didn’t like.' },
    ],
  },
  {
    id: 'ernest',
    name: 'Ernest Ramonovich',
    role: 'Trumpet, the Fregat',
    show: [...known('ernest')],
    variants: [
      { when: [flag('ernest_weddings')], text: 'Ernest is the trumpet at half the weddings at Palace No. 2, booked by a registrar who says he’s “reliable, for a trumpeter”. He has a diary, a suit, and a brother who is very jealous of both.' },
      { when: [flag('ernest_wakes')], text: 'The Fregat is a sushi place now. Ernest plays wakes, mostly, and plays them beautifully. He says sad people tip better and never ask for “Lambada”.' },
      { when: [], text: 'Ernest plays the embankment cafés in the evenings and his brother’s ear on the phone in the mornings, and is, by his own account, the handsome one.' },
    ],
  },
  {
    id: 'styopa',
    name: 'Styopa Ryabov',
    role: 'Fedya’s brother',
    show: [...known('styopa')],
    variants: [
      { when: [flag('styopa_own_way')], text: 'Styopa finished his first year without pawning anything, on night shifts at the Krupa supermarket. He passed, just. He says the trick was doing it like Styopa. Fedya says the trick was Fedya.' },
      { when: [warm('styopa')], text: 'Styopa still sleeps on his brother’s floor and still comes in to ask things he could ask Fedya. You suspect Fedya sends him.' },
      { when: [], text: 'Styopa is in his second year at the Polytechnic, a year behind his brother in everything and catching up in nothing. He is perfectly happy about it.' },
    ],
  },
  {
    id: 'klava',
    name: 'Klava Bortnik',
    role: 'Driver, the No. 9 tram',
    show: [...known('klava')],
    variants: [
      { when: [flag('klava_saved')], text: 'The No. 9 still rings its bell at your window every eleven minutes, pending further study. Klava rings it twice when she passes, once for the shop and once for the petition. Valentin Egorovich still rides on Sundays, to criticise.' },
      { when: [flag('klava_shortened')], text: 'The No. 9 stops at the depot now and a bus does the rest. Klava drives the short route with her jaw set and rings the bell at the end of the line like she’s arguing with it.' },
      { when: [], text: 'Klava drives the No. 9 nine times a shift and knows every pothole by name. Her sister writes from the sea. Klava writes back from the rails.' },
    ],
  },
  {
    id: 'elvira',
    name: 'Elvira Venchikova',
    role: 'Teacher, School No. 41',
    show: [...known('elvira')],
    variants: [
      { when: [flag('elvira_postcard')], text: 'A postcard from Yasnaya Polyana hangs behind your counter, signed by thirty eighth-formers and a bearded Tolstoy in biro. Elvira Arkadyevna has never told the headmistress who the parents’ fund was.' },
      { when: [flag('elvira_earrings')], text: 'Elvira sold her good earrings for the class trip and doesn’t regret it. She says teachers shouldn’t wear anything a pupil could be distracted by. She is lying, and she knows you know.' },
      { when: [], text: 'Elvira still marks essays in the café on the corner and still pays for things the school won’t. Inessa marries people; Elvira marks their children. Between them they have the city covered.' },
    ],
  },
  {
    id: 'zhanna',
    name: 'Zhanna Kuzovkina',
    role: 'Postwoman, the canal blocks',
    show: [...known('zhanna')],
    variants: [
      { when: [flag('zhanna_free')], text: 'Zhanna lives in one room on Lesnaya with a kettle and a view of the tram turning circle. She’s never slept better. Vova still sends flowers. The neighbour’s mother’s grave has never looked so good.' },
      { when: [flag('zhanna_room')], text: 'The 1999 chain paid for a room of her own. Zhanna doesn’t wear any jewellery now. She says her neck has never felt so light.' },
      { when: [], text: 'Zhanna carries the post round sixty stairwells and is still, technically, leaving Vova. Rimma has opened a book on when.' },
    ],
  },
  {
    id: 'nonna',
    name: 'Nonna Karavaeva',
    role: 'Night nurse, cardiology',
    show: [...known('nonna')],
    variants: [
      { when: [flag('nonna_held_for_son')], text: 'Grigory Mironovich’s son came to the shop in the end and stood at the glass where his father had stood at Nonna’s, and paid full price for the watch. He wears it. He winds it every night at ten.' },
      { when: [flag('nonna_watch_bought')], text: 'The cardiology night ward has the best kettle in City Hospital No. 3. Nobody on the ward knows why. Nonna does, and drinks her tea looking at the clock.' },
      { when: [], text: 'Nonna still works the night ward, twelve hours on, two days off, and still can’t refuse what the old ones press into her hands. Lyusya sends her home with bread.' },
    ],
  },
  {
    id: 'zoya',
    name: 'Zoya Chernykh',
    role: 'Tattooist at Igla',
    show: [...known('zoya')],
    variants: [
      { when: [flag('zoya_sheep')], text: 'Somewhere in Mostograd a man who once broke a shop’s lock carries a dragon on his ribs that is unmistakably a sheep. Zoya considers it the finest work of her career.' },
      { when: [flag('zoya_anchor')], text: 'Yana Chernykh has a tiny anchor inside her wrist, for their father. She says it’s nothing. Zoya says it’s the best line she ever did. Both of them are right.' },
      { when: [], text: 'Zoya still tattoos anchors and roses at Igla, in a basement on Sennaya, with a cat called Sterile asleep on the autoclave.' },
    ],
  },
  {
    id: 'larisa',
    name: 'Larisa Kovrigina',
    role: 'Alisa’s twin, accounting',
    show: [...known('larisa')],
    variants: [
      { when: [flag('larisa_manager')], text: 'Larisa manages her sister now, with a forty-page plan and a spreadsheet of venues. Alisa plays; Larisa counts the door. Neither of them has pawned anything in a year, which Larisa has, of course, written down.' },
      { when: [warm('larisa')], text: 'Larisa’s course paper on informal credit got a five. Your shop is footnote eleven: “numbers add up”. From her, that’s a love letter.' },
      { when: [], text: 'Larisa qualified, works for a tax office, and is a terror to everyone she audits. She still checks your interest arithmetic when she passes. It is still right.' },
    ],
  },
]
