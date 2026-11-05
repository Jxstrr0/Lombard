/**
 * Lines for pawn loans and redemptions (owner: loans worker). Keys e.g.
 * "pawn.accept.flexible", "redeem.arrive", "redeem.thanks".
 * pickLine() in lines.ts looks keys up here as well. Placeholders: {price}, {item}, {name}, {days}.
 */
export const loanLines: Record<string, readonly string[]> = {}
