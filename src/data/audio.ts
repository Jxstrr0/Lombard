/**
 * Sound presentation data: files, levels, timings (docs/04-ASSETS.md § Audio).
 * Not gameplay numbers, so they live here rather than in tuning.ts.
 *
 * Files are built by art/audio/build.py into public/assets/audio/ and are
 * loudness-matched there (one-shots ≈ −20 LUFS momentary, ambience −26 LUFS
 * integrated), so the gains below are the mix, not a fix for uneven files.
 */
import type { ToolId } from '../game/schema/item'

export const SOUND_IDS = [
  'door_bell',
  'set_down',
  'cash',
  'coins',
  'tool_loupe',
  'tool_magnet',
  'tool_acid',
  'tool_page',
  'tool_switch',
  'tool_scale',
  'tool_phone',
  'ui_tap',
] as const
export type SoundId = (typeof SOUND_IDS)[number]

/** Folder under the site base. Each one-shot is `<id>.mp3`. */
export const AUDIO_DIR = 'assets/audio/'
export const AMBIENCE_FILE = 'ambience.mp3'

/** Per-sound gain (0–1) on top of the effects bus. */
export const SOUND_GAIN: Record<SoundId, number> = {
  door_bell: 0.75,
  set_down: 0.7,
  cash: 0.75,
  coins: 0.7,
  tool_loupe: 0.6,
  tool_magnet: 0.6,
  tool_acid: 0.7,
  tool_page: 0.6,
  tool_switch: 0.55,
  // Pure tones at 3 kHz read much louder than their meter level: keep them low.
  tool_scale: 0.3,
  tool_phone: 0.3,
  ui_tap: 0.35,
}

/** Random pitch spread per play, in cents (±), so repeats don't sound stamped. */
export const SOUND_DETUNE: Partial<Record<SoundId, number>> = {
  set_down: 120,
  coins: 80,
  cash: 60,
  tool_loupe: 80,
  tool_magnet: 80,
  tool_acid: 150,
  tool_page: 100,
  ui_tap: 150,
}

/** Which sound each inspect tool makes (the specialist is a phone call). */
export const TOOL_SOUND: Record<ToolId, SoundId> = {
  loupe: 'tool_loupe',
  scale: 'tool_scale',
  magnet: 'tool_magnet',
  uv: 'tool_switch',
  acid: 'tool_acid',
  reference: 'tool_page',
  phone: 'tool_phone',
  specialist: 'tool_phone',
}

export const AUDIO_MIX = {
  /** Master gain of all one-shots. */
  effects: 0.9,
  /** Ambience bus gain at the "Normal" level. */
  ambience: 0.5,
  /** Seconds each ambience pass fades in and out (passes overlap by this much). */
  ambienceCrossfade: 2.5,
  /** Seconds after the door bell before the customer's item is set down. */
  setDownDelay: 0.9,
  /** Ignore a repeat of the same sound sooner than this (seconds). */
  minRepeat: 0.06,
  /** A button tap is skipped when a state sound started this recently (seconds). */
  tapSuppress: 0.08,
}

/** Ambience level choices in Settings, as a multiplier of AUDIO_MIX.ambience. */
export const AMBIENCE_LEVELS = [
  { value: 0, label: 'Off' },
  { value: 0.5, label: 'Low' },
  { value: 1, label: 'Normal' },
  { value: 1.6, label: 'High' },
] as const

export const DEFAULT_SOUND_SETTINGS = { enabled: true, ambience: 1 }
