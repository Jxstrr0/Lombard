/**
 * M5 endings content schemas (src/data/endings/): ending titles, the epilogue paper's
 * stories, and the "what became of them" cards. Validated at import.
 *
 * Conditions are the story engine's (src/game/schema/story.ts: flags, beats and their
 * choices, trust, visits, specialists, reputation…) plus a few only an ending can ask:
 * how it ended, the title, the axes, whether you met someone, and the career stats. (Heat,
 * pressure, Volkova and the fence are the story engine's own conditions.) All of a list must hold.
 */
import { z } from 'zod'
import { TITLE_IDS } from '../endings/title'
import { Condition } from './story'

const cmp = { gte: z.number().optional(), lte: z.number().optional() }
const id = z.string().regex(/^[a-z0-9_]+$/, 'lowercase letters, digits, _')
const text = z.string().min(1)

export const EndingCondition = z.union([
  Condition,
  z.discriminatedUnion('if', [
    /** How the career ended. */
    z.object({ if: z.literal('ending'), kind: z.array(z.enum(['retired', 'evicted', 'raided', 'pushedOut'])).min(1) }),
    /** The ending title. */
    z.object({ if: z.literal('title'), is: z.array(z.enum(TITLE_IDS as [string, ...string[]])).min(1) }),
    /** A band from tuning.endings.bands, as the title picker reads it (poor = under `modest`). */
    z.object({ if: z.literal('band'), is: z.enum(['poor', 'comfortable', 'rich', 'clean', 'dirty', 'warm', 'cold', 'loved', 'shunned', 'watched']), not: z.boolean().optional() }),
    /** An axis as the ending reads it (wealth in ₽). */
    z.object({ if: z.literal('axis'), axis: z.enum(['clean', 'heart', 'wealth']), ...cmp }),
    /** A regular came to the counter at least once. */
    z.object({ if: z.literal('met'), who: id }),
    /** A specialist you kept on at some point (or `retired`: gone for good). */
    z.object({ if: z.literal('hired'), id, retired: z.boolean().optional() }),
    /** A career stat. */
    z.object({ if: z.literal('stat'), stat: z.enum(['peopleHelped', 'peopleHurt', 'fakesBought', 'itemsStolen', 'itemsBought', 'itemsSold']), ...cmp }),
  ]),
])
export type EndingCondition = z.infer<typeof EndingCondition>

const when = z.array(EndingCondition).default([])

/** One ending title: its name, a strapline, and the paper's lead story. `{shop}` = the shop's name. */
export const EndingTitle = z.object({
  name: text,
  strap: text,
  headline: text,
  body: text,
})
export type EndingTitle = z.infer<typeof EndingTitle>

/** A story the epilogue paper may print; within a section the first whose conditions hold is printed. */
export const PaperStory = z.object({ id, when, headline: text, body: text })
export const PaperSection = z.object({ id, stories: z.array(PaperStory).min(1) })
export type PaperSection = z.infer<typeof PaperSection>

/** One "what became of them" card. Shown when `show` holds; the first variant whose `when` holds is the text. */
export const EpilogueCard = z
  .object({
    id,
    name: text,
    /** Who they were to the shop, one short line: "Widow, third floor across the canal". */
    role: text,
    show: when,
    variants: z.array(z.object({ when, text })).min(1),
  })
  .refine((c) => c.variants[c.variants.length - 1]!.when.length === 0, 'the last variant is the fallback (no conditions)')
export type EpilogueCard = z.infer<typeof EpilogueCard>
