/**
 * M6 "three seasons of news": seasonal, authored paper content so a long career doesn't keep
 * printing the same dozen stories. Merged into the morning paper's pools by src/data/news.ts:
 *
 *   SEASON_FLAVOUR  city life by season (the thaw and the flood lead-up, white nights, school
 *                   and the first frosts, New Year and the deep winter), dealt from a per-season
 *                   deck (src/game/economy/demand.ts) so a story doesn't come round for a while.
 *   SEASON_HINTS    market notes that agree with tuning.demand.seasons: every `up` tag has a season
 *                   factor above 1 in that season and every `down` tag one below (tests check).
 *   HOLIDAY_MORE    more stories for the holidays already in tuning (Victory Day, the start of
 *                   school, New Year…) and the news-only city days (City Day, Graduates’ Night,
 *                   Fleet Day, Teachers’ Day; empty boosts, so they hint at nothing).
 *
 * Same rules as the rest of the paper: no digits, fictional streets, people and firms, no real
 * politicians, violence off the page, and no real brands (Mangosteen, Galaxia, Tosaki, Kanon are
 * the game's own).
 */
import type { Season } from '../game/state'
import type { NewsTemplate } from './news'

const only = (season: Season, items: Omit<NewsTemplate, 'seasons'>[]): NewsTemplate[] => items.map((t) => ({ ...t, seasons: [season] }))

