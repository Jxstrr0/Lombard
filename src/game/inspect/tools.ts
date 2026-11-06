/**
 * Tool application → findings.
 *
 * Every tool works on the item's *effective* tell set: the def's genuine tells,
 * with the fake profile's tells replacing same-id tells (or adding new ones),
 * minus the profile's removeTells.
 *
 * Noticing: a tell is noticed with probability 1 − miss, where
 *   miss = difficulty × missFactor × repeatMissDecay^uses   (capped at maxMiss)
 * A tell already found on this visit (same tellId in `previous`) is never reported again.
 *
 * Hotspot rule (loupe only; scale and magnet examine the whole item and ignore it):
 *   - Loupe aimed at a hotspot: only tells at that hotspot are candidates, and their
 *     miss chance is multiplied by hotspotFocus (looking right at it helps).
 *     Tells elsewhere are not reported.
 *   - Loupe with no hotspot (a general look-over): tells without a hotspot use the
 *     plain miss chance; tells at a hotspot are still candidates but get
 *     offHotspotMiss added to their base miss chance before repeat decay, so a
 *     careful player who aims the loupe finds them faster.
 *
 * Tool-specific extras, reported alongside tells:
 *   - Loupe: one condition finding per visit (tellId CONDITION_TELL).
 *   - Scale: a reading on every use (tellId WEIGHT_TELL on the first one only),
 *     compared with the def's expected range. Negative when outside tolerance.
 *   - Magnet: one pull/no-pull finding per visit (tellId MAGNET_TELL).
 *   - Acid (M2): one purity finding per visit (tellId ACID_TELL) from the item's
 *     metal and fake profile: genuine gold "the 583 scratch holds", plated brass
 *     "the scratch fizzes green" (text in src/data/toolText.ts).
 *   - Reference (M2): one value-range finding per visit (tellId REFERENCE_TELL)
 *     for the def, genuine and in good condition, from the book tier in
 *     extras.refTier. Width shrinks with tier; some categories predate the book.
 *     It never detects fakes (neutral, reveals nothing).
 *   - Specialist (M2): an opinion on authenticity plus a value range from the
 *     retained specialist in extras.specialist (tellId SPECIALIST_TELL), see
 *     specialistOpinion(). Never says FAKE outright.
 * These synthetic tellIds start with "@" and never collide with def tell ids.
 * Def/profile tells authored for acid/reference/specialist are reported too.
 *
 * If nothing new turns up, a single neutral "Nothing new…" finding is returned.
 */
import { getSpecialist } from '../../data/specialists'
import {
  ACID_FAKE_FALLBACK,
  ACID_FAKE_REACTIONS,
  ACID_GENUINE,
  ACID_NO_METAL,
  ACID_PURITY_FALLBACK,
  NOTHING_NEW_M2,
  PURITY_MARKS,
  REFERENCE_TEXT,
  type Metal,
} from '../../data/toolText'
import { tuning } from '../../data/tuning'
import { referenceBook } from '../../data/upgrades'
import { claimedValue, tidyPrice } from '../appraise/value'
import { fakeProfileOf } from '../items/generate'
import { hashString } from '../rng'
import type { Verdict } from '../schema/economy'
import type { Rng } from '../rng'
import type { FakeProfile, ItemDef, Polarity, Tell, ToolId } from '../schema/item'
import type { Finding, ItemInstance, SpecialistMods } from '../types'

export interface UseToolInput {
  item: ItemInstance
  def: ItemDef
  tool: ToolId
  hotspot?: string
  /** Findings already on this visit (for repeat-use logic and unique ids). */
  previous: readonly Finding[]
  /** How many times this tool was already used on this visit. */
  uses: number
  rng: Rng
  /** M2: shop context for reference, acid and specialist tools (from inspect/available.ts toolExtras). */
  extras?: ToolExtras
}

/** Shop context some tools need (owner: economy worker; extend as needed). */
export interface ToolExtras {
  /** Reference book tier owned (0 = none). */
  refTier: number
  /** Retained specialist covering this item's category, if any (mods: what their M4 arc changed). */
  specialist?: CalledSpecialist
}

/** Who you rang: id, relationship and (M4) their arc's mods. */
export interface CalledSpecialist {
  id: string
  relationship: number
  mods?: SpecialistMods
}

export interface UseToolResult {
  /** New findings produced by this use (may be a single "nothing notable"). */
  findings: Finding[]
  /** In-game seconds the use took. */
  seconds: number
}

