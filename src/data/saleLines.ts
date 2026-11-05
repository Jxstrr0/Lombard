/**
 * Lines for walk-in buyers (owner: shop worker). Keys follow the haggle
 * convention "<event>.<temperament>", e.g. "sale.open.flexible",
 * "sale.counter.stubborn", "sale.accept.proud", "sale.walk.desperate".
 * pickLine() in lines.ts looks keys up here as well. Placeholders: {price}, {item}, {name}, {where}.
 *
 * Special keys from src/game/sell/buyer.ts:
 *   sale.counter.firm / .limit / .stuck / .last   raise after you held firm / at their limit / no movement / next answer is final
 *   sale.accept.firm / .under                      they take your held price / you asked less than they offered
 *   sale.walk.firm                                 you held firm once too often
 * The reducer uses sale.refused.flexible (you refuse) and sale.thanks.flexible (you take their offer).
 *
 * Temperament tells mirror the sellers': stubborn short and flat, flexible chatty,
 * desperate rushed (needs it today), proud formal and touchy.
 */
import type { SlotArea } from '../game/state'

/** How a buyer refers to where they saw the item ({where}). */
export const saleWhere: Record<SlotArea, string> = {
  counter: 'in the case',
  wall: 'on the wall',
  back: 'on the back shelf',
}

export const saleLines: Record<string, readonly string[]> = {
  // --- opening line at the counter -------------------------------------------
  'sale.open.stubborn': [
    'The one {where}. Not paying {price} for it.',
    'That, {where}. What’s the real price?',
    'I want the {item}. Your tag is a joke.',
  ],
  'sale.open.flexible': [
    'Morning! The {item} {where}, is it still for sale? Your tag says {price}, but tags are for tourists, no?',
    'I keep walking past that one {where}. My wife says buy it or stop looking. So.',
    'How much for the {item} {where}? Roughly. Ballpark. Friend price.',
  ],
  'sale.open.desperate': [
    'The {item} {where}, I need it today. Mine died this morning. Please tell me it’s not sold.',
    'Is that {item} {where} still here? It has to be today, my brother’s wedding is at four.',
    'Sorry, sorry, the one {where}. Can we be quick? I’m on my lunch.',
  ],
  'sale.open.proud': [
    'Good afternoon. I would like to look at the {item} {where}. I know what these are worth.',
    'The piece {where}. My father had one exactly like it. I will make you a fair offer, once.',
    'I do not usually buy from a lombard, you understand. But the {item} {where}…',
  ],

  // --- they raise, by temperament ---------------------------------------------
  'sale.counter.stubborn': ['{price}. That’s what it’s worth.', 'No. {price}.', '{price}. I’m not a tourist.'],
  'sale.counter.flexible': [
    'Meet me somewhere in the middle? {price}.',
    'You drive a hard bargain. {price}, and I’ll tell my friends you’re honest.',
    'Ha. All right, {price}. Getting warm?',
  ],
  'sale.counter.desperate': [
    '{price}? Please, that’s nearly everything I have on me.',
    'Okay, okay. {price}. I really need it today.',
    '{price}. I can run to the cash machine, but it’s across the bridge.',
  ],
  'sale.counter.proud': [
    '{price}. I am not haggling with you like a fishwife.',
    'I will go to {price}, as a courtesy.',
    '{price}. That is generous, and you know it.',
  ],

  // --- they raise, special ------------------------------------------------------
  'sale.counter.firm': [
    'You’re not moving, are you. Fine. {price}.',
    'Stone face. Okay. {price}.',
    'All right, you know your price. {price}, then.',
  ],
  'sale.counter.limit': [
    '{price}. That’s all I’ve got. Truly. I’ll turn out my pockets.',
    '{price} and not a kopek more. My wife counts the change.',
    'Look. {price}. That’s the top of my head.',
  ],
  'sale.counter.stuck': ['I said {price}. I’m still saying {price}.', '{price}. Same as before.', 'Still {price}. Do you want to sell it or not?'],
  'sale.counter.last': [
    '{price}. Last offer, then I’m going.',
    'Final answer, {price}. I have a tram to catch.',
    '{price}. Think carefully, I won’t ask twice.',
  ],

  // --- they buy -----------------------------------------------------------------
  'sale.accept.stubborn': ['Fine. {price}. Wrap it.', '{price}. Done.', 'Hm. {price}. You win this one.'],
  'sale.accept.flexible': [
    'Deal! {price}. Pleasure doing business.',
    '{price}, sure. My wife will love it or kill me.',
    'You know what, {price} is fair. Sold. Bought. Whichever.',
  ],
  'sale.accept.desperate': ['{price}, yes! Thank you, thank you.', 'Yes, {price}, fine. Can I take it now?', '{price}. Oh thank God.'],
  'sale.accept.proud': ['Very well. {price}.', '{price}. Agreed. You keep a decent shop.', 'Acceptable. {price}.'],
  'sale.accept.firm': [
    'You don’t blink, do you. {price}. Fine.',
    'A man who knows his price. {price}. I respect that.',
    'All right, all right. {price}. You win.',
  ],
  'sale.accept.under': [
    'You want less than I offered? Nobody will believe this. I’ll pay {price}, as I said.',
    'Are you feeling well? I said {price}, I’ll pay {price}.',
  ],

  // --- they walk ----------------------------------------------------------------
  'sale.walk.stubborn': ['No. I’ll find it cheaper.', 'Forget it.', 'There’s a market by the bridge. Goodbye.'],
  'sale.walk.flexible': [
    'Ah, too rich for me. Maybe next week, if it’s still here.',
    'No hard feelings. I’ll keep walking past it.',
    'I tried. Good luck with it.',
  ],
  'sale.walk.desperate': ['I can’t. I just can’t. Sorry.', 'That’s my rent. I’ll find something else.', 'Never mind. I’ll borrow one.'],
  'sale.walk.proud': [
    'I see. Then we have nothing to discuss.',
    'I offered a fair price. Good day.',
    'You are greedy, and I am leaving.',
  ],
  'sale.walk.firm': [
    'You won’t budge? Then neither will I. Goodbye.',
    'It’s a price tag, not a holy relic. Goodbye.',
    'Enjoy looking at it.',
  ],

  // --- reducer keys ---------------------------------------------------------------
  'sale.refused.flexible': [
    'Not for sale? Then why is it in the window?',
    'Fine. Keep it. Marry it.',
    'Okay. I’ll come back when you’re in a better mood.',
  ],
  'sale.thanks.flexible': ['Thank you! Spasibo.', 'Pleasure. I’ll tell my cousin about this place.', 'Good. Don’t spend it all at once.'],
}
