/**
 * Shoplifting ledger lines (M4). Placeholders: {item} (short name), {where}.
 * `gone`: an item was stolen. `deterred.<upgradeId>`: that upgrade stopped a theft
 * tonight (the strongest owned deterrent speaks).
 */
import type { SlotArea } from '../game/state'

export const theftWhere: Record<SlotArea, string> = {
  counter: 'the counter case',
  wall: 'the wall shelf',
  back: 'the back shelf',
}

export const theftLines: { gone: readonly string[]; deterred: Record<string, readonly string[]> } = {
  gone: [
    'The {item} is gone from {where}.',
    'At closing there’s a gap on {where}. The {item} walked out with somebody.',
    'Locking up, you notice the {item} isn’t on {where} any more.',
  ],
  deterred: {
    camera: [
      'A boy by {where} looked up at the camera and put the {item} back.',
      'On the monitor: a hand on the {item}, a glance at the lens, the hand back in a pocket. Empty.',
    ],
    convex_mirror: [
      'In the mirror you caught a kid slipping the {item} up his sleeve. He put it back and left.',
      'The mirror showed someone weighing the {item} in their hand by {where}. You cleared your throat; they put it down.',
    ],
    door_chime: [
      'The chime went as a girl edged toward {where}. She left without the {item}.',
      'The bell over the door rang twice, quickly. The {item} was still on {where}; somebody thought better of it.',
    ],
    case_counter: [
      'Someone was looking very hard at the {item} on {where}. You looked back until they left.',
    ],
  },
}
