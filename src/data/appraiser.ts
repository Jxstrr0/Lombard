/**
 * The Appraiser (M6, GDD § 7 Employee, § 9 "The Appraiser: hiring arc, competent, hiding
 * something"): a fictional person. Numbers live in tuning.appraiser, the logic in
 * src/game/staff/appraiser.ts, the arc in src/data/stories/appraiser.ts.
 *
 * Lev Andreyevich Sablin, late thirties, a charcoal pinstripe suit on a pawn shop's wages, hair
 * combed straight back, a loupe on a cord he never takes off. Twelve years at the state assay
 * office, then the commission shop on Sadovaya until it closed. Better at this than you are,
 * and polite about it, which is worse. He calls every piece "the patient".
 *
 * What he hides: Sablin was his mother's name. He is Lev Andreyevich Gusev, the younger brother
 * of Yuri Gusev, who had this shop for eleven years and left one night owing Eduard Lvovich's
 * crew. He knows the shop too well (the third drawer sticks, the storeroom tube wants two taps),
 * he has been paying his brother's debt to Zhora out of his wages, and he knows that the money
 * Yura skimmed from the crew's deliveries is still under the storeroom floor, in a biscuit tin.
 *
 * Look: business_male_03, a staff-only cast look (`staff` in cast.json): no walk-in, regular,
 * specialist, the fence, Volkova or the Collector wears it.
 */

export const APPRAISER = {
  id: 'appraiser',
  name: 'Lev Andreyevich Sablin',
  /** In the ledger and the office: "Lev bought…". */
  short: 'Lev',
  /** Shown under his name at the counter. */
  role: 'Appraiser, the second counter',
  look: 'business_male_03',
  /** His real name, once you know it (the epilogue card). */
  realName: 'Lev Andreyevich Gusev',
} as const

/** Story flags the staff module keeps (his arc and his epilogue card read them). */
export const APPRAISER_FLAGS = {
  /** Set while he's on staff (his arc's beats wait on it). */
  onStaff: 'appraiser.on_staff',
  /** Set once, the day you hire him (his epilogue card). */
  hired: 'appraiser.hired',
  /** You let him go from the office. */
  letGo: 'appraiser.let_go',
} as const

/** The office card: who he is before you hire him, and what he says when you do. */
export const APPRAISER_TEXT = {
  pitch:
    'Twelve years at the state assay office, then the commission shop on Sadovaya until it closed. Neat, quiet, a loupe on a cord. His references are excellent and all from people who have since died or emigrated.',
  hello: '“I’ll take the ones you haven’t time for. Anything I get wrong is on your books, so I try not to.”',
  fired: 'He took his loupe, left his key on the counter and shook your hand as if he meant it.',
  gone: 'He is not coming back.',
} as const

/** Ledger lines ({lev} = his short name, {item}, {name} = the seller, {price}). */
export const APPRAISER_LOG = {
  bought: '{lev} bought the {item} from {name}',
  lent: '{lev} lent {price} on the {item} to {name}',
  passedFake: '{lev} sent {name} away with the {item}: “Not what it says it is.”',
  passedBulletin: '{lev} sent {name} away with the {item}: “I read the paper too.”',
  noDeal: '{lev} and {name} couldn’t agree on the {item}',
  noCash: '{lev} let {name} go: not enough in the drawer for the {item}',
  insult: '{lev} offered {name} {price} for the {item}. They told the whole line about it',
  mistake: 'Checked {lev}’s buys at closing: the {item} he took from {name} for {price} isn’t what he thought. His mistake, your money',
  wages: 'Wages: {lev}, {month}',
  wagesPart: 'Wages: {lev}, {month} ({days} days)',
  wagesFinal: 'Wages: {lev}, to the end ({days} days this month)',
  counter: 'The second counter',
} as const
