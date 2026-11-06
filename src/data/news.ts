/**
 * The morning paper: "Вечерний Мостоград / Evening Mostograd" (yes, it comes out in the
 * morning; nobody in the city finds this strange any more).
 *
 * Stories hint at demand without numbers (no digits anywhere: tests check). Everything is
 * fictional: streets, districts, people. No real politicians; violence stays off the page.
 * `{shop}` is replaced with the player's shop name.
 *
 * Picked by src/game/economy/demand.ts: holiday stories while a tuning.demand.holidays window
 * runs, a shock story when a tuning.demand.shocks entry fires, a hint when a tag's drift has
 * wandered far, and city flavour to fill the page.
 */
import type { Season } from '../game/state'
import { DRY_DAYS_ONLY, HOLIDAY_MORE, SEASON_FLAVOUR, SEASON_HINTS } from './newsSeasons'

/** M6: seasonal market notes, and the flavour kept out of the paper while the Flood is on (src/data/newsSeasons.ts). */
export { DRY_DAYS_ONLY, SEASON_HINTS }

export interface NewsTemplate {
  id: string
  headline: string
  body: string
  /** Only printed in these seasons (default: any). */
  seasons?: readonly Season[]
  /** M6: demand tags the story hints at, and which way (season hints, the flood); default none. */
  tags?: readonly string[]
  direction?: 'up' | 'down' | 'flat'
}

export const PAPER = {
  cyr: 'ВЕЧЕРНИЙ МОСТОГРАД',
  name: 'Evening Mostograd',
  motto: 'Every bridge has two banks',
  price: 'Price 15 kop.',
}

/** First morning of a career: the new owner makes the paper. */
export const FIRST_DAY: readonly NewsTemplate[] = [
  {
    id: 'first_day',
    headline: 'New owner for the pawn shop on the canal',
    body: '{shop} opens its doors again under new management. Neighbours have started a small bet on how long it lasts. The previous owner could not be reached for comment, or at all.',
  },
]

const BASE_HOLIDAY_NEWS: Readonly<Record<string, readonly NewsTemplate[]>> = {
  womens_day: [
    {
      id: 'wd_tulips',
      headline: 'Tulips sold out by noon on the embankment',
      body: 'The husbands of the canal district were seen queueing at the flower kiosks again, and then at the jewellers. One shop assistant described the mood as panic with a budget.',
    },
    {
      id: 'wd_forgot',
      headline: "Women's Day: what to give when you forgot",
      body: "Our columnist recommends gold: earrings, a thin chain, something that fits in a pocket. Our columnist's wife recommends planning ahead.",
    },
    {
      id: 'wd_jewellers',
      headline: 'Jewellers report brisk trade before the holiday',
      body: "Earrings and fine chains are this year's favourites. Nobody wants a cookbook, says a saleswoman on Kanatnaya Street, and she should know: she was given one.",
    },
  ],
  victory_day: [
    {
      id: 'vd_ribbons',
      headline: 'Ribbons on every lapel as Victory Day nears',
      body: "The veterans' council asks collectors to show respect at the flea market. Sellers say prices for wartime awards go up every May, and so do the questions about where they came from.",
    },
    {
      id: 'vd_rehearsal',
      headline: 'Parade rehearsal closes the bridges at dawn',
      body: 'Armoured vehicles rolled down Mostovaya Prospect before sunrise. A cat sitting on the tram line refused to move and was carried off, with dignity, by a sergeant.',
    },
    {
      id: 'vd_tins',
      headline: 'Grandchildren hunt for medals in old biscuit tins',
      body: 'School projects on family history have sent half the city into its wardrobes. Teachers ask that the medals come back to the wardrobes afterwards.',
    },
  ],
  school_start: [
    {
      id: 'ss_prices',
      headline: 'Schools prepare for September; parents complain about prices',
      body: 'A schoolbag now costs more than a fridge, one mother told us. The children, meanwhile, want only one thing, and it has a touch screen.',
    },
    {
      id: 'ss_fair',
      headline: 'Back-to-school fair opens on the ring road',
      body: 'Uniforms, pencil cases and phones described as nearly new. Second-hand electronics stalls report their busiest fortnight of the year.',
    },
  ],
  new_year: [
    {
      id: 'ny_trees',
      headline: 'Fir trees arrive at the markets; queues at the jewellers',
      body: 'The trees come from the north, the tinsel from somewhere else, and the money from the year-end bonus. Watches and gold top the gift lists again.',
    },
    {
      id: 'ny_bonus',
      headline: 'Shipyard pays the thirteenth salary',
      body: 'Workers at the Zatonny yard received their year-end bonus on Friday. By Saturday the gift shops on Kanatnaya Street had run out of boxes, ribbons and patience.',
    },
    {
      id: 'ny_phone',
      headline: 'What to give: a phone, says every teenager in the city',
      body: 'Parents report being shown the same advertisement many times a day. Some have started hiding the newspaper. Not this one, we hope.',
    },
  ],
  defender_day: [
    {
      id: 'dd_socks',
      headline: "Socks, razors or a wristwatch: the eternal Defender's Day question",
      body: 'Our survey of the embankment found that men say they want nothing, mean a wristwatch, and will get socks.',
    },
  ],
  white_nights: [
    {
      id: 'wn_tourists',
      headline: 'White nights: tourists photograph everything, including each other',
      body: 'Students have brought film cameras back into fashion and carry two each, for different moods. The sun, as usual, refuses to set.',
    },
    {
      id: 'wn_bridges',
      headline: 'Drawbridges strand couples on the wrong bank again',
      body: 'The bridges opened on schedule and several romances were tested. A taxi driver offered to row people across for the price of a taxi.',
    },
  ],
}

