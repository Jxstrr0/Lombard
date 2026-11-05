/**
 * M2 specialists on retainer (GDD § 2b), validated at import time. Fictional
 * people. Fees, call allowances, accuracy and honesty live in
 * tuning.specialists.roster[id]; their small arcs arrive in M4.
 *
 * Lines never say a piece is fake outright: they give an opinion and a range.
 */
import { SpecialistDef } from '../game/schema/economy'

export const SPECIALISTS: readonly SpecialistDef[] = [
  {
    id: 'jeweler',
    name: 'Faina Gelfand',
    short: 'Faina',
    role: 'Jeweler, Sennaya arcade',
    categories: ['gold', 'coins'],
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
].map((raw) => SpecialistDef.parse(raw))

const byId = new Map(SPECIALISTS.map((s) => [s.id, s]))

export function getSpecialist(id: string): SpecialistDef | undefined {
  return byId.get(id)
}