export const SEASON_FLAVOUR: readonly NewsTemplate[] = [
  // --- spring: the thaw, the ice going out, the water coming up -----------------------------
  ...only('spring', [
    { id: 'sp_icicles', headline: 'Icicle season: caretakers rope off the pavements', body: 'Red-and-white tape has appeared under every gutter on Kanatnaya Street. Pedestrians are walking in the road, where the cars are. The cars have been asked to walk on the pavement.' },
    { id: 'sp_ice_out', headline: 'The ice goes out on the Mostova', body: 'Grey plates the size of tram cars are sliding down the river under the bridges, groaning like an orchestra tuning up. Crowds gather on the embankment to watch. Every spring somebody tries to ride one. Every spring he is fished out by the same sergeant.' },
    { id: 'sp_subbotnik', headline: 'Courtyard clean-up day draws a crowd, and a rake shortage', body: 'Residents of the Kanatnaya yards turned out on Saturday to rake last year’s leaves out from under this year’s snow. There were eleven volunteers and three rakes. The others supervised.' },
    { id: 'sp_dacha', headline: 'Dacha season opens; the suburban trains fill with seedlings', body: 'Pensioners with tomato plants on their laps have taken over the morning trains to the lakes. Commuters have been asked to stand. Most of them stand next to a cucumber.' },
    { id: 'sp_ice_cream', headline: 'First ice-cream kiosk of the year opens in the sleet', body: 'The kiosk on the Lion Bridge opened on Monday, in a wet snowfall, to a queue of four. The vendor says the first customers of spring are the bravest people in the city.' },
    { id: 'sp_potholes', headline: 'The thaw reveals the potholes the snow was hiding', body: 'Drivers on Mostovaya Prospect report the winter’s crop of potholes is the best in years. One, outside the House of Culture, has been named and has its own patch of reeds.' },
    { id: 'sp_starlings', headline: 'Schoolchildren hang starling boxes on the embankment', body: 'Forty birdhouses went up along Lodochnaya Embankment this week. The starlings have taken eleven. A crow has taken one, for reasons it will not explain.' },
    { id: 'sp_willow', headline: 'Pussy willow sellers back on the metro steps', body: 'Grandmothers with bunches of soft grey catkins are back outside every station. A bunch costs very little, lasts a week, and is said to bring luck to anyone who has not already used theirs up this winter.' },
    { id: 'sp_canal_level', headline: 'Canal running high and fast with snowmelt', body: 'The water in the canals is brown, quick and nearer the railings than usual. The district says this is normal for the season. The ducks are keeping to the edges, which is not.' },
    { id: 'sp_boats', headline: 'Tour boats back on the canals after the winter', body: 'The first boats of the season set off from the Lion Bridge pier with a handful of passengers in hats and blankets. The guides have dusted off their jokes, which have not improved over the winter.' },
    { id: 'sp_mud', headline: 'The courtyards turn to mud; the city’s boots turn brown', body: 'Shoe-shine stands report their best week since autumn. A shoe repairer on the Fourth Line says spring is the season when people discover which of their boots actually keep the water out.' },
    { id: 'sp_balconies', headline: 'Balconies emerge from the winter, full of things', body: 'As the snow slides off, the canal district’s balconies reveal their winter storage: skis, jars, a bicycle, one Christmas tree still decorated. Neighbours are comparing.' },
    { id: 'sp_heating_off', headline: 'Radiators go cold all over the district', body: 'The heating has been switched off for the season, as it is every year, on the coldest day of the month. Residents have dug out the blankets they had just put away.' },
    { id: 'sp_hydro', headline: 'Hydrological bureau publishes its spring water chart', body: 'The bureau’s chart of the river’s spring levels is pinned up at every tram stop. Nobody can read it. Pensioners hold it up to the light anyway and say, darkly, that they remember worse.' },
  ]),
  // --- summer: white nights, tourists, dachas, the city half empty ------------------------
  ...only('summer', [
    { id: 'su_fountains', headline: 'Fountains switched on; children switched off', body: 'The fountain in the square by the House of Culture is running again, and so is every child in the district, through it, fully dressed. Parents are sitting on the benches pretending not to know them.' },
    { id: 'su_poplar', headline: 'Poplar fluff fills the air like warm snow', body: 'The poplars along the canal are shedding their fluff, which drifts into windows, soup and conversation. Allergy sufferers are staying in. Cats are hunting it with great seriousness and no success.' },
    { id: 'su_empty', headline: 'Half the city has gone to the dacha', body: 'The trams run empty at weekends and the courtyards are quiet except for the people who could not leave and the cats who would not. Shopkeepers say the summer is a long Sunday.' },
    { id: 'su_bridges_night', headline: 'Night crowds watch the bridges go up', body: 'Hundreds gather on the embankment after midnight to watch the drawbridges rise in the not-quite-dark. Taxi drivers on the wrong bank are doing excellent business and recommend staying where you are.' },
    { id: 'su_heatwave', headline: 'A heatwave, by local standards', body: 'Thermometers on Kanatnaya Street touched the kind of number that sends the whole city to the beach by the fortress walls. The beach is mostly stones. Nobody minds. It is warm stones.' },
    { id: 'su_hot_water', headline: 'Hot water off for the summer pipe works', body: 'The district has turned off the hot water for its annual three weeks of pipe repairs. Residents are boiling kettles and saying unkind things about the pipes. The pipes look the same as last year.' },
    { id: 'su_kvass', headline: 'Kvass barrels back on the street corners', body: 'The yellow barrels have returned to the corners of the canal district, with a lady and a ladle in each. Small mugs, large mugs. The queues are long, polite and slightly sticky.' },
    { id: 'su_mosquitoes', headline: 'Mosquitoes report record year', body: 'The canal has produced its finest mosquitoes in living memory, according to everyone who sleeps with the window open. Everyone sleeps with the window open. It is the white nights.' },
    { id: 'su_painters', headline: 'Painters set up easels on every bridge', body: 'Art students have colonised the canal bridges with easels, all painting the same view slightly differently. Tourists photograph the painters. The painters are thinking about charging.' },
    { id: 'su_strawberries', headline: 'Strawberries arrive from the south; prices fall daily', body: 'Market stalls on the Zatonny square are red with strawberries. By the end of the week the sellers are practically giving them away, and so are the people who bought too many.' },
    { id: 'su_regatta', headline: 'Rowing regatta on the canal draws a crowd and a duck', body: 'Eight crews raced from the Lion Bridge to the Kupetsky on Saturday. The winner was the Krasny Vympel club, by a length. A duck that joined halfway was disqualified for not having a cox.' },
    { id: 'su_roadworks', headline: 'Summer roadworks: Mostovaya Prospect dug up again', body: 'The prospect was resurfaced last summer and is being dug up this summer to lay the cable that should have gone under it last summer. The workers say next summer will be quieter.' },
    { id: 'su_thunder', headline: 'Thunderstorm empties the embankment in a minute', body: 'A sudden storm on Thursday evening sent a thousand people under the arches of the Lion Bridge at once. Strangers shared umbrellas, cigarettes and opinions. Several are, we hear, now engaged.' },
  ]),
  // --- autumn: school, rain, the heating, mushrooms ---------------------------------------
  ...only('autumn', [
    { id: 'au_bells', headline: 'First bells ring at every school in the district', body: 'Children in new uniforms and old shoes carried bunches of gladioli taller than themselves to the school gates. The first-year pupils looked terrified. The parents looked worse.' },
    { id: 'au_heating_on', headline: 'Heating comes on; radiators clank into life', body: 'The district switched the heating back on this week, a fortnight after everyone started wearing coats indoors. The radiators greeted the hot water with a noise one resident described as a brass band falling down stairs.' },
    { id: 'au_students', headline: 'Students return; rents on the canal rise', body: 'The university term has begun, and with it the annual hunt for a room near the canal. One advertisement on the Fourth Line offers “a cosy space, previously a cupboard”. It has had eleven enquiries.' },
    { id: 'au_potatoes', headline: 'Potato harvest: the dacha trains come back full', body: 'Pensioners returning from the country are carrying sacks of potatoes up the stairs of the canal district. Neighbours with lifts have become very popular. Neighbours without lifts have become very strong.' },
    { id: 'au_geese', headline: 'Geese fly south over the canal; residents look up', body: 'A long wavering line of geese crossed the city on Tuesday, heading south, honking. Several people on the Lion Bridge stopped and watched them out of sight, then went back to work slightly sadder.' },
    { id: 'au_umbrellas', headline: 'Umbrella sellers outnumber the umbrellas', body: 'Every metro entrance now has a man selling umbrellas, and every umbrella lasts until the next gust off the gulf. The man is there again tomorrow. So is the gust.' },
    { id: 'au_marathon', headline: 'Autumn marathon closes the embankment', body: 'Runners in shorts and determination raced along the canal on Sunday in a steady drizzle. The winner said the weather was perfect. The spectators, in coats, said nothing.' },
    { id: 'au_apples', headline: 'Apples from the dachas, by the bucket', body: 'Everyone in the canal district has a relative with too many apples. The buckets are being left on landings, at the doors of the House of Culture and, in one case, on the bonnet of a police car.' },
    { id: 'au_dark', headline: 'The evenings draw in; lamps come on before supper', body: 'It is dark by the time the shops close now, and the canal shows the lamps twice, once in the air and once in the water. Photographers say this is the best light of the year. Everyone else says it is the start of the long dark.' },
    { id: 'au_choir', headline: 'House of Culture choir starts its new season', body: 'Rehearsals have begun for the winter concert. The choir is short of tenors again and asks any man who can hold a note, or knows a man who can, to come on Thursday. Biscuits provided.' },
    { id: 'au_floods_drill', headline: 'Gulf winds push the water up; the district checks its drains', body: 'Autumn storms off the gulf nudged the canals up a little on Wednesday night. The water stayed where it was told this time. Caretakers have been asked to clear the drains anyway, and some of them have.' },
    { id: 'au_first_frost', headline: 'First frost silvers the courtyards', body: 'The puddles on Kanatnaya Street were crusted with ice on Monday morning. Children broke every one of them on the way to school. The puddles will be back tomorrow. So will the children.' },
    { id: 'au_tram_wipers', headline: 'Night tram fitted with new wipers, the first in years', body: 'The driver of the No. Nine night tram says he can now see the road in the rain. Passengers say they preferred not knowing.' },
  ]),
  // --- winter: frost, New Year, ice on the canal -----------------------------------------
  ...only('winter', [
    { id: 'wi_frost', headline: 'Hard frost: the canal freezes from bank to bank', body: 'The canal froze overnight into a grey road with a path already beaten across it by people who were told not to. The district has put up signs. The signs are on the ice.' },
    { id: 'wi_snowclear', headline: 'Snow-clearers work through the night; parked cars buried', body: 'The district’s little orange tractors have been out all night pushing snow off the roads and onto the cars parked beside them. Owners are digging with saucepans and saying words.' },
    { id: 'wi_tangerines', headline: 'Tangerines arrive; the whole city smells of them', body: 'Crates of tangerines from the south have reached every market in the canal district. It is officially winter when the trams smell of peel. It is officially New Year when the trams smell of peel and pine.' },
    { id: 'wi_skating', headline: 'Skating rink flooded in the courtyard on the Fourth Line', body: 'Residents ran a hose from a ground-floor kitchen across the courtyard for three nights. The result is lumpy, enthusiastic and full of children by eight in the morning.' },
    { id: 'wi_fishermen', headline: 'Ice fishermen take up their posts on the canal', body: 'Men on folding stools have appeared at holes in the ice along the canal, each with a rod, a thermos and a firm view about the other men. Nobody has seen a fish. Nobody is leaving.' },
    { id: 'wi_dark', headline: 'Shortest days: the sun pays a short visit', body: 'The sun rose at an hour nobody could see it and set at lunchtime. Office workers report going to work in the dark and coming home in the dark, and having a vague memory of something bright in between.' },
    { id: 'wi_old_new_year', headline: 'Old New Year: the city celebrates again, just in case', body: 'The canal district marked the old-calendar New Year with a second round of salads, a second round of toasts and a second set of fireworks from the same courtyard. The courtyard is tired.' },
    { id: 'wi_ice_hole', headline: 'Winter swimmers take the plunge at the Lion Bridge', body: 'A dozen hardy souls in towels and hats lowered themselves into a hole in the ice on Sunday morning, to cheers. Their club says it is good for the heart. Spectators, in three coats each, took their word for it.' },
    { id: 'wi_trees_out', headline: 'Fir trees on the pavements as the holidays end', body: 'The canal district is throwing out its New Year trees, which now lie in every courtyard shedding needles and tinsel. The caretakers are collecting them with the patience of men who do this every year.' },
    { id: 'wi_heating_high', headline: 'Radiators too hot; residents open windows in the frost', body: 'The district heating is working so well this winter that flats on Kanatnaya Street have their windows open to the snow. The steam from the windows has been mistaken for a fire twice.' },
    { id: 'wi_sledges', headline: 'Sledging hill on the old ramparts reopens', body: 'The slope behind the fortress walls is packed with children on sledges, tea trays and, in one case, a borrowed road sign. The sign has been returned. The child has not stopped grinning.' },
    { id: 'wi_salt', headline: 'Salt on the pavements eats the city’s boots', body: 'The district has spread so much salt that every boot in the canal district is wearing a white tidemark. Shoe repairers say it is their busiest winter in years and that the salt is a friend of the trade.' },
    { id: 'wi_carols', headline: 'Children go carolling in the courtyards', body: 'Groups of small children in fur hats are singing at doors on the Fourth Line for sweets. Their repertoire is short and loud. Their success rate, our correspondent reports, is excellent.' },
  ]),
]

