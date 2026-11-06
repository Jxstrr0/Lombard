/**
 * Lines for the specialists' arc mechanics that aren't single beats (M4, GDD § 2b):
 * Gennady's first-refusal calls, the buyer Faina sends once a month, and what the
 * sellers say while a warning's "turns up more" runs. Fictional people and places.
 * Placeholders: {item} (the piece's short name), {price}, {name} (the specialist's first name).
 */

/** Gennady on the phone the evening you buy a piece he called sound (first refusal granted). */
export const FIRST_REFUSAL_LINES: readonly string[] = [
  'Gennady, on the phone: “That {item} you took in today. I’ll give you {price} for it, cash, tomorrow. Mid-range and fair. Yes or no?”',
  'Gennady, on the phone: “First refusal, as agreed. The {item}: {price}. I won’t haggle with you and you won’t haggle with me.”',
]

/** The buyer Faina sends round once a month (she said nothing, you said nothing). */
export const REFERRAL_LINES: readonly string[] = [
  '{name} Gelfand sent me. She says you have a {item} at {price} and that I’m not to argue. I’m going to argue a little.',
  'Faina from the arcade says to ask for the {item}. She says you’re honest. She said it like it was a flaw.',
]

/** What a seller says while a warning's boost runs (tuning.specialistArcs.boosts[…].story). */
export const BOOST_STORIES: Readonly<Record<string, readonly string[]>> = {
  /** Zhenya's warning: no box, no charger, the tray sticker scratched off, cash today. */
  lorry_phones: [
    'Brand new, look. No box. Box got wet. Cash today, yes?',
    'My cousin had a few of these. Don’t ask about the tray, it’s scratched, that’s all. Cash.',
    'Still has the film on the back. No charger, no box, no time. How much?',
  ],
}