export const SHOCK_NEWS: Readonly<Record<string, readonly NewsTemplate[]>> = {
  ruble_wobble: [
    {
      id: 'sh_ruble',
      headline: 'Ruble wobbles again; queues at the exchange booths',
      body: 'Pensioners are buying gold for a rainy day, a jeweller on Zatonnaya Street told us. Economists say there is no need to panic, then go and stand in the queue.',
    },
    {
      id: 'sh_ruble_boards',
      headline: 'Exchange boards repainted twice before lunch',
      body: 'People are putting their savings into anything that shines: rings, coins, a good watch. A man on Lodochnaya Embankment bought a gold tooth he does not need.',
    },
  ],
  import_prices: [
    {
      id: 'sh_imports',
      headline: 'Imported phones climb in price at the electronics market',
      body: 'Sellers blame the exchange rate, the customs office and the weather, in that order. Buyers are looking at second-hand instead.',
    },
  ],
  phone_launch: [
    {
      id: 'sh_launch',
      headline: "New Mangosteen goes on sale; last year's model loses its shine",
      body: 'A queue formed overnight on Mostovaya Prospect. Owners of the old one are suddenly very keen to be rid of it, and nobody is very keen to buy.',
    },
  ],
  flea_market_raid: [
    {
      id: 'sh_raid',
      headline: 'Police check medal sellers at the Sunday flea market',
      body: 'Trade in state awards was discussed at length with several sellers. Militaria dealers are keeping their tables bare this week and their mouths shut.',
    },
  ],
  collectors_fair: [
    {
      id: 'sh_fair',
      headline: "Collectors' fair at the House of Culture",
      body: 'Coins, badges and old cameras change hands under the chandeliers. One man arrived with a suitcase of kopecks and left with two suitcases.',
    },
  ],
  film_fad: [
    {
      id: 'sh_film',
      headline: 'Students rediscover film; a darkroom opens in a basement',
      body: 'Soviet cameras, once given away with the sofa, are now sought after by young people with very particular haircuts.',
    },
  ],
}

