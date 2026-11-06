/**
 * M5 police content (GDD § 8): Detective Volkova, her lines at the counter, the
 * passport book's findings and the raid. Numbers live in tuning.police; the
 * stolen-goods bulletin's own lines are in src/data/news.ts (it's in the paper).
 *
 * Volkova is fictional. She borrows a walk-in look no regular, specialist or
 * reserved arc character wears (female_adult_07: auburn hair tied back, a brown
 * belted jacket, boots), like the specialists did. Her own arc (GDD § 9) comes
 * later and can sit on her state (crime.volkova) and the police.* story flags.
 *
 * Placeholders: {item} the piece (short name), {when} the day you took it in
 * ("on Tuesday"), {cash} an amount, {pieces} how many go, {street} somewhere in town.
 */

export const VOLKOVA = {
  /** WalkIn id (and the marker the reducer uses for her visits). */
  id: 'volkova',
  name: 'Detective Volkova',
  /** Shown under her name (falls back to the id when no walk-in archetype has it). */
  archetype: 'detective',
  look: 'female_adult_07',
  temperament: 'stubborn',
  knowledge: 0.8,
  desperation: 0,
} as const

export const volkovaLines = {
  /** Before anything else, the first time she walks in. */
  intro: [
    'Detective Volkova, Kanal district. Alla Sergeevna, if we get on.',
    'I do the pawn shops on this side of the water. All eleven of you. You’re the new one.',
  ],
  /** After her introduction, if you reported the glue in your lock (Protection, protection.told_police). */
  introReported: 'You’re the one who reported glue in a lock. Nobody reports glue. I read it twice. We should talk about who sells glue round here, one day.',
  /** She's back. */
  again: ['Detective Volkova again. Don’t get up.', 'Me again. I was passing. I’m always passing.', 'Morning. Put the kettle on if you like; I won’t be long, and I won’t drink it.'],
  /** Asking about a piece you still hold. */
  heldBulletin: ['A {item}. It was on our bulletin, and now, I’m told, it’s in your shop. You took it in {when}. Who from?'],
  held: [
    'A {item} came through your door {when}. The people it was taken from would like it back.',
    'I’m not here for you. Not yet. I’m here for a {item}, the one you took in {when}.',
  ],
  /** Asking about a piece that's gone from the shop. */
  gone: ['A {item} went through your books {when}. It isn’t on your shelf now, which is a pity for someone. Where did it go, and where did it come from?'],
  choices: {
    cooperate: 'Hand it over',
    cooperateGone: 'Tell her what you know',
    lie: 'Never seen it',
    bribe: 'Envelope: {cash}',
  },
  replies: {
    cooperate: 'Thank you. I’ll write you a receipt. It isn’t worth anything, but it’s nicely printed.',
    cooperateGone: 'That’s more than most give me. I’ll find it from here.',
    cooperatePassport: 'And a name and a passport number in your book. You’ve saved me a week of doorbells. I won’t forget it.',
    cooperateTape: 'And a face on your tape. You’ve saved me a week of doorbells. I won’t forget it.',
    lie: 'Of course. My mistake. I make so few; I like to keep one for special occasions.',
    caughtBulletin: 'It’s on the bulletin, it’s in your shop, and the description is in my notebook. I’ll take it. Let’s not do this again.',
    caughtTape: 'Your own camera disagrees with you. Take it up with the camera. I’ll take the {item}.',
    caughtPassport: 'Your own book disagrees with you. You keep a better ledger than you tell stories. I’ll take the {item}.',
    caught: 'I spoke to the seller this morning. Funny: he remembers your shop. I’ll take the {item}.',
    caughtGone: 'I spoke to the seller this morning. Funny: he remembers your shop. I’ll remember it too.',
    bribe: 'I seem to have dropped something. No, leave it. I’ll pick it up on my way out. Careful: not everyone at the precinct is as forgetful as me.',
    bribeFailed: 'Put that away before I have to write it down. Too late. I’ve written it down. And I’ll take the {item}.',
    bribeFailedGone: 'Put that away before I have to write it down. Too late. I’ve written it down.',
  },
  /** A visit with nothing on her list: she reads your passport book. */
  routine: {
    open: 'Nothing on my list for you today. Just your book, if you don’t mind.',
    good: 'Names, passports, dates. You’d make a good clerk. Keep it like this.',
    thin: 'Half your buys and no names next to them. A shop with no names is a shop that doesn’t want to know. I notice shops like that.',
    empty: 'Quiet shop. Quiet shops worry me less than busy ones.',
  },
  /** Back about a piece you said you'd never seen. */
  recheck: {
    caught: 'That {item} you’d never seen. I found the man who sold it. He remembers your shop fondly. I won’t pretend I’m surprised.',
    caughtTake: 'And I’ll take the {item} now, thank you.',
    clear: 'That {item} you’d never seen. The trail’s gone cold. Lucky for someone. I don’t like luck.',
  },
  /** The raid (a scene at opening). */
  raid: {
    open: 'Nobody move, please. This won’t take long, and it will feel longer.',
    search: 'Volkova stands in the door with a warrant and three officers. They go through the safe, the cases, the back room, the biscuit tin.',
    seized: '{pieces} out in evidence bags. The fine comes to {cash}.',
    seizedNone: 'They find nothing they can take. The fine for the state of your books comes to {cash}.',
    open_again: 'Open up when they’ve gone. People will talk; people always talk.',
    shut: 'Then Volkova sticks a paper seal across the door herself. “Closed until further notice. I did warn you, in my way.”',
  },
  /** Someone comes to redeem a pledge the police took (a raid or Volkova). */
  pledgeSeized: [
    'The police took my {item}? It was a pledge! You were meant to keep it safe. I’ll be telling people about this shop.',
    'Evidence? My {item}, evidence of what? No, don’t explain. I don’t want to hear it from you.',
  ],
  /** Ledger lines. */
  log: {
    seized: 'Volkova took the {item} as evidence',
    bribe: 'An envelope for Detective Volkova',
    raidSeized: 'Seized in the raid: {item}',
    fine: 'Fine after the police raid',
  },
}

