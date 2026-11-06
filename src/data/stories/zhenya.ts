/**
 * Zhenya Kroshkina, electronics tech (GDD § 2b): cheap, fast, a bit careless.
 * Buys your dead phones for parts (and your biscuits); rings mortified after a
 * sound call that wasn't; warns you about phones off a lorry; asks for a corner
 * of your shop when the city closes her underpass. Specialist numbers:
 * tuning.specialistArcs.
 */
export default {
  id: 'zhenya',
  title: 'Zhenya Kroshkina',
  specialist: 'technician',
  beats: [
    {
      id: 'zhenya.biscuits',
      when: [{ if: 'retainedMonths', id: 'technician', gte: 1 }],
      chance: 0.5,
      visit: {
        who: 'technician',
        kind: 'scene',
        scene: {
          lines: [
            'Hiya. I was passing. Well, I wasn’t, but I am now. Got any dead phones? Clones, wrecks, bricks. I give a proper parts price.',
            'Are those biscuits? I’m having one. …Your radio’s buzzing. Hang on. There. Loose wire. You’re welcome.',
            'Anything dead, I’ll take it now, money’s on the counter. If not, I’ll just eat your biscuits.',
          ],
        },
        after: { talked: { effects: [{ do: 'sellTo', id: 'technician', offer: 'zhenya.parts' }] } },
      },
    },
    {
      // Her first sound call on a phone, camera or laptop that wasn't.
      id: 'zhenya.oops',
      when: [{ if: 'specialistEvent', id: 'technician', event: 'wrongSound' }],
      chance: 0.8,
      visit: {
        who: 'technician',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'It’s Zhenya. Um. That one I said was fine. It wasn’t fine, was it.',
            'I looked at it again in my head. I was eating and talking and I just said “original” because it usually is. Sorry. Really sorry.',
            'Next month’s on me. Or tell me to slow down and I will. Your call.',
          ],
          choices: [
            {
              id: 'free',
              label: 'Take the free month',
              reply: 'Deal. Free month. I’ll look properly next time. Probably.',
              effects: [{ do: 'specialist', id: 'technician', change: 'zhenya.free_month' }],
            },
            {
              id: 'slow',
              label: 'Slow down',
              reply: 'Okay. Okay. Slow. A full minute, every time. I’ll even put my sandwich down. You’ll see.',
              effects: [{ do: 'specialist', id: 'technician', change: 'zhenya.slow_down' }],
            },
          ],
        },
      },
    },
    {
      id: 'zhenya.lorry',
      when: [{ if: 'specialist', id: 'technician', relationship: { gte: 0.4 } }],
      chance: 0.5,
      visit: {
        who: 'technician',
        kind: 'scene',
        via: 'phone',
        scene: {
          lines: [
            'Zhenya. Heads up. A load of good phones fell off a lorry by the port. Mangosteens, big Galaxias. They’re all over the district.',
            'No boxes, no chargers, and the serial sticker on the SIM tray is scratched off. They want cash today and they don’t want to chat.',
            'Buy one if you like, I’m not your mum. But somebody’s going to come asking where they all went.',
          ],
        },
        after: { talked: { effects: [{ do: 'boost', boost: 'lorry_phones' }, { do: 'flag', flag: 'zhenya_warned_phones' }] } },
      },
    },
    {
      id: 'zhenya.desk',
      final: true,
      when: [
        { if: 'beat', beat: 'zhenya.biscuits' },
        { if: 'retainedMonths', id: 'technician', gte: 3 },
      ],
      chance: 0.5,
      visit: {
        who: 'technician',
        kind: 'scene',
        scene: {
          lines: [
            'So. The city’s closing my underpass. “Renovation.” Means a bank. Means I’m out by the end of the month.',
            'You’ve got that corner by the window doing nothing. A desk, a lamp, my soldering iron. I’d pay rent. I’d fix things while people wait, and your phones would sell quicker. People trust a shop with a repair desk.',
            'Yes or no? No pressure. Bit of pressure.',
          ],
          choices: [
            {
              id: 'yes',
              label: 'Yes, take the corner',
              reply: 'Yes! Okay. I’m bringing the kettle. You won’t regret it. You’ll regret the kettle.',
              effects: [{ do: 'specialist', id: 'technician', change: 'zhenya.desk' }, { do: 'flag', flag: 'zhenya_desk' }, { do: 'endArc' }],
            },
            {
              id: 'no',
              label: 'Sorry, no room',
              reply: 'Fair. There’s a kiosk going across the river on Zarechnaya. Bit far for you. My calls’ll be slower, sorry.',
              effects: [{ do: 'specialist', id: 'technician', change: 'zhenya.across_river' }, { do: 'endArc' }],
            },
          ],
        },
      },
    },
  ],
} as const