export const CONDITION_TELL = '@condition'
export const WEIGHT_TELL = '@weight'
export const MAGNET_TELL = '@magnet'
export const ACID_TELL = '@acid'
export const REFERENCE_TELL = '@reference'
export const SPECIALIST_TELL = '@specialist'

/** Genuine tells, overridden/extended by the fake profile, minus its removeTells. */
export function effectiveTells(def: ItemDef, profile: FakeProfile | undefined): Tell[] {
  if (!profile) return def.tells.slice()
  const removed = new Set(profile.removeTells)
  const overrides = new Map(profile.tells.map((t) => [t.id, t]))
  const genuineIds = new Set(def.tells.map((t) => t.id))
  const out: Tell[] = []
  for (const t of def.tells) {
    if (removed.has(t.id)) continue
    out.push(overrides.get(t.id) ?? t)
  }
  for (const t of profile.tells) {
    if (!genuineIds.has(t.id) && !removed.has(t.id)) out.push(t)
  }
  return out
}

type Focus = 'plain' | 'focused' | 'unfocused'

/** Chance a candidate tell is missed on this use (see the hotspot rule above). */
export function missChance(tell: Tell, uses: number, focus: Focus): number {
  const t = tuning.inspect
  const decay = t.repeatMissDecay ** uses
  let miss = tell.difficulty * t.missFactor
  if (focus === 'focused') miss *= t.hotspotFocus
  else if (focus === 'unfocused') miss += t.offHotspotMiss
  return Math.min(t.maxMiss, miss * decay)
}

function focusFor(tell: Tell, tool: ToolId, hotspot: string | undefined): Focus | null {
  if (tool !== 'loupe') return 'plain'
  if (hotspot !== undefined) return tell.hotspot === hotspot ? 'focused' : null
  return tell.hotspot ? 'unfocused' : 'plain'
}

export function useTool(input: UseToolInput): UseToolResult {
  const { item, def, tool, hotspot, previous, uses, rng } = input
  const profile = fakeProfileOf(def, item)
  const seen = new Set(previous.flatMap((f) => (f.tellId ? [f.tellId] : [])))
  const takenIds = new Set(previous.map((f) => f.id))
  let counter = previous.length
  const nextId = (): string => {
    let id: string
    do id = `f${++counter}`
    while (takenIds.has(id))
    takenIds.add(id)
    return id
  }

  const findings: Finding[] = []
  const add = (f: Omit<Finding, 'id' | 'tool'>) => findings.push({ id: nextId(), tool, ...f })

  // Tool-specific extras first (they read as the headline of the card).
  if (tool === 'loupe' && !seen.has(CONDITION_TELL)) add(conditionFinding(def, item))
  if (tool === 'scale') add(scaleReading(def, item, rng, !seen.has(WEIGHT_TELL)))
  if (tool === 'magnet' && !seen.has(MAGNET_TELL)) add(magnetFinding(def, profile))
  if (tool === 'acid' && !seen.has(ACID_TELL)) add(acidFinding(def, profile))
  if (tool === 'reference' && !seen.has(REFERENCE_TELL)) add(referenceFinding(def, input.extras?.refTier ?? 1))
  if (tool === 'specialist' && !seen.has(SPECIALIST_TELL)) {
    const sp = input.extras?.specialist
    if (sp) add(specialistFinding(def, item, sp, rng))
  }

  for (const tell of effectiveTells(def, profile)) {
    if (tell.tool !== tool || seen.has(tell.id)) continue
    const focus = focusFor(tell, tool, hotspot)
    if (!focus) continue
    if (rng.chance(missChance(tell, uses, focus))) continue
    add({
      text: tell.finding,
      tellId: tell.id,
      reveals: tell.reveals,
      polarity: tell.polarity,
      ...(tell.hotspot ? { hotspot: tell.hotspot } : {}),
    })
  }

  if (findings.length === 0) {
    add({ text: NOTHING_NEW[tool] ?? 'Nothing new.', polarity: 'neutral', ...(hotspot ? { hotspot } : {}) })
  }
  const seconds = tool === 'specialist' && input.extras?.specialist ? specialistCallSeconds(input.extras.specialist.id, input.extras.specialist.mods) : tuning.inspect.toolSeconds[tool]
  return { findings, seconds }
}

/** How long a call to this specialist takes: their arc's (M4), else their own callSeconds, else the tool default. */
export function specialistCallSeconds(id: string, mods?: SpecialistMods): number {
  return mods?.callSeconds ?? tuning.specialists.roster[id]?.callSeconds ?? tuning.inspect.toolSeconds.specialist
}

