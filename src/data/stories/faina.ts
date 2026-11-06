/**
 * Faina Gelfand, jeweler (GDD § 2b): sharp, accurate, and she'd like your best
 * gold for herself. Drops in; gets caught shading a price (a regular wears the
 * piece in); warns you about plated chains; offers you her customer book when
 * she gives up her bench. Specialist numbers: tuning.specialistArcs.
 */
export default {
  id: 'faina',
  title: 'Faina Gelfand',
  specialist: 'jeweler',
  beats: [
    {
      id: 'faina.drop_in',
      when: [{ if: 'retainedMonths', id: 'jeweler', gte: 1 }],
      chance: 0.5,
      visit: {
        who: 'jeweler',
        kind: 'scene',
        scene: {
          lines: [
            'On my way to the arcade. Don’t get up. I only want to see what you’re putting in your case.',
            'Hm. That one’s tired. That one is lying about its age. That one is fine, which is why nobody will buy it.',
            'Anything heavy in 585, you call me first. Not second. First.',
          ],
        },
      },
    },
    {
      // She lowballed a piece, you bought it and sold it on, and it turned up in her window.
      id: 'faina.window',
      when: [
        { if: 'beat', beat: 'faina.drop_in' },
        { if: 'specialistEvent', id: 'jeweler', event: 'lowballSold' },
      ],
      chance: 0.6,
      visit: {
        who: 'zinaida',
        kind: 'scene',
        scene: {
          lines: [
            'Look what I bought in Faina Gelfand’s window at the arcade. Go on, look. You know it.',
            'She told me it came from a little shop on the canal for a third of what I paid. She laughed. Then she stopped laughing, because I live upstairs from her.',
            'She looked at it for you first, didn’t she? And told you it was nothing much.',
          ],
          choices: [
            {
              id: 'ring',
              label: 'Ring Faina about it',
              reply: 'Ring her. She’ll sulk for a week. It will do her good.',
              effects: [{ do: 'specialist', id: 'jeweler', change: 'faina.noticed' }],
            },
            {
              id: 'quiet',
              label: 'Say nothing',
              reply: 'Say nothing, then. It suits me, anyway. I’m keeping it.',
              effects: [{ do: 'specialist', id: 'jeweler', change: 'faina.quiet' }],
            },
          ],
        },
      },
    },
    {
      id: 'faina.chains',
      when: [
        { if: 'beat', beat: 'faina.drop_in' },
        { if: 'specialist', id: 'jeweler', relationship: { gte: 0.5 } },
      ],
      chance: 0.5,
      visit: {
        who: 'jeweler',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Faina. Listen, don’t talk. There are rope chains going round the district with a perfect 585 on the clasp.',
            'The clasp is real. The rope is brass with a coat of colour and a prayer. Somebody solders a good clasp onto rubbish and sells it by the gram.',
            'Hold the clasp against the chain, in daylight. Different colour: warm at the clasp, yellow and flat down the rope. That’s all. Goodbye.',
          ],
        },
        after: {
          talked: { effects: [{ do: 'boost', boost: 'plated_chains' }, { do: 'flag', flag: 'faina_warned_chains' }] },
        },
      },
    },
    {
      id: 'faina.book',
      final: true,
      when: [
        { if: 'beat', beat: 'faina.drop_in' },
        { if: 'retainedMonths', id: 'jeweler', gte: 4 },
      ],
      chance: 0.5,
      visit: {
        who: 'jeweler',
        kind: 'scene',
        scene: {
          lines: [
            'I’m giving my bench at the arcade to my nephew. He has good hands and no sense. It will even out.',
            'Forty years of customers are in this book. Who wears what, who buys at New Year, whose husband needs forgiving in March.',
            '{cash} and it’s yours. Or I take it home and it goes in the stove with my sister’s letters. Decide.',
          ],
          choices: [
            {
              id: 'buy',
              label: 'Buy the book, {cash}',
              reply: 'Good. Be kind to the ones in green ink; they pay late, but they pay. I’ll still pick up the phone, you know. I’m retiring, not dying.',
              effects: [
                { do: 'specialist', id: 'jeweler', change: 'faina.book', text: 'Faina Gelfand’s customer book' },
                { do: 'flag', flag: 'faina_book_bought' },
                { do: 'endArc' },
              ],
            },
            {
              id: 'decline',
              label: 'Keep your book',
              reply: 'Then that’s that. I’ll be at my sister’s by the sea, if anyone asks. Nobody will.',
              effects: [{ do: 'specialist', id: 'jeweler', change: 'faina.retire' }, { do: 'flag', flag: 'faina_book_declined' }, { do: 'endArc' }],
            },
          ],
        },
      },
    },
  ],
} as const