/**
 * Seasonal market notes. Direction must agree with tuning.demand.seasons for every tag listed
 * (season factor > 1 for up, < 1 for down; tests/content.test.ts checks).
 */
export const SEASON_HINTS: Readonly<Record<Season, readonly NewsTemplate[]>> = {
  spring: [
    { id: 'sh_sp_medals', headline: 'Medal collectors stir as May approaches', body: 'Dealers at the Sunday flea market say interest in wartime awards climbs every spring, long before the parade. Families are asking about grandfathers; collectors are asking about families.', tags: ['militaria', 'soviet'], direction: 'up' },
    { id: 'sh_sp_cameras', headline: 'Spring light brings the photographers out', body: 'Camera clubs report new members as the days lengthen. Old film cameras are changing hands on the embankment benches, and the darkroom in the House of Culture basement has a waiting list.', tags: ['cameras'], direction: 'up' },
    { id: 'sh_sp_jewelry', headline: 'Wedding season bookings fill the registry office', body: 'The Palace of Weddings on Mostovaya is booked solid from April. Jewellers say engagement rings and earrings for mothers-in-law are moving briskly.', tags: ['jewelry'], direction: 'up' },
    { id: 'sh_sp_phones', headline: 'Phone stalls quiet between the holidays and summer', body: 'Electronics traders at the ring-road market describe the spring as the long middle: the gift money is spent and nobody needs a new phone for the beach yet.', tags: ['phones', 'electronics'], direction: 'down' },
    { id: 'sh_sp_watches', headline: 'Watch repairers: a slow spring', body: 'The New Year rush for watches is long over, a watchmaker on Kanatnaya Street says. In spring people wind what they have and look at their phones instead.', tags: ['watches'], direction: 'down' },
  ],
  summer: [
    { id: 'sh_su_cameras', headline: 'Tourists hunt for old cameras on the embankment', body: 'Visitors from all over want a Soviet camera to take home, preferably one that works. Stalls by the Lion Bridge are charging summer prices and getting them.', tags: ['cameras', 'soviet'], direction: 'up' },
    { id: 'sh_su_souvenirs', headline: 'Souvenir hunters snap up badges and medals', body: 'The white nights bring tourists who will buy anything with a star on it. Militaria dealers report an excellent season and are polishing everything that will take a shine.', tags: ['soviet', 'militaria'], direction: 'up' },
    { id: 'sh_su_laptops', headline: 'Students sell laptops for the summer', body: 'Notices offering “barely used” laptops cover the university boards. Term is over, money is short and the dacha has no internet. Buyers are in no hurry.', tags: ['laptops'], direction: 'down' },
    { id: 'sh_su_phones', headline: 'Electronics market drowses through the summer', body: 'Phone traders on the ring road say nobody buys a phone in July. They play cards behind their counters and wait for September.', tags: ['phones', 'electronics'], direction: 'down' },
    { id: 'sh_su_gold', headline: 'Summer weddings keep the gold counters busy', body: 'June and July are the busiest months for weddings on the canal, and the jewellers are busy too. Rings, chains and the occasional watch for a nervous groom.', tags: ['gold', 'luxury'], direction: 'up' },
  ],
  autumn: [
    { id: 'sh_au_laptops', headline: 'Every student needs a laptop by Monday', body: 'The new term has sent first-years and their parents to every second-hand dealer in the city. Anything with a keyboard and a battery that holds a charge is gone by lunch.', tags: ['laptops', 'electronics'], direction: 'up' },
    { id: 'sh_au_phones', headline: 'Back-to-school phones: the playground decides', body: 'Teachers report that the most important lesson of September is which phone everybody else has. Parents report the price. Second-hand stalls report the queue.', tags: ['phones'], direction: 'up' },
    { id: 'sh_au_jewelry', headline: 'Jewellers face a long autumn lull', body: 'The weddings are over and the New Year is far away. A jeweller on Kanatnaya Street says she spends October rearranging the window and wondering if anyone will ever buy earrings again.', tags: ['jewelry', 'luxury'], direction: 'down' },
    { id: 'sh_au_cameras', headline: 'Tourists gone; camera stalls pack up early', body: 'With the white nights over and the rain in, the camera sellers on the Lion Bridge have folded their tables. One says he will sell film cameras again in May, to people who want to take photos of the sun.', tags: ['cameras'], direction: 'down' },
    { id: 'sh_au_medals', headline: 'Militaria trade cools with the weather', body: 'The flea-market medal tables are thinner in autumn, a dealer says. The summer buyers have gone home and the serious collectors are waiting for the right piece, not any piece.', tags: ['militaria', 'soviet'], direction: 'down' },
  ],
  winter: [
    { id: 'sh_wi_watches', headline: 'Watches top the gift lists again', body: 'Shop assistants on Mostovaya Prospect report that a good wristwatch is the present people want to give this winter, and the one they hope to get.', tags: ['watches', 'luxury'], direction: 'up' },
    { id: 'sh_wi_jewelry', headline: 'Earrings and chains wrapped by the dozen', body: 'Jewellers in the canal district are working late. Gold is the safe present: it fits, it keeps, and nobody has to pretend to like it.', tags: ['jewelry', 'gold'], direction: 'up' },
    { id: 'sh_wi_coins', headline: 'Collectors give coins for the holidays', body: 'Numismatists say a silver rouble in a little box has become a favourite present for godchildren. The coin dealers at the metro have put up tinsel.', tags: ['coins'], direction: 'up' },
    { id: 'sh_wi_cameras', headline: 'Nobody photographs anything in the dark', body: 'Camera traders say the short days are the worst for business. The sun is up for a lunch hour, and nobody wants to take a picture of the snow under the street lamps except art students, who have no money.', tags: ['cameras'], direction: 'down' },
    { id: 'sh_wi_medals', headline: 'Flea market thins out in the frost', body: 'Only the hardiest militaria dealers still set up their tables on Sunday mornings. Buyers are fewer still. A dealer in a sheepskin coat says winter is for reading catalogues.', tags: ['militaria', 'soviet'], direction: 'down' },
  ],
}

