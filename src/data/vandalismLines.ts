/**
 * Vandalism lines (M5, Protection arc). What you find in the morning; the night itself
 * stays off-screen. Placeholders: {item} (short name).
 */
export const vandalismLines = {
  brick: {
    /** The shop narration the morning after. */
    morning: 'Glass on the floor this morning. Someone put a brick through the counter case overnight.',
    /** The brick itself (ledger, no cash). */
    found: 'A half-brick on the counter, in the glass. Nothing written on it. Nothing needed.',
    gone: ['The {item} is gone from the broken case.', 'An empty felt pad where the {item} was. The glass around it is gone too.'],
    damaged: ['The {item} took the glass: scratched and chipped now.', 'Glass in the {item}. It’s marked for good.'],
    /** Narration while the case has no glass. */
    open: 'Cardboard taped over the counter case until the glazier comes.',
    glazier: 'Glazier: new glass for the counter case',
  },
} as const