/** The ledger's word on heat, one per tuning.police.heatBands band (never a number). */
export const heatWords = [
  'Nobody at the station knows the shop’s name.',
  'The shop’s name came up once at the station, in passing.',
  'Volkova has been asking around.',
  'Volkova asks about the shop by name now.',
  'People say the police are building a file on the shop.',
] as const

/** What a regular says bringing in a bulletin piece (by regular id; others use the item's own claims). */
export const bulletinCarriers: Readonly<Record<string, readonly string[]>> = {
  margarita: [
    'Another of my husband’s things. He collected… everything, really. Very quickly, towards the end.',
    'My late husband’s. He bought it, oh, last week? Last year. Time has no meaning when you’re grieving.',
  ],
}

/** Weekday names (0 = Monday), for "you took it in on Tuesday". */
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/** The passport book (an inspect step): what the seller does when you ask. */
export const passportLines = {
  calm: [
    'Passport noted: registered on {street}. Handed over without a second thought.',
    'Passport noted: an address on {street}, a photo that looks like them. No fuss at all.',
  ],
  nervous: [
    'Passport noted, eventually. It took a long search through every pocket, and the photo looks like somebody’s brother.',
    'Passport noted. The address is on {street}; they had to read it off the page to tell you.',
  ],
  refuse: [
    'No passport: “Left it at home. Who carries a passport to a shop?”',
    'Won’t show a passport: “What do you need that for? It’s a sale, not a wedding.”',
    'No passport: “Can’t you just write something? I’m in a hurry.”',
  ],
  /** Added for someone the police have flagged, by regular id. */
  flagged: {
    margarita: 'The surname inside is not Vdovina.',
  } as Readonly<Record<string, string>>,
  /** A second ask on the same visit. */
  again: 'You already asked. Asking again won’t change the answer.',
  /** Fictional streets and districts. */
  streets: ['Kanatnaya Street', 'Tkachey Lane', 'the Fourth Line', 'Bolshaya Mostovaya', 'Lodochny Lane', 'the Zarechny side', 'Pristan Street', 'Kirpichny Lane'],
}
