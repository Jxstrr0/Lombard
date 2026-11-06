/**
 * Specialists on retainer (GDD § 2b), validated at import time. Fictional
 * people. M2: jeweler, watchmaker. M4: militaria collector, antiques dealer,
 * electronics tech. Fees, call allowances, accuracy and honesty live in
 * tuning.specialists.roster[id]; their small arcs are src/data/stories/<first name>.ts
 * (GDD § 2b). `look` is the cast member who plays them at the counter (Gennady only
 * ever phones, so he has none). No regular wears it. The regular-only looks ran out
 * with the fifteen regulars (the last four are reserved for arc characters:
 * business_male_05 Edik, male_adult_06 Fedya, male_adult_20 Eduard, male_adult_11
 * Zhora), so every specialist borrows a walk-in look (marking more looks `regular`
 * would reshuffle every walk-in's derived look).
 *
 * Roster order matters: specialistFor() picks the first retained one covering
 * a category, so keep the categories disjoint.
 *
 * Lines never say a piece is fake outright: they give an opinion and a range.
 */
import { SpecialistDef } from '../game/schema/economy'

export const SPECIALISTS: readonly SpecialistDef[] = [
  {
    id: 'jeweler',
    look: 'business_female_02',
    name: 'Faina Gelfand',
    short: 'Faina',
    role: 'Jeweler, Sennaya arcade',
    categories: ['gold', 'coins', 'silver'],
    blurb: 'Forty years at the bench and quick as a knife. She always seems to know a buyer for the good pieces.',
    hello: '“Six calls a month. Don’t ring me after nine.”',
    lines: {
      sound: [
        'Faina turns it in the light: “Honest metal, honest work. {lo}–{hi}, I’d say.”',
        'Faina, without looking up: “It is what the stamp says it is. Somewhere around {lo}–{hi}.”',
      ],
      redone: [
        'Faina runs a nail along it: “Someone’s been at this. Repolished, reworked. {lo}–{hi} as it is.”',
      ],
      mixed: [
        'Faina frowns: “These parts didn’t start life together. {lo}–{hi}, and that’s generous.”',
      ],
      doubt: [
        'Faina sniffs: “I don’t like the colour and I don’t like the stamp. I’d be careful. {lo}–{hi} at best.”',
        'Faina sets it down fast: “Plating, if you ask me. I wouldn’t go past {lo}–{hi}.”',
      ],
      lowball: [
        'Faina shrugs: “Low karat, tired work. {lo}–{hi}. If it’s a bother, I could take it off your hands.”',
        'Faina, a little too quickly: “Nothing special. {lo}–{hi}. Send the owner my way if you don’t want it.”',
      ],
    },
  },
  {
    id: 'watchmaker',
    look: 'male_adult_03',
    name: 'Ilya Semyonovich Brodsky',
    short: 'Ilya',
    role: 'Watchmaker, Kanal Street',
    categories: ['watches'],
    blurb: 'Repaired half the watches on the embankment. Honest to a fault. His eyes are not what they were.',
    hello: '“Bring me the hard ones. And describe them slowly, please.”',
    lines: {
      sound: [
        'Ilya squints, then nods: “The movement is right for it. {lo}–{hi}, give or take.”',
        'Ilya holds it at arm’s length: “As far as these eyes can tell, all as it should be. {lo}–{hi}.”',
      ],
      redone: [
        'Ilya squints: “The dial’s been redone, I’d be careful. {lo}–{hi} as a refinished piece.”',
        'Ilya taps the crystal: “Somebody made this pretty again. Pretty is not original. {lo}–{hi}.”',
      ],
      mixed: [
        'Ilya sighs: “The case and the movement never met before last year. {lo}–{hi}.”',
      ],
      doubt: [
        'Ilya puts the loupe down slowly: “This is not what it says on the dial. Don’t pay for the name. {lo}–{hi}.”',
        'Ilya is quiet a long time: “Wrong weight in the hand, wrong tick in the ear. {lo}–{hi}, no more.”',
      ],
      lowball: [
        'Ilya mumbles: “Hard to say with my eyes. {lo}–{hi}? I could take it to my bench, if you like.”',
      ],
    },
  },
  {
    id: 'collector',
    name: 'Gennady Pavlovich Shurygin',
    short: 'Gennady',
    role: 'Militaria, Old Bridge flea market',
    categories: ['militaria'],
    blurb: 'Retired river-fleet bosun with a folding table under the Old Bridge. Straight as a ruler about medals, and he would like first refusal on the good ones.',
    hello: '“Five calls. And if a good one comes in, I hear about it first. Agreed?”',
    lines: {
      sound: [
        'Gennady goes quiet a moment: “That one was earned. {lo}–{hi}. If they sell, I’d like first refusal.”',
        'Gennady, approving: “Right strike, right wear, right weight. {lo}–{hi}. Treat it kindly.”',
      ],
      redone: [
        'Gennady clicks his tongue: “Somebody tidied it up. The number’s been touched, I think. {lo}–{hi} as it stands.”',
        'Gennady: “Old disc, new tricks. Fresh ribbon, fresh silvering. {lo}–{hi}, and say so on the tag.”',
      ],
      mixed: [
        'Gennady turns it over twice: “These parts were pinned on two different men. {lo}–{hi}.”',
      ],
      doubt: [
        'Gennady sets it down like it’s hot: “Nobody’s grandfather wore this. Souvenir-stall work. {lo}–{hi}.”',
        'Gennady, flatly: “Wrong metal, wrong hand. Don’t pay a soldier’s price for it. {lo}–{hi}, no more.”',
      ],
      lowball: [
        'Gennady clears his throat: “Common enough, these. {lo}–{hi}. I’d find room for it on my table, mind.”',
      ],
    },
  },
  {
    id: 'antiquary',
    look: 'business_male_07',
    name: 'Stanislav Edgarovich Lyubimov',
    short: 'Stanislav',
    role: 'Antiques dealer, Dvoryanskaya embankment',
    categories: ['icons', 'antiques', 'instruments'],
    blurb: 'Velvet waistcoat, good cologne, a shop full of other people’s grandmothers. Never wrong about a piece. His friends drive very clean cars.',
    hello: '“Four calls, my dear. Ring any time; I keep late hours. So do my friends.”',
    lines: {
      sound: [
        'Stanislav purrs: “Oh, that is a lovely, honest thing. {lo}–{hi}, and worth every kopeck.”',
        'Stanislav, after a pause: “Period, untouched, a pleasure to hold. {lo}–{hi}.”',
      ],
      redone: [
        'Stanislav tuts: “Someone has loved this a little too much. Retouched, regilded. {lo}–{hi}.”',
        'Stanislav: “The varnish is younger than you are, my dear. {lo}–{hi} as a restored piece.”',
      ],
      mixed: [
        'Stanislav laughs softly: “A marriage of convenience. The base from one, the top from another. {lo}–{hi}.”',
      ],
      doubt: [
        'Stanislav, gently: “It’s pretending, my dear. Very sweetly, but pretending. {lo}–{hi}.”',
        'Stanislav sets it aside: “Made last year to look like last century. {lo}–{hi}, not a kopeck more.”',
      ],
      lowball: [
        'Stanislav yawns: “Provincial work, nothing special. {lo}–{hi}. I could find it a home, as a favour to you.”',
        'Stanislav, airily: “Decorative, no more. {lo}–{hi}. Send it round to me and save yourself the bother.”',
      ],
    },
  },
  {
    id: 'technician',
    look: 'female_adult_04',
    name: 'Zhenya Kroshkina',
    short: 'Zhenya',
    role: 'Repair kiosk, Rechnaya underpass',
    categories: ['phones', 'cameras', 'electronics', 'tools', 'media'],
    blurb: 'Twenty-three, fixes phones in a kiosk the size of a wardrobe and answers on the first ring, mouth full. Cheap and fast. Sometimes a little too fast.',
    hello: '“Eight calls, yeah, fine. Just tell me the model, I’ll know.”',
    lines: {
      sound: [
        'Zhenya, chewing: “Yeah, that’s all original inside. {lo}–{hi}, done.”',
        'Zhenya, half-listening: “Sounds normal to me. {lo}–{hi}. Next?”',
      ],
      redone: [
        'Zhenya: “Screen’s been swapped, cheap one too. Works, though. {lo}–{hi}.”',
        'Zhenya snorts: “Refurb. Somebody opened it and closed it nicely. {lo}–{hi}.”',
      ],
      mixed: [
        'Zhenya: “That’s a parts-bin special. Two of them died to make one. {lo}–{hi}.”',
      ],
      doubt: [
        'Zhenya, instantly: “Nope. Wrong font on the menus, wrong weight in the hand. {lo}–{hi}, tops.”',
        'Zhenya laughs: “Logo’s right, nothing else is. Don’t pay for the name. {lo}–{hi}.”',
      ],
      lowball: [
        'Zhenya: “Last year’s model, nobody wants it. {lo}–{hi}. I’d take it for parts, honestly.”',
      ],
    },
    categoryLines: {
      tools: {
        sound: [
          'Zhenya: “My dad has the same one. Proper motor, proper gears. {lo}–{hi}.”',
          'Zhenya, over a drill whining somewhere: “Sounds like the proper one to me. {lo}–{hi}.”',
        ],
        redone: ['Zhenya: “Somebody rewound it or swapped the brushes. Runs, though. {lo}–{hi}.”'],
        mixed: ['Zhenya: “Body’s one thing, battery’s another. Made of two. {lo}–{hi}.”'],
        doubt: [
          'Zhenya laughs: “That’s a market copy. Badge is right, the plastic isn’t. {lo}–{hi}, tops.”',
          'Zhenya: “Nah. Wrong weight, wrong sticker. Don’t pay for the name. {lo}–{hi}.”',
        ],
        lowball: ['Zhenya: “Old model, builders don’t want those. {lo}–{hi}. My cousin might take it.”'],
      },
    },
  },
].map((raw) => SpecialistDef.parse(raw))

const byId = new Map(SPECIALISTS.map((s) => [s.id, s]))

export function getSpecialist(id: string): SpecialistDef | undefined {
  return byId.get(id)
}
