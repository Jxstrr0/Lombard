/** Walk-in name and archetype pools (M1). Regulars arrive in M4. */
export const firstNames = [
  'Arkady', 'Boris', 'Dmitri', 'Gennady', 'Igor', 'Kostya', 'Lev', 'Misha', 'Oleg', 'Pavel', 'Roman', 'Sasha',
  'Stas', 'Tolya', 'Vadim', 'Yura', 'Alla', 'Galina', 'Inna', 'Katya', 'Lida', 'Marina', 'Nadia', 'Olga',
  'Polina', 'Raisa', 'Sveta', 'Tanya', 'Vera', 'Zina',
] as const

/** The women's names in `firstNames` (so a walk-in's 3D look matches their name). */
export const femaleFirstNames: ReadonlySet<string> = new Set([
  'Alla', 'Galina', 'Inna', 'Katya', 'Lida', 'Marina', 'Nadia', 'Olga', 'Polina', 'Raisa', 'Sveta', 'Tanya', 'Vera', 'Zina',
])

export interface ArchetypeDef {
  id: string
  label: string
  /** [min, max] knowledge and desperation for this archetype (0–1). */
  knowledge: [number, number]
  desperation: [number, number]
  weight: number
}

export const archetypes: readonly ArchetypeDef[] = [
  { id: 'pensioner', label: 'Pensioner', knowledge: [0.1, 0.5], desperation: [0.5, 0.95], weight: 1.2 },
  { id: 'student', label: 'Student', knowledge: [0.2, 0.6], desperation: [0.4, 0.9], weight: 1 },
  { id: 'tradesman', label: 'Tradesman', knowledge: [0.3, 0.7], desperation: [0.2, 0.6], weight: 1 },
  { id: 'office', label: 'Office worker', knowledge: [0.3, 0.8], desperation: [0.1, 0.5], weight: 1 },
  { id: 'hustler', label: 'Hustler', knowledge: [0.6, 0.95], desperation: [0.05, 0.4], weight: 0.8 },
  { id: 'sailor', label: 'Sailor on leave', knowledge: [0.2, 0.6], desperation: [0.2, 0.7], weight: 0.6 },
]

export const greetings = [
  'Good afternoon.',
  'Hello. Are you buying?',
  'You’re the new owner? Good.',
  'Zdravstvuyte.',
  'Busy today?',
] as const
