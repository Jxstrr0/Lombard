/**
 * The fence (M5, GDD § 8): a fictional person. Numbers live in tuning.fence, the
 * logic in src/game/crime/fence.ts, the authored beats (meeting, the notebook, the
 * standing offer) in src/data/stories/fence.ts.
 *
 * Veniamin "Venya" Mostovoy. Everyone calls him Mostovoy ("of the bridges") because
 * for nineteen years he has worked nights in the control cabin of the Kupetsky
 * drawbridge: up at twenty-five past one, down at ten to five, and in between,
 * things cross the river by boat that would rather not cross it by daylight. Forties,
 * close-cropped and balding, a grey argyle cardigan his mother knitted (she has knitted eleven).
 * Soft-spoken and exact, talks in timetables, never says "stolen": things are
 * "between owners" or "came over while the bridge was up". He bought from the
 * previous owner, Yuri Gusev, on Tuesdays. He writes down every no, in pencil, in a
 * school exercise book. He doesn't hold grudges; he holds notebooks.
 *
 * Counter look: male_adult_13 (balding, close-cropped, argyle zip cardigan), a walk-in look no
 * regular or specialist wears (the regular-only looks are all taken; marking more
 * looks `regular` would reshuffle every walk-in's derived look).
 *
 * Placeholders: {greet} his greeting for the tier, {item} the piece, {price} his
 * price, {times} how many times you've said no ("twice", "three times").
 */

export const FENCE = {
  id: 'fence',
  name: 'Venya Mostovoy',
  /** Shown under his name (as a specialist's role is). */
  role: 'Bridge keeper, Kupetsky Bridge',
  look: 'male_adult_13',
} as const

/** How he greets you: first contact after the meeting, warm, plain, or sore (you keep saying no). */
export type FenceTier = 'first' | 'warm' | 'again' | 'sore'

export const FENCE_LINES = {
  greet: {
    first: ['Venya. From the bridge. As promised.', 'Good morning. Venya. Tuesdays, remember? It’s not Tuesday. I’m flexible.'],
    warm: [
      'Morning. How’s the tea? You look tired. You should sleep in the afternoons, like me.',
      'My mother asks after you. I told her you’re the careful one.',
      'Quiet night on the river. Well. Mostly quiet.',
    ],
    again: [
      'Venya. Mostovoy. You remember.',
      'The bridge was up till ten to five. A busy night.',
      'I won’t keep you. Nobody likes a long hello.',
    ],
    sore: [
      'It’s me again. I keep coming back. It’s a character flaw.',
      'You’ve said no {times}. I’m here anyway. Call it optimism.',
      'Before you say it: I know. I have it written down.',
    ],
  } satisfies Record<FenceTier, string[]>,

  /** Bringing you something (the line on the counter). */
  pitch: [
    '{greet} This {item}. It came over the river while the bridge was up. {price}, and it was never anywhere before here.',
    '{greet} The {item}. Between owners, you might say. {price}. The price includes not asking.',
    '{greet} I have this {item} that needs a quiet shelf. {price}. Don’t put it in the window for a month.',
  ],
  /** Added to the pitch when you've refused him a lot: his prices remember too. */
  pitchSore: ['It used to be cheaper. Prices have memories.', 'That’s the price for people who say no a lot.'],

  /** The claim on the item card. */
  story: ['Between owners.', 'It came over when the bridge was up.', 'A gentleman left it somewhere he shouldn’t have.'],

  /** Ringing to take a stolen piece off your shelf. */
  buyStolen: [
    '{greet} That {item} you have. Somebody’s sister is asking after it in the Sennaya market, very loudly. I’ll take it off your hands: {price}, tonight, and it was never yours.',
    '{greet} The {item}. It’s getting warm. I can feel it from here. {price}, and it crosses the river at twenty-five past one.',
  ],
  /** Ringing about a fake in your window. */
  buyFake: [
    '{greet} The {item} in your window. You know and I know. I know a man in Murmansk who doesn’t. {price}.',
    '{greet} That {item} on your shelf isn’t what it says, and it’s doing your name no good. {price}, and it goes north.',
  ],

  /** After you bought from him. */
  afterBought: [
    'Pleasure. Not in the window till the month’s out.',
    'Good. I’ll tell my mother you’re a sensible person.',
    'That’s that. You never saw me, I was never here, the bridge was up.',
  ],
  /** After you sold to him. */
  afterSold: [
    'It’ll be over the river by morning. Leave it by the back door; a blue van knocks twice.',
    'Done. Sleep well. Someone will collect it before you open.',
  ],
  /** After you said no (he counts). */
  afterRefused: [
    'No. That’s {times}. I’ll write it down.',
    'That’s all right. Into the notebook it goes. {times} now.',
    'Pencil. I always use pencil for you, in case you change your mind.',
  ],
  afterRefusedSore: [
    '{times}. My mother says I’m too patient.',
    'I’ll write it down. I’m running out of page for you.',
    'Fine. The notebook is getting thick, you know. It’s mostly you.',
  ],
  /** The piece he rang about was already gone. */
  gone: 'Gone already? Then it’s not my problem, or yours. Good.',
}

/** "once", "twice", "three times" … for {times}. */
export function timesWord(n: number): string {
  const words = ['no times', 'once', 'twice', 'three times', 'four times', 'five times', 'six times', 'seven times', 'eight times', 'nine times', 'ten times']
  return words[n] ?? `${n} times`
}