/** Drift hints by tag. Tags without their own entry borrow one through HINT_ALIAS. */
export const HINT_NEWS: Readonly<Record<string, { up: readonly NewsTemplate[]; down: readonly NewsTemplate[] }>> = {
  gold: {
    up: [{ id: 'hint_gold_up', headline: 'Gold is the talk of the bus stops', body: 'Everyone has an aunt who says to buy it. This week, the aunts are winning.' }],
    down: [{ id: 'hint_gold_down', headline: 'Jewellers yawn behind their counters', body: 'Nobody is buying rings, says a jeweller on Kanatnaya Street. She is considering a second career in crosswords.' }],
  },
  watches: {
    up: [{ id: 'hint_watch_up', headline: 'Wristwatches back in fashion with office workers', body: 'A phone tells the time, a banker explained, but a watch tells people you have time.' }],
    down: [{ id: 'hint_watch_down', headline: 'Watch repairers report a quiet month', body: 'Everybody has a phone, one complains. Nobody winds anything any more.' }],
  },
  phones: {
    up: [{ id: 'hint_phone_up', headline: 'Second-hand phones fly off the market stalls', body: 'Nobody wants to pay full price for something that will be cracked by spring.' }],
    down: [{ id: 'hint_phone_down', headline: 'Electronics stalls cut prices, nobody notices', body: 'Traders at the ring-road market say the city is full of phones and short of buyers.' }],
  },
  laptops: {
    up: [{ id: 'hint_laptop_up', headline: 'Students hunt second-hand laptops', body: 'Notices on the university boards ask for anything with a keyboard that turns on. Price negotiable, the notices add, hopefully.' }],
    down: [{ id: 'hint_laptop_down', headline: 'Laptops pile up at the ring-road market', body: 'Traders say every student in the city is selling last year’s machine at once. Nobody is buying until September.' }],
  },
  cameras: {
    up: [{ id: 'hint_camera_up', headline: 'Old cameras wanted by the art school', body: 'Students are asking grandparents to check the top shelf of the wardrobe.' }],
    down: [{ id: 'hint_camera_down', headline: 'Photo club down to its last three members', body: 'They meet on Thursdays and photograph each other. Spare cameras, they say, are everywhere.' }],
  },
  militaria: {
    up: [{ id: 'hint_mil_up', headline: 'Militaria collectors circle the flea market', body: 'Men with magnifying glasses have been seen at dawn among the tables, asking quiet questions.' }],
    down: [{ id: 'hint_mil_down', headline: 'Collectors cautious after questions about awards', body: 'Nobody wants to be the one explaining where a medal came from, a dealer told us, and walked off.' }],
  },
  vinyl: {
    up: [{ id: 'hint_vinyl_up', headline: 'Record players back on the Sennaya stalls', body: 'Young men in thin scarves are buying their grandparents’ records back off the market, one Liraphon sleeve at a time.' }],
    down: [{ id: 'hint_vinyl_down', headline: 'Flea market drowns in old records', body: 'Every flat on the embankment is being cleared at once, a trader sighs, and every flat had the same forty records.' }],
  },
  games: {
    up: [{ id: 'hint_games_up', headline: 'Schoolboys queue for second-hand consoles', body: 'The ring-road market reports a run on game boxes. Parents report a run on excuses.' }],
    down: [{ id: 'hint_games_down', headline: 'Game consoles gather dust on the stalls', body: 'A new model is coming, the traders say, and nobody wants last year’s, not even for the children.' }],
  },
  books: {
    up: [{ id: 'hint_books_up', headline: 'Antiquarian booksellers report a lively month', body: 'Signed copies and good editions are changing hands, says the Liteyny book exchange. Its cat has been moved off the counter.' }],
    down: [{ id: 'hint_books_down', headline: 'Encyclopaedias left out by the bins', body: 'Thirty volumes in the rain on Zatonnaya Street. Nobody took them. The internet, a neighbour explained, has all the letters now.' }],
  },
  coins: {
    up: [{ id: 'hint_coin_up', headline: 'Coin collectors swap albums at the metro', body: 'Silver and gold coins are being traded hand to hand by people who all seem to know each other.' }],
    down: [{ id: 'hint_coin_down', headline: 'Coin dealers complain of a dull market', body: 'Collectors are sitting on their albums, says the numismatic society, and on their wallets.' }],
  },
}

export const HINT_ALIAS: Readonly<Record<string, string>> = {
  retro: 'vinyl',
  jewelry: 'gold',
  luxury: 'watches',
  electronics: 'phones',
  soviet: 'militaria',
  silver: 'coins',
}

