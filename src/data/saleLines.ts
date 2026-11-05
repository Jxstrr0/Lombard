/**
 * Lines for walk-in buyers (owner: shop worker). Keys follow the haggle
 * convention "<event>.<temperament>", e.g. "sale.open.flexible",
 * "sale.counter.stubborn", "sale.accept.proud", "sale.walk.desperate".
 * pickLine() in lines.ts looks keys up here as well. Placeholders: {price}, {item}, {name}.
 */
export const saleLines: Record<string, readonly string[]> = {}
