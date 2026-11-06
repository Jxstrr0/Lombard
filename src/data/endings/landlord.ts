/**
 * The landlord (M5 eviction, src/game/endings/eviction.ts): Semyon Markovich, who
 * owns the building, the damp and the ground-floor lease. A light presence: a typed letter
 * on rent night and one phone call (the same landlord the Protection arc's crew leans on,
 * src/data/stories/protection.ts). Fictional. `{month}` is the month the notice runs to.
 */
export const LANDLORD = {
  name: 'Semyon Markovich',
  /** Rent night, closing cash under the line: the final notice (a NOTE on the ledger). */
  notice:
    'A typed letter under the door from Semyon Markovich, the landlord: “Final notice. The account is in arrears. Be in credit by rent night in {month} or the keys come back to me.”',
  /** Next rent night, back above the line. */
  withdrawn: 'Semyon Markovich rings: “The account is square. I’ll put the letter in a drawer. I keep the drawer.”',
  /** Next rent night, still under on cash but with stock worth selling: the notice stands. */
  stands: 'Semyon Markovich rings: “Still in arrears. I hear you have things on the shelves worth money. Sell them, or I will be on the step next month.”',
  /** Next rent night, still under even counting the stock: the shop is evicted. */
  evicted: 'Semyon Markovich is waiting on the step with a locksmith and a folder. The keys go back tonight.',
  /** Shown in the ledger while the notice stands. */
  standing: 'Final notice from the landlord: be in credit by the next rent night, or the keys go back.',
} as const