// --- text ---------------------------------------------------------------------

const NOTHING_NEW: Partial<Record<ToolId, string>> = {
  loupe: 'Nothing new under the loupe.',
  scale: 'The scale has nothing new to say.',
  magnet: 'Nothing new from the magnet.',
  ...NOTHING_NEW_M2,
}

type Band = 'mint' | 'good' | 'worn' | 'poor'

const CONDITION_TEXT: Record<string, Record<Band, string>> = {
  gold: {
    mint: 'Bright polish, barely a hairline scratch.',
    good: 'Light scratches from wear; the edges are still crisp.',
    worn: 'Rubbed smooth in places, with a few small dings.',
    poor: 'Deep scuffs, a dent on the edge, worn thin in places.',
  },
  watches: {
    mint: 'Crystal clear, the case barely marked.',
    good: 'Light desk scratches on the case; the crystal is clean.',
    worn: 'A scratched crystal and worn finish on the lugs.',
    poor: 'Crystal chipped at the edge, case deeply scuffed, strap worn through.',
  },
  phones: {
    mint: 'Screen spotless, frame without a mark.',
    good: 'Fine scratches on the screen, corners lightly scuffed.',
    worn: 'Scuffed corners and a long scratch across the screen.',
    poor: 'A cracked screen corner, a dented frame, buttons worn shiny.',
  },
  electronics: {
    mint: 'Lid and palm rest unmarked, the keys still matte, the screen spotless.',
    good: 'Light scuffs on the lid corners and a shine on the most-used keys.',
    worn: 'A scratched lid, a palm rest worn pale, a dead pixel near one corner.',
    poor: 'A cracked hinge cover, missing key caps, a screen scratched right across.',
  },
  cameras: {
    mint: 'Chrome bright, leatherette intact, the glass clean.',
    good: 'Light brassing on the corners; the controls turn smoothly.',
    worn: 'Worn chrome, a scuffed body, a speck of haze in the glass.',
    poor: 'Dented edges, peeling leatherette, a stiff dial and hazy glass.',
  },
  militaria: {
    mint: 'Crisp edges, the high points barely touched.',
    good: 'Light wear on the high points; the details hold.',
    worn: 'Rubbed smooth in places, with small knocks on the rim.',
    poor: 'Deep scratches, a bent edge, the detail worn nearly flat.',
  },
  coins: {
    mint: 'Full lustre, not a mark on the high points.',
    good: 'Light wear on the highest points; the fine detail holds.',
    worn: 'Worn flat on the high points, with a few rim knocks.',
    poor: 'Worn smooth, scratched, the date barely legible.',
  },
  // M6 wave A
  instruments: {
    mint: 'Hardly played or well kept: the finish whole, the fittings bright, nothing loose.',
    good: 'Honest playing wear where hands and chin go; nothing cracked or missing.',
    worn: 'Worn finish, a few dings, a fitting that wants tightening; it still plays.',
    poor: 'A crack, a missing part, a stiff action. It needs a repairer before it needs a player.',
  },
  tools: {
    mint: 'Clean, the housing unmarked, the labels sharp. Barely used.',
    good: 'Dust in the vents and scuffs on the housing; it has done some honest work.',
    worn: 'Paint worn off the grip, the casing scratched, a sticky switch.',
    poor: 'Cracked housing, a frayed cord or a bent part. Building-site tired.',
  },
  silver: {
    mint: 'Bright, with only the faintest hairline scratches; the engraving crisp.',
    good: 'A soft lustre and light wear on the high points; dark tarnish in the recesses.',
    worn: 'Worn smooth on the edges, a small dent, black tarnish nobody has touched.',
    poor: 'Bent, dented and scratched deep, the engraving rubbed nearly away.',
  },
  antiques: {
    mint: 'Kept in a cabinet, by the look: no chips, the finish whole.',
    good: 'Age wear where hands go, a little dust in the crevices; nothing broken.',
    worn: 'Rubbed gilding, small chips at the edges, a dent or two.',
    poor: 'A crack, a chip off the rim, a part that does not sit right any more.',
  },
  icons: {
    mint: 'The paint is whole and the cover bright; it was looked after.',
    good: 'Soot from candles in the corners, a little flaking at the edge.',
    worn: 'Flaking paint along the joins, the cover rubbed thin at the corners.',
    poor: 'Paint lost in patches, the panel split, the cover bent away from it.',
  },
}
const CONDITION_FALLBACK = CONDITION_TEXT.gold!

