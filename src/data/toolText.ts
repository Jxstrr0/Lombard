/**
 * Finding text for the M2 tools: acid kit and reference book (specialist lines
 * live with each specialist in specialists.ts). Never says "fake": describes
 * what is seen.
 */

/** Precious metal of an item, guessed from its def (category, name, id, demandTags). */
export type Metal = 'gold' | 'silver' | 'base'

/**
 * Reactions for non-genuine pieces, matched in order against the fake profile id
 * (e.g. "plated_brass", "gilded_silver"). A fake profile that matches none of
 * these and is kind 'fake' gets `fakeFallback`; frankenstein/restored pieces
 * without a match are real metal and react like the genuine article.
 */
export const ACID_FAKE_REACTIONS: readonly { match: RegExp; text: string }[] = [
  { match: /brass|copper|bronze|tombac/, text: 'The scratch fizzes green under the acid.' },
  { match: /steel|iron|nickel/, text: 'The thin gold line lifts away under the acid; the scratch beneath stays grey.' },
  { match: /silver/, text: 'The top of the scratch dissolves and the line under it clouds milky white.' },
]
export const ACID_FAKE_FALLBACK = 'The scratch dissolves under the acid and leaves a dull streak behind.'

/** Genuine reactions per metal. {purity} = "583" etc., or a fallback word. */
export const ACID_GENUINE: Record<Metal, string> = {
  gold: 'The {purity} scratch holds under the acid. No colour change.',
  silver: 'The test drop turns the scratch a creamy red, the way {purity} silver does.',
  base: 'The acid bites straight into the scratch. No precious metal here, and a coin like this was never meant to have any.',
}
export const ACID_PURITY_FALLBACK: Record<Metal, string> = { gold: 'gold', silver: 'solid', base: '' }

/** Purity marks recognised in a def id or name. */
export const PURITY_MARKS = ['375', '500', '583', '585', '750', '800', '875', '900', '916', '925', '958', '999'] as const

export const REFERENCE_TEXT = {
  /** {book} {item} {lo} {hi} */
  listed: '{book} lists the {item} at {lo}–{hi} in good condition.',
  /** {book} {item} */
  outdated: '{book} predates the model. Nothing useful on the {item}.',
}

export const NOTHING_NEW_M2 = {
  acid: 'The acid tells you nothing new.',
  reference: 'The book has nothing more to say.',
  specialist: 'Nothing more to add on the phone.',
}
