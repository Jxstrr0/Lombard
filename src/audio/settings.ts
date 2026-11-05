/**
 * Sound settings live on the device, not in the career: like the reduce-motion
 * override they are kept in localStorage (settings only) and are not part of
 * the save or the save code.
 */
import { AMBIENCE_LEVELS, DEFAULT_SOUND_SETTINGS } from '../data/audio'

export interface SoundSettings {
  /** All game sound on/off. */
  enabled: boolean
  /** Ambience level, one of AMBIENCE_LEVELS' values (0 = off). */
  ambience: number
}

const SOUND_KEY = 'lombard.sound'
const AMBIENCE_KEY = 'lombard.ambience'

/** Parse stored values; anything missing or unknown falls back to the default. */
export function parseSoundSettings(sound: string | null, ambience: string | null): SoundSettings {
  const level = Number(ambience)
  const known = ambience !== null && AMBIENCE_LEVELS.some((l) => l.value === level)
  return {
    enabled: sound === '1' ? true : sound === '0' ? false : DEFAULT_SOUND_SETTINGS.enabled,
    ambience: known ? level : DEFAULT_SOUND_SETTINGS.ambience,
  }
}

export function loadSoundSettings(): SoundSettings {
  try {
    return parseSoundSettings(localStorage.getItem(SOUND_KEY), localStorage.getItem(AMBIENCE_KEY))
  } catch {
    return parseSoundSettings(null, null)
  }
}

export function saveSoundSettings(s: SoundSettings): void {
  try {
    localStorage.setItem(SOUND_KEY, s.enabled ? '1' : '0')
    localStorage.setItem(AMBIENCE_KEY, String(s.ambience))
  } catch {
    // storage blocked: the choice lasts for this session only
  }
}