function conditionFinding(def: ItemDef, item: ItemInstance): Omit<Finding, 'id' | 'tool'> {
  const b = tuning.inspect.conditionBands
  const c = item.condition
  const band: Band = c >= b.mint ? 'mint' : c >= b.good ? 'good' : c >= b.worn ? 'worn' : 'poor'
  const polarity: Polarity = band === 'mint' ? 'positive' : band === 'poor' ? 'negative' : 'neutral'
  const text = (CONDITION_TEXT[def.category] ?? CONDITION_FALLBACK)[band]
  return { text, tellId: CONDITION_TELL, reveals: 'condition', polarity }
}

/** How to describe "a standard one" of this shape when quoting the expected weight. */
const WEIGHT_SUBJECT: Record<ItemDef['model']['placeholder'], string> = {
  ring: 'A solid band this size usually weighs',
  signet: 'A solid signet this size usually weighs',
  chain: 'A solid chain this length usually weighs',
  earrings: 'A solid pair like this usually weighs',
  watch: 'This model usually weighs',
  phone: 'This model usually weighs',
  pendant: 'A solid pendant this size usually weighs',
  camera: 'This model usually weighs',
  lens: 'This lens usually weighs',
  medal: 'An original of this award usually weighs',
  order: 'An original of this award usually weighs',
  badge: 'An original of this badge usually weighs',
  coin: 'A coin of this issue weighs',
  laptop: 'This model usually weighs',
  icon: 'A panel this size under a silver cover usually weighs',
  accordion: 'This model usually weighs',
  balalaika: 'An instrument like this usually weighs',
  guitar: 'An instrument like this usually weighs',
  eguitar: 'This model usually weighs',
  violin: 'A violin like this usually weighs',
  trumpet: 'This model usually weighs',
  saxophone: 'This model usually weighs',
  grinder: 'This model usually weighs',
  perforator: 'This model usually weighs',
  chainsaw: 'This model, dry, usually weighs',
  socketset: 'A full set like this usually weighs',
  sewing: 'This model usually weighs',
  spoons: 'A set like this in solid silver usually weighs',
  glassholder: 'A solid holder this size usually weighs',
  cups: 'A set like this in solid silver usually weighs',
  beads: 'A string like this usually weighs',
  brooch: 'A brooch like this usually weighs',
  cabochon: 'A pendant like this usually weighs',
  samovar: 'A samovar like this usually weighs',
  figurine: 'A figure this size usually weighs',
  vase: 'A vase this size usually weighs',
  gramophone: 'A machine like this usually weighs',
  block: 'One of these usually weighs',
}

function scaleReading(def: ItemDef, item: ItemInstance, rng: Rng, first: boolean): Omit<Finding, 'id' | 'tool'> {
  const tellId = first ? { tellId: WEIGHT_TELL } : {}
  const spec = def.weightGrams
  if (!spec || item.weightGrams === undefined) {
    return { text: 'The scale settles, but there is no standard weight to hold it against.', polarity: 'neutral', ...tellId }
  }
  const decimals = spec.expected < 20 ? 1 : 0
  const round = (g: number) => Number(g.toFixed(decimals))
  const noise = rng.range(-1, 1) * tuning.inspect.scaleNoise * spec.expected
  const reading = round(item.weightGrams + noise)
  const lo = round(spec.expected - spec.tolerance)
  const hi = round(spec.expected + spec.tolerance)
  const inside = reading >= lo && reading <= hi
  const g = (n: number) => n.toFixed(decimals)
  const text = first
    ? `Reads ${g(reading)} g. ${WEIGHT_SUBJECT[def.model.placeholder]} ${g(lo)}–${g(hi)} g.`
    : `Weighed again: ${g(reading)} g (usually ${g(lo)}–${g(hi)} g).`
  return { text, reveals: 'authenticity', polarity: inside ? 'positive' : 'negative', ...tellId }
}

