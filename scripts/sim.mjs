#!/usr/bin/env node
/**
 * npm run sim [-- --days 60 --seeds 20]
 * Headless economy report for tuning (docs/02-ARCHITECTURE.md § Testing), with each policy's
 * evictions and ending titles (M5; runs of tuning.endings.retireDay days or more retire at the end).
 * Loads the TypeScript sources through Vite's module runner.
 */
import { runnerImport } from 'vite'

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? Number(process.argv[i + 1]) : dflt
}
const days = arg('days', 60)
const seeds = arg('seeds', 20)

const { module: sim } = await runnerImport('/src/sim/simulate.ts')
const { module: policies } = await runnerImport('/src/sim/policies.ts')
const { module: tuningMod } = await runnerImport('/src/data/tuning.ts')
const start = tuningMod.tuning.career.startingCash

// careful refuses the crew, so it is also the refuser (Protection ladder on). "trade" is the
// same policy with the ladder held off: the M2 band (tests/sim.test.ts, docs/05). `trader`
// (M5 endings calibration) opens lower and pays the crew.
const lines = [
  [policies.careful, {}, 'careful'],
  [policies.careful, { protectionLadder: false }, 'trade'],
  [policies.fenceFriend, {}, 'fence'],
  [policies.mobFriendly, {}, 'mobFriendly'],
  [policies.careless, {}, 'careless'],
  [policies.trader, {}, 'trader'],
]
for (const [policy, options, label] of lines) {
  const runs = Array.from({ length: seeds }, (_, i) => sim.simulate(1000 + i, policy, days, options))
  const s = sim.summarize(runs, start)
  const pct = (x) => `${(x * 100).toFixed(1)}%`
  const mean = (f) => (runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(2)
  console.log(
    `${label.padEnd(11)} growth/month ${pct(s.medianGrowth).padStart(7)}  busted ${s.busted}/${s.runs}` +
      `  median bust day ${s.medianBustDay ?? '-'}  median worth ${Math.round(s.medianFinalWorth).toLocaleString('en-US')} ₽` +
      `  fakes bought ${s.avgFakesBought.toFixed(1)}  stolen ${s.avgStolen.toFixed(1)}  cash<0 in ${s.cashDips} runs`,
  )
  // M5 endings: how the careers ended (a shop still open at the end retires if it may) and their titles.
  const evictDays = runs.filter((r) => r.end?.kind === 'evicted').map((r) => r.end.day)
  console.log(
    `          evicted ${s.evicted}/${s.runs}${evictDays.length ? ` (days ${Math.min(...evictDays)}–${Math.max(...evictDays)})` : ''}` +
      `  titles: ${Object.entries(s.titles).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ') || '— (too early to retire)'}`,
  )
  // Worth curve of the median run, every 10 days.
  const mid = runs.slice().sort((a, b) => a.finalWorth - b.finalWorth)[Math.floor(runs.length / 2)]
  console.log('          worth by day: ' + mid.days.filter((d) => d.day % 10 === 0).map((d) => `${d.day}:${Math.round(d.worth / 1000)}k`).join('  '))
  // Regulars (M4): visits per regular over the whole run, averaged across seeds.
  const ids = [...new Set(runs.flatMap((r) => Object.keys(r.customers)))].sort()
  const avg = (id) => runs.reduce((a, r) => a + (r.customers[id]?.visits ?? 0), 0) / runs.length
  console.log(`          regular visits in ${days} days: ` + ids.map((id) => `${id} ${avg(id).toFixed(1)}`).join('  '))
  // M5: the crime dials and the ending axes, averaged across seeds.
  console.log(
    `          dials: heat ${mean((r) => r.crime.heat)}  pressure ${mean((r) => r.crime.pressure)}  clean ${mean((r) => r.axes.clean)}  heart ${mean((r) => r.axes.heart)}`,
  )
  // M5 the fence (Venya Mostovoy).
  console.log(
    `          fence: met ${runs.filter((r) => r.crime.fence.met).length}/${runs.length}  deals ${mean((r) => r.crime.fence.deals)}` +
      `  refusals ${mean((r) => r.crime.fence.refusals)}  trust ${mean((r) => r.crime.fenceTrust)}`,
  )
  // M5 Protection: the crew's side of the ledger.
  const ends = runs.filter((r) => r.end).map((r) => `${r.seed}:${r.end.kind}@${r.end.day}`)
  console.log(
    `          crew: bricks ${mean((r) => r.crew.bricks)}  glaziers ${mean((r) => r.crew.glaziers)}  insurance ₽${mean((r) => r.crew.insurance)}` +
      `  deliveries ${mean((r) => r.crew.deliveries)}  ended ${ends.length ? ends.join(' ') : '-'}`,
  )
  // M5 police: Volkova's visits, pieces she or a raid took, raids, shutdowns.
  console.log(
    `          police: Volkova visits ${mean((r) => r.police.visits)}  seized ${mean((r) => r.police.seized)}  raided ${runs.filter((r) => r.police.raids > 0).length}/${runs.length}` +
      `  shut ${runs.filter((r) => r.police.shut).length}/${runs.length}  bribes ${mean((r) => r.crime.volkova.bribes)}  lies ${mean((r) => r.crime.volkova.lies)}`,
  )
}
