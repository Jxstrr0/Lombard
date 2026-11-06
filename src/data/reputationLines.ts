/**
 * Ledger "word on the street" lines (M4). The ledger never shows reputation as a
 * number (GDD § 12): each group gets one vague line, picked by band (cold, cool,
 * neutral, warm, close; edges in tuning.reputation.bands) or, when today moved it
 * noticeably, by the direction it moved.
 */
import type { Group } from '../game/state'

export interface GroupLines {
  /** Index 0 = cold (≤ −0.5) … 4 = close (≥ 0.5). */
  bands: readonly [string, string, string, string, string]
  up: string
  down: string
}

export const reputationLines: Record<Group, GroupLines> = {
  neighbourhood: {
    bands: [
      'Neighbours cross the canal bridge rather than pass your door.',
      'People on the street have started to talk about you, and not kindly.',
      'The neighbourhood hasn’t made up its mind about you yet.',
      'Neighbours nod to you on the street.',
      'Half the street knows your name and sends their cousins to you.',
    ],
    up: 'The neighbourhood is warming to you.',
    down: 'People on the street are grumbling about the shop.',
  },
  youth: {
    bands: [
      'Kids hang around the shelves after school and never buy anything.',
      'The courtyard kids eye the open shelves.',
      'The local kids don’t pay the shop much mind.',
      'The students say you’re straight with them.',
      'The kids look out for the shop. They’d tell you if someone tried something.',
    ],
    up: 'The students tell each other you’re fair.',
    down: 'The kids have decided you’re fair game.',
  },
  specialists: {
    bands: [
      'Nobody in the trade picks up when you call.',
      'Word in the trade is that you don’t keep people on.',
      'The trade doesn’t know you yet.',
      'Your specialists are getting used to you.',
      'Your specialists pick up on the first ring.',
    ],
    up: 'Your specialists are glad of the work.',
    down: 'The trade heard you let someone go.',
  },
  // Police and mob stay at 0 until the M5 crime layer; the ledger hides them at 0.
  police: {
    bands: [
      'The precinct has your name on a list.',
      'A patrol car slows down outside more often than it used to.',
      'The police don’t know you exist.',
      'The beat officer stops in for tea.',
      'The precinct thinks of you as one of the good ones.',
    ],
    up: 'The police seem to be warming to you.',
    down: 'The police are paying you more attention.',
  },
  mob: {
    bands: [
      'Certain people would like a word with you.',
      'Men in leather jackets have started parking across the canal.',
      'The wrong people haven’t noticed you yet.',
      'Certain people speak well of you.',
      'Certain people consider you one of theirs.',
    ],
    up: 'Certain people are pleased with you.',
    down: 'Certain people are not pleased with you.',
  },
}