function magnetFinding(def: ItemDef, profile: FakeProfile | undefined): Omit<Finding, 'id' | 'tool'> {
  const pulls = profile?.magnetic ?? def.magnetic
  const base = { tellId: MAGNET_TELL, reveals: 'authenticity' as const }
  if (def.category === 'phones') {
    const text = pulls
      ? 'The magnet clings near the speaker, as it would on almost any phone. It tells you little.'
      : 'Hardly any pull, even near the speaker. Phones vary, so it tells you little.'
    return { ...base, text, polarity: 'neutral' }
  }
  if (def.category === 'electronics') {
    // Speakers, drive and screws: every laptop has steel and magnets in it somewhere.
    const text = pulls
      ? 'The magnet catches at the speakers and the screws, as it would on any laptop. It tells you little.'
      : 'Barely a tug anywhere. Laptops vary inside, so it tells you little.'
    return { ...base, text, polarity: 'neutral' }
  }
  // A pull where the genuine article has none (or the reverse) is negative evidence.
  const polarity: Polarity = pulls !== def.magnetic ? 'negative' : 'neutral'
  let text: string
  if (def.category === 'watches') {
    text = pulls ? 'The case itself tugs toward the magnet.' : 'The case ignores the magnet.'
  } else if (def.category === 'gold' || def.category === 'coins') {
    text = pulls ? 'It jumps to the magnet and holds on.' : 'No pull at all from the magnet.'
  } else if (def.category === 'militaria') {
    text = pulls ? 'The whole piece swings toward the magnet.' : 'The piece itself ignores the magnet.'
  } else if (def.category === 'cameras') {
    text = pulls ? 'The magnet catches on steel somewhere inside the body.' : 'Nothing; brass and aluminium all through.'
  } else if (def.category === 'silver') {
    text = pulls ? 'It jumps to the magnet and holds on.' : 'No pull at all from the magnet.'
  } else if (def.category === 'tools') {
    text = pulls ? 'The magnet clamps onto steel in it.' : 'Hardly a tug anywhere: alloy, brass and plastic.'
  } else if (def.category === 'instruments') {
    text = pulls ? 'The magnet catches on steel somewhere: screws, reeds or strings.' : 'Wood, brass and gut: the magnet finds nothing to hold.'
  } else {
    text = pulls ? 'It pulls toward the magnet.' : 'No pull from the magnet.'
  }
  return { ...base, text, polarity }
}

// --- M2 tools -------------------------------------------------------------------

