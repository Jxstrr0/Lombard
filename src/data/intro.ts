/**
 * Career start content (GDD § Setting, Player character): the intro cards after
 * "name your shop", and what the previous owner left in the safe.
 * Told in a few short cards, never a lore dump. Counts live in tuning.start.
 */

export interface IntroCard {
  id: string
  kicker: string
  title: string
  body: string
}

export const NAME_STEP = {
  kicker: 'ЛОМБАРД',
  title: 'Name your shop',
  body: 'It goes on the sign over the door, on every receipt and, if things go badly, in the newspaper.',
}

export const INTRO_CARDS: readonly IntroCard[] = [
  {
    id: 'bought',
    kicker: 'Zatonny canal, March',
    title: 'A shop for next to nothing',
    body: 'You bought a failing pawn shop on the canal for less than a used car. The sign was crooked, the till was empty, and the estate agent would not quite meet your eyes.',
  },
  {
    id: 'owner',
    kicker: 'The previous owner',
    title: 'He left in a hurry',
    body: 'One night, one suitcase, no forwarding address. He left unpaid bills, a phone that rings at odd hours, and regulars who still think the shop owes them something. One of them wears a leather jacket and has not said yet what he wants.',
  },
  {
    id: 'safe',
    kicker: 'Behind the counter',
    title: "What's in the safe",
    body: 'The safe opened on the third try. Inside: a few things he never sold. Some may be worth something. Some certainly are not. He was not a careful man, so look closely before you price them.',
  },
]

/** The story leftover items carry (shown nowhere yet; kept for the item's record). */
export const LEFTOVER_STORY = 'Left in the safe by the previous owner. No paperwork.'

/**
 * Def pools for the leftovers. One piece from `fakes` is always a fake, one from
 * `decent` is always genuine and in decent shape, and the odds and ends come from `junk`
 * with their natural fake chance.
 */
export const LEFTOVER_POOLS = {
  fakes: ['watch_rolland_abyssal', 'watch_omeca_aquastar', 'gold_signet_583', 'medal_for_courage', 'coin_rouble_1877', 'camera_weissler_iiic'],
  decent: ['watch_pobeda_gold', 'gold_rope_chain_585', 'gold_bracelet_585', 'watch_poljot_strela', 'order_red_star'],
  junk: [
    'phone_severin_k1',
    'phone_mangosteen_m4s',
    'lens_helios_44',
    'camera_zenit_e',
    'coin_poltinnik_1924',
    'coin_olympiad_10r',
    'medal_victory_germany',
    'badge_guards',
    'gold_earrings_583',
    'watch_vostok_komandirskie',
  ],
} as const
