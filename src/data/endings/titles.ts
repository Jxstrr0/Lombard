/**
 * Ending titles (M5, GDD § 12): the name, a one-line strap, and the epilogue paper's lead
 * story for each. Which one a career gets is src/game/endings/title.ts (bands in
 * tuning.endings.bands). `{shop}` is the shop's name. Fictional people and places; no
 * digits in the paper (like src/data/news.ts); violence off the page.
 */
import type { TitleId } from '../../game/endings/title'
import type { EndingTitle } from '../../game/schema/endings'

export const TITLES: Record<TitleId, EndingTitle> = {
  // --- retired ---------------------------------------------------------------
  honest: {
    name: 'The Honest Lombard',
    strap: 'Clean books, fair prices, modest money. You could look anyone on the canal in the eye.',
    headline: 'The pawnbroker who never cheated anyone retires',
    body: '{shop} closes its ledger for the last time. Not a fortune, its owner admits, but not one pensioner on the embankment can say they were cheated, and several tried. The till will be missed. So will the tea.',
  },
  neighbourhood: {
    name: 'The Neighbourhood’s Pawnbroker',
    strap: 'Warm, scrappy, never rich. Everyone on the canal knows your name and most of them owe you a favour.',
    headline: 'Half the canal turns out to see the pawnbroker off',
    body: 'The last day at {shop} was mostly people who came to say goodbye and ended up staying for tea. Pirozhki were brought. A student played the accordion badly. The pawnbroker has promised to keep coming to the bakery, and the bakery has promised to keep the burnt ones aside.',
  },
  pillar: {
    name: 'Pillar of the Embankment',
    strap: 'Rich, clean and loved. The district will name a bench after you and argue about which one.',
    headline: 'A pawnbroker the whole district respects, and likes',
    body: 'The owner of {shop} retires comfortable, honest and, rarest of all on the canal, popular. The district council has proposed a bench by the bridge in the pawnbroker’s name. Three neighbours have already asked to sit on it first.',
  },
  banker: {
    name: 'Banker of the Canal',
    strap: 'Clean and rich. Respected on every bridge. Loved on none of them.',
    headline: 'Canal-side pawn shop sold at a handsome profit',
    body: 'The owner of {shop} retires with clean books and a full account. Neighbours describe the pawnbroker as fair, correct and impossible to talk down by a single kopeck. Nobody we asked could remember a joke. Everybody could remember the interest rate.',
  },
  soldOut: {
    name: 'Sold Out',
    strap: 'Rich, cold, alone. The money stayed. Nobody else did.',
    headline: 'Pawn shop owner retires; neighbours unavailable for comment',
    body: '{shop} has closed with its owner a wealthy person. We asked the street for a few words. A baker said nothing and kept kneading. A pensioner said several words we cannot print. The pawnbroker is said to be moving somewhere quieter, which will be hard, because the canal had already gone quiet.',
  },
  hardBargain: {
    name: 'A Hard Bargain',
    strap: 'You squeezed every seller and it never added up to much. The street remembers every kopeck.',
    headline: 'Pawnbroker known for hard prices calls it a day',
    body: '{shop} shuts its doors. The owner drove a hard bargain for every earring and every coin on the canal, and has surprisingly little to show for it. A pensioner from Kanatnaya Street asked us to print that she is not sorry. She is not sorry.',
  },
  scrapedBy: {
    name: 'Scraped By',
    strap: 'You kept the lights on, mostly. It was never easy, and it was never quite enough.',
    headline: 'Small pawn shop closes after a long, thin run',
    body: '{shop} has stopped trading. Its owner kept the doors open through damp springs and lean months, and leaves with about what was brought in, plus a bad back and a great many stories. The neighbours say it was nice to have the lights on.',
  },
  pawnbroker: {
    name: 'Another Shop on the Canal',
    strap: 'Not a saint, not a crook, not a fortune. A pawnbroker, which is harder than it looks.',
    headline: 'Pawn shop on the canal changes hands',
    body: '{shop} has a new owner coming. The old one leaves without a scandal or a fortune, which on this canal counts as a quiet success. Asked for advice to the next owner, the pawnbroker said: check the weight, then check it again.',
  },
  front: {
    name: 'A Front',
    strap: 'The crew owns the shop in all but name. The name was the last thing that was yours.',
    headline: 'Pawn shop to carry on under the same sign',
    body: '{shop} will keep trading, a polite gentleman in a good coat told us, under the same sign and with the same opening hours. The owner has retired to a flat nobody has seen. The gentleman would not give his name. He did ask for ours.',
  },
  fence: {
    name: 'Fence of Mostograd',
    strap: 'Dirty, rich and untouchable, for now. Every stolen watch in the district knew your address.',
    headline: 'Questions remain as wealthy pawnbroker retires',
    body: 'The owner of {shop} retires a rich person, and the district has questions about how. So, we understand, does a certain detective. No charges have been brought. Several bicycles reported missing in the spring have still not been found, and neither, now, has the pawnbroker.',
  },
  gotOutClean: {
    name: 'Got Out Clean',
    strap: 'Dirty money, then you went straight before it caught up with you. Nobody can prove a thing.',
    headline: 'Pawnbroker retires with a clean record and a quiet smile',
    body: '{shop} closes with its owner well off and its books, lately, spotless. Some on the canal remember a different shop in the early days, with a back room and visitors after dark. Nobody remembers it in writing. The pawnbroker is taking up fishing.',
  },
  smallFry: {
    name: 'Small Fry',
    strap: 'You bent the rules and had nothing to show for it. Even the crooks didn’t take you seriously.',
    headline: 'Pawn shop closes; police shrug',
    body: '{shop} has closed. Its owner tried the back-room trade and found it paid no better than the front, only with worse company. A detective we asked about the shop had to be reminded where it was.',
  },
  // --- evicted ---------------------------------------------------------------
  evictedKind: {
    name: 'Too Kind for the Rent',
    strap: 'Evicted. You paid people what their things were worth and couldn’t pay the landlord what the shop was.',
    headline: 'Neighbours pass the hat as kind pawnbroker loses the lease',
    body: 'The landlord changed the locks at {shop} last night over unpaid rent. By morning the neighbours had collected a hat of money, two jars of jam and a petition. It was not enough for the arrears. It was, the pawnbroker said, quite a lot of jam.',
  },
  evicted: {
    name: 'The Keys Go Back',
    strap: 'Evicted. Two rent nights under water, and the landlord kept his word.',
    headline: 'Landlord changes the locks at canal pawn shop',
    body: 'After two months of unpaid rent, the landlord of {shop} arrived with a locksmith and a folder. The stock was counted, the cases emptied and the sign taken down by noon. The landlord says the lease is available to a responsible tenant. He has a list of what that means.',
  },
  // --- raided ----------------------------------------------------------------
  raidedClean: {
    name: 'Raided, Never Charged',
    strap: 'The police turned the shop over and found nothing worth a charge. The shop never really recovered.',
    headline: 'Police raid on pawn shop ends with no charges',
    body: 'Officers searched {shop} from the safe to the ceiling tiles and left with two boxes and an apology that was not in writing. No charges were brought. The customers, however, have learned another route home, and the owner has decided not to reopen.',
  },
  raidedRich: {
    name: 'Untouchable Until Tuesday',
    strap: 'Rich and dirty and sure nobody could touch you. On Tuesday, somebody did.',
    headline: 'Police seize goods and ledgers at canal pawn shop',
    body: 'Detectives carried boxes out of {shop} all morning: watches, gold, three bicycles and a ledger that matched none of them. The owner, described by neighbours as comfortable until recently, is helping police with their enquiries. The shop is closed by order.',
  },
  raided: {
    name: 'Closed by Order',
    strap: 'Shut down after a police raid. The goods went into evidence bags and the shop went with them.',
    headline: 'Pawn shop closed after police raid',
    body: 'Police sealed {shop} yesterday after a search that turned up goods on the stolen list. The owner faces a fine and questions; the shop faces a padlock. A neighbour told us she always wondered about the back room. A second neighbour told us the first one wonders about everything.',
  },
  // --- pushed out ------------------------------------------------------------
  pushedOutStood: {
    name: 'Wouldn’t Pay, Couldn’t Stay',
    strap: 'You never paid the crew. In the end they made sure you couldn’t stay. Nobody was hurt; the shop was.',
    headline: 'Pawnbroker who refused the crew gives up the shop',
    body: 'After months of glued locks, cracked glass and visitors who bought nothing, the owner of {shop} has handed back the keys. The pawnbroker never paid the gentlemen who look after the street, and the street knows it. The bakery left a loaf on the step anyway.',
  },
  pushedOut: {
    name: 'Under New Management',
    strap: 'Pushed out by the crew. The sign stayed up. Your name came off it.',
    headline: 'Canal pawn shop under new management',
    body: '{shop} reopened this morning with the same sign, a new lock and an owner nobody had seen before, who says the previous owner retired suddenly and very happily. Customers report the prices are higher and the questions fewer.',
  },
}