const rub = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₽`
const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)

/** Precious metal of a def: the gold category is gold; otherwise read the id, name and tags. */
export function metalOf(def: ItemDef): Metal {
  if (def.category === 'gold') return 'gold'
  const words = [def.id, def.name, ...def.demandTags].join(' ').toLowerCase()
  if (/gold|chervonets/.test(words)) return 'gold'
  if (/silver/.test(words)) return 'silver'
  return 'base'
}

/** Purity mark ("583") from the def id or name, if any. */
export function purityOf(def: ItemDef): string | undefined {
  const words = ` ${def.id.replaceAll('_', ' ')} ${def.name} `
  return PURITY_MARKS.find((p) => new RegExp(`[^0-9]${p}[^0-9]`).test(words))
}

function acidFinding(def: ItemDef, profile: FakeProfile | undefined): Omit<Finding, 'id' | 'tool'> {
  const base = { tellId: ACID_TELL, reveals: 'authenticity' as const }
  if (profile) {
    const reaction = ACID_FAKE_REACTIONS.find((r) => r.match.test(profile.id))
    if (reaction) return { ...base, text: reaction.text, polarity: 'negative' }
    if (profile.kind === 'fake') return { ...base, text: ACID_FAKE_FALLBACK, polarity: 'negative' }
  }
  const metal = metalOf(def)
  // M6: amber, pearls and the like sit in the silver category with no metal to scratch.
  if (metal === 'base' && def.category !== 'coins') return { ...base, text: ACID_NO_METAL, polarity: 'neutral' }
  const text = fill(ACID_GENUINE[metal], { purity: purityOf(def) ?? ACID_PURITY_FALLBACK[metal] })
  return { ...base, text, polarity: metal === 'base' ? 'neutral' : 'positive' }
}

/** The book's range for a def at a tier: a fixed per-def misprint, narrower with tier. Null if the edition predates it. */
export function referenceRange(def: ItemDef, tier: number): { lo: number; hi: number } | null {
  const book = referenceBook(tier)
  if (book.outdated.includes(def.category)) return null
  const r = tuning.upgrades.reference
  const i = book.tier - 1
  const mid = (def.baseValue.min + def.baseValue.max) / 2
  // Deterministic in [-1, 1): the same book always says the same thing.
  const misprint = (hashString(`${def.id}:${book.tier}`) / 2 ** 32) * 2 - 1
  const centre = mid * (1 + misprint * r.centreError[i]!)
  return { lo: tidyPrice(centre * (1 - r.halfWidth[i]!)), hi: tidyPrice(centre * (1 + r.halfWidth[i]!)) }
}

function referenceFinding(def: ItemDef, tier: number): Omit<Finding, 'id' | 'tool'> {
  const book = referenceBook(tier).title
  const range = referenceRange(def, tier)
  const text = range
    ? fill(REFERENCE_TEXT.listed, { book, item: def.name, lo: rub(range.lo), hi: rub(range.hi) })
    : fill(REFERENCE_TEXT.outdated, { book, item: def.name })
  return { tellId: REFERENCE_TELL, text, polarity: 'neutral' }
}

/** What the item really is, in specialist terms. */
function truthOf(item: ItemInstance): Verdict {
  switch (item.authenticity) {
    case 'genuine':
      return 'sound'
    case 'restored':
      return 'redone'
    case 'frankenstein':
      return 'mixed'
    default:
      return 'doubt'
  }
}

export interface SpecialistOpinion {
  verdict: Verdict
  lo: number
  hi: number
  /** Effective accuracy used (for tests and tuning). */
  accuracy: number
}

/**
 * A specialist's opinion. Draw order (part of determinism): wrong-verdict roll,
 * [wrong verdict pick], [lowball roll, lowball factor], value noise; the caller then picks a line.
 *   accuracy = roster accuracy + relationship × relationshipAccuracy (capped)
 *   wrong verdict chance = (1 − accuracy) × wrongVerdictFactor: a sound piece is
 *     doubted (or called redone); anything else is called sound.
 *   lowball (sound pieces worth ≥ lowballMinValue, called sound): chance (1 − honesty) ×
 *     lowballChance; the value is cut to lowballFactor and the line hints they'd buy it.
 *   value: what they believe it is (sound-but-not → genuine value; doubted-but-sound →
 *     value × doubtValueFactor), ± (1 − accuracy) × valueNoise, quoted ± rangeHalfWidth.
 */
export function specialistOpinion(def: ItemDef, item: ItemInstance, sp: CalledSpecialist, rng: Rng): SpecialistOpinion {
  const t = tuning.specialists
  const roster = t.roster[sp.id] ?? { accuracy: 0.5, honesty: 1 }
  // M4 arcs: mods.accuracy (Ilya's eyes, Zhenya slowing down) and mods.lowball (Faina, once you noticed).
  const accuracy = Math.min(t.maxAccuracy, roster.accuracy + (sp.mods?.accuracy ?? 0) + sp.relationship * t.relationshipAccuracy)
  const truth = truthOf(item)
  let verdict: Verdict = truth
  if (rng.chance((1 - accuracy) * t.wrongVerdictFactor)) {
    verdict = truth === 'sound' ? rng.pick<Verdict>(['doubt', 'redone']) : 'sound'
  }
  let value = item.trueValue
  if (verdict === 'sound' && truth !== 'sound') value = claimedValue(def, item)
  else if (verdict !== 'sound' && truth === 'sound') value = item.trueValue * t.doubtValueFactor
  if (truth === 'sound' && verdict === 'sound' && item.trueValue >= t.lowballMinValue && rng.chance((1 - roster.honesty) * t.lowballChance * (sp.mods?.lowball ?? 1))) {
    verdict = 'lowball'
    value *= rng.range(t.lowballFactor[0], t.lowballFactor[1])
  }
  const estimate = value * (1 + rng.range(-1, 1) * (1 - accuracy) * t.valueNoise)
  const lo = tidyPrice(estimate * (1 - t.rangeHalfWidth))
  // Very cheap items (a fake kopeck) can round both ends to the same price; keep a real range.
  const hi = Math.max(tidyPrice(estimate * (1 + t.rangeHalfWidth)), lo + tuning.appraise.roundSteps[0]!.step)
  return { verdict, lo, hi, accuracy }
}

function specialistFinding(def: ItemDef, item: ItemInstance, sp: CalledSpecialist, rng: Rng): Omit<Finding, 'id' | 'tool'> {
  const op = specialistOpinion(def, item, sp, rng)
  const spec = getSpecialist(sp.id)
  // M6: a specialist may have their own lines for a category (Zhenya on power tools).
  const line = spec ? rng.pick(spec.categoryLines?.[def.category]?.[op.verdict] ?? spec.lines[op.verdict]) : 'The specialist gives a range: {lo}–{hi}.'
  const text = fill(line, { lo: rub(op.lo), hi: rub(op.hi), item: def.name })
  const polarity: Polarity = op.verdict === 'sound' ? 'positive' : 'negative'
  return { tellId: SPECIALIST_TELL, text, reveals: 'authenticity', polarity, verdict: op.verdict }
}