/** City flavour, printed to fill the page. */
const BASE_FLAVOUR_NEWS: readonly NewsTemplate[] = [
  {
    id: 'fl_cat',
    headline: 'Cat elected to the district council',
    body: 'The ginger tom of the Zatonny courtyards won by a landslide. He slept through his first meeting. Residents call it an improvement.',
  },
  {
    id: 'fl_bridge',
    headline: 'Drawbridge stuck open all night',
    body: 'Commuters on the wrong bank waited until morning. A man selling tea from a thermos made, he says, the best money of his life.',
  },
  {
    id: 'fl_pothole',
    headline: 'Pothole on Kanatnaya Street declared a local landmark',
    body: 'Residents held a short ceremony. The pothole did not attend; it was full of water.',
  },
  {
    id: 'fl_dubai',
    headline: 'Local man insists his watch is from Dubai',
    body: 'Our correspondent has seen the watch. It is from Dubai in the sense that it has heard of Dubai.',
  },
  {
    id: 'fl_piano',
    headline: 'Mysterious piano appears on the embankment',
    body: 'Someone plays it at night. The district says the piano is not on its list of approved benches and must go.',
  },
  {
    id: 'fl_ledger',
    headline: 'Police remind shopkeepers to keep their ledgers',
    body: 'A detective from the canal precinct says she reads every ledger personally. Several shopkeepers have started writing more neatly.',
  },
  {
    id: 'fl_chess',
    headline: "Pensioners' chess club defends its bench",
    body: 'A skateboarder challenged the club for the bench by the fountain. He lost in eleven moves and now brings the tea.',
  },
  {
    id: 'fl_pigeon',
    headline: 'Pigeon steals a whole pie from a tourist',
    body: 'Witnesses on the Lion Bridge describe a clean operation. The pigeon remains at large.',
  },
  {
    id: 'fl_rain',
    headline: 'Rain expected. Then more rain.',
    body: 'The weather bureau apologises in advance and recommends a good umbrella, or a second one for when the first is stolen.',
  },
  {
    id: 'fl_choir',
    headline: 'Choir rehearses under umbrellas',
    body: 'The roof of the House of Culture is leaking again. The conductor says the acoustics have never been better.',
  },
  {
    id: 'fl_tram',
    headline: 'Night tram driver retires after forty years',
    body: 'He says he has seen everything on the night tram. He declined to say what everything was.',
  },
  {
    id: 'fl_snow',
    headline: 'Snow falls off the roofs; one bench and a parked car lost',
    body: 'Caretakers ask residents to walk in the middle of the street, where the cars are.',
    seasons: ['winter', 'spring'],
  },
  {
    id: 'fl_ice',
    headline: 'Canal ice cracks early; ducks unimpressed',
    body: 'Fishermen were advised to come off the ice. Most of them did.',
    seasons: ['winter', 'spring'],
  },
  {
    id: 'fl_heating',
    headline: 'Heating switched off; residents wear coats indoors',
    body: 'The district says spring has officially begun. The thermometer has not been informed.',
    seasons: ['spring'],
  },
  {
    id: 'fl_canal_smell',
    headline: 'The canal smells of summer again',
    body: 'Residents of Lodochnaya Embankment confirm it is summer, and ask that it be a short one.',
    seasons: ['summer'],
  },
  {
    id: 'fl_mushrooms',
    headline: 'Mushroom pickers return with mushrooms and stories',
    body: 'Both are larger than last year, they insist.',
    seasons: ['autumn'],
  },
  {
    id: 'fl_leaves',
    headline: 'Fallen leaves turn a courtyard into a lake',
    body: 'The drains on Lodochnaya Embankment are blocked again. Children have built a raft; their parents have built a complaint.',
    seasons: ['autumn'],
  },
]

/**
 * M5 police: the stolen-goods bulletin, a box at the foot of the paper (src/game/crime/bulletin.ts).
 * One line per piece: what it is, how worn, where and when it went. Some of these pieces turn up at
 * your counter a few days later; buying one brings Detective Volkova round. No digits in the
 * templates (the item's own name may have some).
 */
/** Holiday stories: the originals plus M6's (src/data/newsSeasons.ts HOLIDAY_MORE). */
export const HOLIDAY_NEWS: Readonly<Record<string, readonly NewsTemplate[]>> = Object.fromEntries(
  [...new Set([...Object.keys(BASE_HOLIDAY_NEWS), ...Object.keys(HOLIDAY_MORE)])].map((k) => [k, [...(BASE_HOLIDAY_NEWS[k] ?? []), ...(HOLIDAY_MORE[k] ?? [])]]),
)

/** City flavour: the originals plus M6's seasonal stories (src/data/newsSeasons.ts SEASON_FLAVOUR). */
export const FLAVOUR_NEWS: readonly NewsTemplate[] = [...BASE_FLAVOUR_NEWS, ...SEASON_FLAVOUR]

export const BULLETIN = {
  cyr: 'РОЗЫСК',
  title: 'Police bulletin',
  intro: 'The Kanal district police ask pawn shops and dealers to look out for:',
  /** {item}, {wear}, {place}, {when}. */
  line: '{item}, {wear}. Taken from {place} {when}.',
  /** By condition, best first: [at least, words]. */
  wear: [
    [90, 'as new'],
    [70, 'light wear'],
    [45, 'well worn'],
    [0, 'badly worn'],
  ] as readonly (readonly [number, string])[],
  places: [
    'a flat on Kanatnaya Street',
    'a dacha past the Ring',
    'a parked car by the Seventh Bridge',
    'a student hostel on Tkachey Lane',
    'a changing room at the Volna pool',
    'a stall at the Zatonny market',
    'a widow’s flat on the Fourth Line',
    'a hotel room on Bolshaya Mostovaya',
    'a repair kiosk in the Lodochny underpass',
    'a courtyard workshop off Kirpichny Lane',
  ] as readonly string[],
  /** {day} = a weekday. */
  when: ['on {day} night', 'on {day} afternoon', 'late on {day}', 'early on {day}'] as readonly string[],
}