/**
 * City flavour the paper leaves out while the Flood's stories run (src/game/city/flood.ts floodNews):
 * boats, ice cream and the dacha trains don't sit well beside the canal in the ground floors, and
 * the canal's own spring stories would say the same thing twice.
 */
export const DRY_DAYS_ONLY: ReadonlySet<string> = new Set([
  'sp_boats',
  'sp_ice_cream',
  'sp_dacha',
  'sp_canal_level',
  'sp_hydro',
  'sp_ice_out',
  'sp_balconies',
  'sp_starlings',
  'sp_potholes',
  'sp_mud',
  'wn_bridges',
])

/** More stories for holidays already in tuning.demand.holidays, and the news-only city days. */
export const HOLIDAY_MORE: Readonly<Record<string, readonly NewsTemplate[]>> = {
  womens_day: [
    { id: 'wd_mimosa', headline: 'Mimosa everywhere; the metro smells of spring', body: 'Yellow mimosa is sold from buckets at every station. Office workers carry sprigs home in their briefcases. The sprigs are shedding on every seat of the morning tram.' },
  ],
  defender_day: [
    { id: 'dd_office', headline: 'Office workers chip in for a present nobody will use', body: 'In offices across the district, women are collecting money for the men’s present. Last year it was a shaving kit. This year, says one organiser, it will be a better shaving kit.' },
  ],
  victory_day: [
    { id: 'vd_veterans', headline: 'Schoolchildren visit the veterans of the Fourth Line', body: 'Pupils from the school on Kanatnaya Street brought carnations and a cake to the last veterans living in the district. The veterans told stories. The cake did not survive the stories.' },
    { id: 'vd_lilac', headline: 'Lilac and ribbons on the embankment', body: 'The lilac on the canal came out just in time for the holiday, and the ribbons came out with it. Grandfathers’ photographs are being carried down Mostovaya Prospect in a long, quiet river of people.' },
    { id: 'vd_fireworks', headline: 'Fireworks over the river; the cats object', body: 'The holiday salute lit up the sky over the fortress at night, to the delight of a hundred thousand people and the fury of every cat on the canal.' },
  ],
  white_nights: [
    { id: 'wn_sleep', headline: 'Nobody in the city has slept since June', body: 'The sun sets at midnight and thinks about rising an hour later. Residents report blackout curtains, sleep masks and, in one case, a wardrobe slept in by choice.' },
    { id: 'wn_jazz', headline: 'Jazz on a barge under the bridges', body: 'A band played from a barge moored by the Kupetsky Bridge until the bridge went up, and then from under it. Nobody on the embankment went home. The bridgekeeper is said to have tapped his foot.' },
  ],
  school_start: [
    { id: 'ss_uniform', headline: 'Uniform shop on the Fourth Line runs out of small sizes', body: 'Parents queued round the corner for school trousers this week. The children have grown over the summer, as children do, every year, to the surprise of everyone.' },
    { id: 'ss_laptops', headline: 'University asks first-years to bring their own laptop', body: 'A note from the Polytechnic informs new students that a laptop is “recommended”. Parents have translated this correctly. Second-hand dealers have too.' },
    { id: 'ss_gladioli', headline: 'Gladioli sold out by dawn on the first of the month', body: 'Florists on Kanatnaya Street opened at six to a queue of parents. Every child in the district will walk into school behind an enormous flower, as is the custom, and as is the custom, will hate it.' },
  ],
  new_year: [
    { id: 'ny_salad', headline: 'The great salad shortage: mayonnaise runs low', body: 'Shops in the canal district report the annual run on mayonnaise, peas and pickled cucumbers. One shopper bought eleven jars and said they were for a small family gathering.' },
    { id: 'ny_skating', headline: 'Skating rink opens under the lights in the square', body: 'The rink by the House of Culture opened with music, lights and a grandfather in a fur hat who skated backwards for an hour to show he still could. He could.' },
    { id: 'ny_frost_grandfather', headline: 'Father Frost booked solid for children’s parties', body: 'Every Father Frost in the district is booked through the holidays, including two who are not, strictly speaking, available. Several Snow Maidens are reported to be their daughters.' },
    { id: 'ny_fireworks', headline: 'Fireworks stalls appear on every corner', body: 'The district reminds residents that fireworks are not to be set off from balconies. Residents remind the district that the balcony is where they keep the fireworks.' },
  ],
  city_day: [
    { id: 'cd_parade', headline: 'City Day: Mostograd turns another year older', body: 'Brass bands on the embankment, a parade of tour boats on the canal and a cake the size of a tram in the square by the House of Culture. The cake was shared. The arguments about who got the rose went on into the evening.' },
    { id: 'cd_bridges', headline: 'City Day: every bridge lit up at once', body: 'For one night the bridges of Mostograd were strung with lights from bank to bank. The city came out to look at itself in the canals and liked what it saw, mostly.' },
    { id: 'cd_fair', headline: 'Craft fair fills Mostovaya Prospect for City Day', body: 'Wooden spoons, honey, knitted hats in June and a man selling small paintings of the canal to people standing next to the canal. Business was brisk.' },
  ],
  graduates: [
    { id: 'gr_night', headline: 'Graduates’ Night: school leavers walk the embankment till dawn', body: 'The city’s school leavers, in ball gowns and borrowed suits, walked the canals all night to watch the bridges go up. A ship with red sails sailed past at midnight. Their parents, at home, did not sleep either.' },
    { id: 'gr_shoes', headline: 'Lost on the embankment: one silver shoe, several hearts', body: 'Caretakers clearing up after Graduates’ Night found a silver shoe on the Lion Bridge, a tie in a fountain and a corsage on a statue of a poet. The poet looked pleased.' },
  ],
  fleet_day: [
    { id: 'fl_ships', headline: 'Fleet Day: warships moored in the river', body: 'Grey ships with flags from bow to stern have come up the Mostova for the holiday. Retired sailors in striped vests are on the embankment telling anyone who stands still which ship they served on, and why it was better then.' },
    { id: 'fl_vests', headline: 'Striped vests outnumber shirts on the embankment', body: 'Sailors past and present celebrated Fleet Day in the traditional way, loudly, in fountains. Police described the day as “cheerful, with some swimming”.' },
  ],
  teachers_day: [
    { id: 'td_flowers', headline: 'Teachers’ Day: chrysanthemums by the armful', body: 'Pupils across the district brought flowers and chocolates to their teachers this week. One teacher on the Fourth Line received eleven boxes of the same chocolates and is now very popular in the staff room.' },
    { id: 'td_retired', headline: 'Former pupils visit their old teacher, aged ninety-one', body: 'A class who left the school on Kanatnaya Street decades ago came back to sing to their mathematics teacher. She corrected their harmony and asked why none of them had written.' },
  ],
}
