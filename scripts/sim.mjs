#!/usr/bin/env node
/**
 * npm run sim [-- --days 60 --seeds 20]
 * Headless economy report for tuning (docs/02-ARCHITECTURE.md § Testing).
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

for (const policy of [policies.careful, policies.careless]) {
  const runs = Array.from({ length: seeds }, (_, i) => sim.simulate(1000 + i, policy, days))
  const s = sim.summarize(runs, start)
  const pct = (x) => `${(x * 100).toFixed(1)}%`
  console.log(
    `${s.policy.padEnd(9)} growth/month ${pct(s.medianGrowth).padStart(7)}  busted ${s.busted}/${s.runs}` +
      `  median bust day ${s.medianBustDay ?? '-'}  median worth ${Math.round(s.medianFinalWorth).toLocaleString('en-US')} ₽` +
      `  fakes bought ${s.avgFakesBought.toFixed(1)}  cash<0 in ${s.cashDips} runs`,
  )
  // Worth curve of the median run, every 10 days.
  const mid = runs.slice().sort((a, b) => a.finalWorth - b.finalWorth)[Math.floor(runs.length / 2)]
  console.log('          worth by day: ' + mid.days.filter((d) => d.day % 10 === 0).map((d) => `${d.day}:${Math.round(d.worth / 1000)}k`).join('  '))
}
