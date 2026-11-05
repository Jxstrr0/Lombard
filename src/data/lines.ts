/**
 * Customer dialogue lines keyed by situation. Haggle responses use
 * HaggleResponse.lineKey ("<kind>.<temperament>" or more specific keys, see
 * src/game/haggle/machine.ts). {price} is replaced with the formatted price,
 * {name} with the customer's name.
 *
 * Temperament tells (so players learn to read people):
 * - stubborn: short, flat, repeats themselves, numbers like facts.
 * - flexible: chatty, reasonable, meets you halfway, a little amused.
 * - desperate: rushed, apologetic, mentions rent/bills/family, glances at the door.
 * - proud: formal, offended easily, talks about family, history, dignity.
 */
import type { Rng } from '../game/rng'

export const haggleLines: Record<string, readonly string[]> = {
  // --- accept, by temperament -------------------------------------------------
  'accept.stubborn': [
    'Fine. {price}. Count it twice.',
    'Hm. {price}. Don’t make me regret it.',
    '{price}. Done. I’m not saying it again.',
    'All right. {price}. You’re as stubborn as my brother-in-law.',
  ],
  'accept.flexible': [
    'Fine. {price} it is. Pleasure.',
    'You know what, {price} works. Everyone goes home happy.',
    'Deal. {price}. My wife will say I was robbed, but she says that about everything.',
    '{price}? Sure, why not. Life is short.',
  ],
  'accept.desperate': [
    '{price}. Yes. Yes, okay. Can I have it in cash, please? Now?',
    'Thank you. {price} covers the rent, nearly. Thank you.',
    'Okay. {price}. Please don’t tell anyone I was here.',
    '{price}, yes. Sorry, I’m shaking, it’s the cold.',
  ],
  'accept.proud': [
    'Very well. {price}. I trust you will treat it with respect.',
    '{price}. Agreed. My father would have asked more, but he lived in a different country.',
    'Acceptable. {price}. Please do not put it in the window.',
    'Fine. {price}. I am not doing this because I need to, you understand.',
  ],

  // --- accept, special ----------------------------------------------------------
  'accept.reluctant': [
    'Ugh. {price}. Take it before I change my mind.',
    'Fine. {price}. You’ve worn me down to the nub.',
    '{price}. I hate this. Give me the money.',
    'All right, all right. {price}. I’m too tired to keep arguing.',
  ],
  'accept.evidence': [
    '…Yes, I see it. {price}, then. Let’s not make a show of it.',
    'Okay, you caught that. {price}. Fair is fair.',
    'Fine, fine, it’s not what I said. {price} and we forget this conversation.',
    'You’ve got eyes like a customs officer. {price}.',
  ],
  'accept.sympathy': [
    'You’re kind. {price}. Thank you for not making this worse.',
    '{price}. Yes. You understand. Not everyone does.',
    'It’s been a long winter. {price}, and thank you.',
    'For you, {price}. You remind me of my nephew. The good one.',
  ],
  'accept.threat': [
    'Wait, wait! Don’t go. {price}. Fine.',
    'No, no, sit down. {price}. You win.',
    'All right! {price}. Don’t make me walk to the bridge in this weather.',
    'Okay, {price}. Stop looking at the door like that.',
  ],

  // --- counter, by temperament ---------------------------------------------------
  'counter.stubborn': [
    '{price}.',
    'No. {price}. That’s the number.',
    'I said what I said. Well, nearly. {price}.',
    '{price}. I can stand here all day.',
    'It’s worth what it’s worth. {price}.',
  ],
  'counter.flexible': [
    'I was thinking more like {price}.',
    'Meet me in the middle? {price}.',
    'Come on, {price}. That’s fair and you know it.',
    'Let’s not fight about it. {price}?',
    'Okay, I can come down a little. {price}.',
  ],
  'counter.desperate': [
    'Please, I need at least {price}. My landlord isn’t a patient man.',
    '{price}? I’m sorry, I wouldn’t ask if I didn’t have to.',
    'Could you do {price}? The tram fare alone, you understand.',
    'I really need {price}. My daughter’s school wants money for curtains again.',
  ],
  'counter.proud': [
    'This belonged to my grandfather. {price}, and that is generous.',
    'I don’t haggle like a fishwife. {price}.',
    'You insult the object, not me. {price}.',
    'I will accept {price}. I will not accept less respect.',
    'People queued for these. Queued. {price}.',
  ],

  // --- counter, special ------------------------------------------------------------
  'counter.floor': [
    '{price}. That’s as low as I go. Really.',
    'I can’t go under {price}. I’d be paying you to take it.',
    '{price} is my last word. My actual last word.',
    'Not one kopek under {price}.',
  ],
  'counter.lastChance': [
    'You’re testing me. {price}, or I leave.',
    'Last time. {price}. Then I find another lombard.',
    'My patience is nearly gone, friend. {price}.',
    '{price}. Say yes or say goodbye.',
  ],
  'counter.insulted': [
    'Is that a joke? It’s not funny. {price}.',
    'For that money you can buy a pirozhok. {price}, if you’re serious.',
    'I’ll pretend I didn’t hear that. {price}.',
    'What do I look like, a charity? {price}.',
  ],
  'counter.evidence': [
    'Okay, yes, I see that. {price}, then.',
    'Hm. Nobody mentioned that to me. {price}.',
    'Fine, it’s not perfect. Nothing is. {price}.',
    'You and your little lamp. {price}.',
  ],
  'counter.evidenceWeak': [
    'Where I got it is my business. {price}.',
    'That proves nothing. But fine, {price}.',
    'Everyone’s a detective now. {price}.',
    'My uncle bought it from a man. That’s the whole story. {price}.',
  ],
  'counter.evidenceBackfire': [
    'That’s a good thing, you know. You just made my point. {price}.',
    'What are you showing me? That’s nothing. {price}.',
    'You looked at it with your gadget and found it’s fine. Great. {price}.',
    'Don’t try to confuse me with nonsense. {price}.',
  ],
  'counter.evidenceRepeat': [
    'You already said that. It didn’t get worse. {price}.',
    'Yes, yes, the scratch. We’ve met. {price}.',
    'Again with this? {price}.',
  ],
  'counter.sympathy': [
    'You’re a decent person. Okay. {price}.',
    'Thank you for saying that. {price}, then.',
    'It’s not easy, you’re right. {price}.',
    'You understand. Most people just see a thing on a counter. {price}.',
  ],
  'counter.sympathyShrug': [
    'Spare me the violin. {price}.',
    'Kind words don’t pay the electric bill. {price}.',
    'Very touching. {price}.',
    'Sure, we’re all suffering. {price}.',
  ],
  'counter.threatWorked': [
    'No, wait, don’t… {price}. Okay?',
    'Hold on, hold on. {price}. Let’s talk.',
    'You’d really let me walk out in this? Fine. {price}.',
    'Okay, okay. {price}. Don’t be like that.',
  ],
  'counter.threatShrug': [
    'Then pass. There’s a lombard by the bridge. {price}.',
    'Go ahead. I’m not in a hurry. {price}.',
    'Threats. Very nice. {price}.',
    'The door is right there, for both of us. {price}.',
  ],
  'counter.threatInsulted': [
    'You think I need you? {price}, and mind your tone.',
    'Do not threaten me in your own shop. It’s rude. {price}.',
    'I have sold to better men than you. {price}.',
    'How dare you. {price}. Last courtesy.',
  ],

  // --- walk ---------------------------------------------------------------------------
  'walk.stubborn': [
    'No. {price} or nothing. Nothing, then.',
    'Forget it. I know what it’s worth.',
    'I’ll keep it. It’s kept this long.',
    'We’re done. Good day.',
  ],
  'walk.flexible': [
    'Forget it. I’ll try somewhere else.',
    'Ah, we’re too far apart. No hard feelings.',
    'Well, I tried. Maybe next time.',
    'Can’t do it, friend. Take care.',
  ],
  'walk.desperate': [
    'I… can’t. I’ll find another way. Sorry.',
    'No, that won’t cover it. I have to go.',
    'Maybe the place on Sadovaya will help. Sorry to bother you.',
    'I’ll ask my cousin. He’ll shout, but he’ll help.',
  ],
  'walk.proud': [
    'I see we don’t understand each other. Goodbye.',
    'I would rather drop it in the canal.',
    'My grandfather would turn in his grave. Good day.',
    'Some things are not for sale at that price. Most things, actually.',
  ],
  'walk.insulted': [
    'Unbelievable. Goodbye.',
    'You should be ashamed. I’m leaving.',
    'I’ll tell everyone on the embankment about you.',
    'Go haggle with the pigeons.',
    'Spit on your lombard. Good day.',
  ],
  'walk.threatCalled': [
    'Then pass. I’m going.',
    'Pass, then. See if I care.',
    'Fine. Don’t buy it. I’ll find someone with manners.',
    'You want to pass? I’ll save you the trouble.',
  ],
}

export const visitLines = {
  pass: [
    'Your loss.',
    'Fine. There’s another lombard by the bridge.',
    'Okay. I’ll try my luck elsewhere.',
    'Nobody wants anything these days.',
    'Hmph. You’ll be sorry when you see it in a museum.',
    'Fine. I’ll keep it. It goes with my curtains.',
  ],
  left: [
    'I can’t wait all day.',
    'The bridges go up at one, I’m not getting stuck here.',
    'Forget it, I have a bus to catch.',
    'I’ve been standing here since the news started. Goodbye.',
  ],
  thanks: [
    'Pleasure doing business.',
    'Thank you. Spasibo.',
    'Good. Look after it.',
    'Good luck selling it. You’ll need it.',
    'Thanks. Maybe I’ll be back. Maybe to buy it back.',
  ],
} as const

export function pickLine(key: string, rng: Rng, vars: Record<string, string> = {}): string {
  const options = haggleLines[key] ?? haggleLines[key.split('.')[0] + '.flexible'] ?? ['…']
  let line = rng.pick(options)
  for (const [k, v] of Object.entries(vars)) line = line.replaceAll(`{${k}}`, v)
  return line
}
