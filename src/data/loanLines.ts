/**
 * Lines for pawn loans and redemptions (owner: loans worker). Keys e.g.
 * "pawn.accept.flexible", "redeem.arrive", "redeem.thanks".
 * pickLine() in lines.ts looks keys up here as well. Placeholders: {price}, {item}, {name}, {days}.
 *
 * pawn.open.*      a seller asking for a loan instead of a sale (by temperament, or heirloom)
 * pawn.accept.*    they take your loan amount (haggle accept; only {price} and {name})
 * pawn.thanks      they take the loan at their own ask
 * redeem.arrive.*  a pawner back to pay off the loan ({item}, {name})
 * redeem.thanks    paid up, item handed back ({item}, {price}, {name})
 */
export const loanLines: Record<string, readonly string[]> = {
  // --- asking for a loan ----------------------------------------------------------
  'pawn.open.stubborn': [
    'I’m not selling. A loan. Thirty days. I know how this works.',
    'Loan, not sale. I’ll be back for it, so don’t get attached.',
    'I want a loan on this. Write it down properly, with the date.',
    'Just a loan. I had this before you had this shop.',
  ],
  'pawn.open.flexible': [
    'I just need it until payday. Can you hold it for me? A loan, not a sale.',
    'Can I pawn this? Payday is the fifteenth, and the fifteenth is very far away.',
    'A loan, if you do loans. My cousin swears he’s paying me back this month. He swore last month too.',
    'Not selling, just borrowing against it. Like a bank, but you have better coffee.',
    'Hold this for a few weeks? I’ll come back with interest and a box of chocolates.',
  ],
  'pawn.open.desperate': [
    'Please, just a loan. I’ll be back for it, I swear, I just need to get through this month.',
    'The heating bill came. Can you lend against this? I’ll pick it up, I promise.',
    'I need cash today but I can’t lose it. Can you keep it safe for me? A loan?',
    'My boss says the salary is “delayed”. Third time. Can you lend me something on this?',
    'I’m not selling it. I can’t sell it. But I need money by tonight. Do you do loans?',
  ],
  'pawn.open.proud': [
    'This is a temporary arrangement. A loan. I will redeem it, naturally.',
    'I would like a loan against this. Only a loan. One does not sell such things.',
    'A short loan. A misunderstanding with my pension fund, nothing more.',
  ],
  'pawn.open.heirloom': [
    'I’ll be back for it. It was my mother’s. Just a loan, please, until things settle.',
    'It was my grandfather’s. I can’t sell it, he’d come back and haunt me. Can you lend on it?',
    'Keep it in your safe, not the window. I want to be able to look my sister in the eye at Easter.',
    'My father wore this to every wedding in the family. A loan only. I’m coming back for it.',
  ],

  // --- taking your loan -----------------------------------------------------------
  'pawn.accept.stubborn': ['{price}. Fine. Write me the ticket.', 'All right, {price}. And I want the same one back, not a lookalike.'],
  'pawn.accept.flexible': [
    '{price}, deal. Keep it somewhere dry, yes?',
    'Done. {price}, and I’ll see you before the month is out. Probably.',
    '{price}. Lovely. Don’t sell it to anyone while I’m gone.',
  ],
  'pawn.accept.desperate': ['{price}. Thank you. I’ll be back for it, I will. Thank you.', 'Yes, {price}, okay. Please don’t put it in the window.'],
  'pawn.accept.proud': ['{price}. Acceptable. I trust the ticket is in order.', 'Very well, {price}. This is a formality. I shall return.'],
  'pawn.accept.reluctant': ['Fine, {price}. Robbery with a receipt. I’ll be back for it.'],
  'pawn.accept.evidence': ['…All right, I see it. {price}, then. Still my loan, though.'],
  'pawn.accept.threat': ['Wait, wait. {price}. Fine. But it’s a loan, I’m coming back.'],
  'pawn.accept.sympathy': ['You’re kind. {price}. I’ll come back for it, you’ll see.'],
  'pawn.thanks': ['Thirty days. I’ll be back for it.', 'Keep it safe for me. I’ll be back.', 'Thank you. Don’t get too fond of it.'],

  // --- coming back ----------------------------------------------------------------
  'redeem.arrive.stubborn': ['I’m back. The {item}. Here’s my ticket.', 'Ticket. Money. My {item}. In that order.'],
  'redeem.arrive.flexible': [
    'Told you I’d come back! Payday finally showed up. The {item}, please.',
    'Hello again! I’ve come to rescue my {item}. Has it been behaving?',
    'Me again. My cousin actually paid me back. A miracle. The {item}, please.',
  ],
  'redeem.arrive.desperate': [
    'I made it. I actually made it. Is my {item} still here?',
    'Please tell me you still have it. The {item}. I have the money, all of it.',
  ],
  'redeem.arrive.proud': ['As promised. I have come to redeem the {item}.', 'Good day. The {item}, if you please. I said I would return.'],

  // --- paid up --------------------------------------------------------------------
  'redeem.thanks': [
    'There it is. Hello, old friend. Thank you for keeping it safe.',
    'Thank you. I didn’t sleep well without it, isn’t that silly?',
    'Worth every kopeck of the interest. Well. Most of the kopecks.',
    'My mother will never know. Thank you.',
    'Good. Don’t expect me back. Unless I need to come back.',
    'You looked after it. That’s more than the bank would do.',
  ],
}
