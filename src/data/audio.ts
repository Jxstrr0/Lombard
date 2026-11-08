/**
 * Sound presentation data: files, levels, timings (docs/04-ASSETS.md § Audio).
 * Not gameplay numbers, so they live here rather than in tuning.ts.
 *
 * Files are built by art/audio/build.py into public/assets/audio/ and are
 * loudness-matched there (one-shots ≈ −20 LUFS momentary, ambience −26 LUFS
 * integrated), so the gains below are the mix, not a fix for uneven files.
 */
import type { Category, ToolId } from '../game/schema/item'
import type { FloodPhase } from '../game/city/flood'

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

/**
 * ElevenLabs sound effects (Nov 2026), in `AUDIO_DIR` + `LAZY_DIR`: never in the
 * first-tap preload (the first load is near its 15 MB budget). Each is fetched
 * the first time its cue fires, or ahead of time when its context starts
 * (prefetchFor in src/audio/cues.ts).
 */
export const LAZY_SOUND_IDS = [
  'door_close',
  'phone_ring',
  'stamp',
  'shutter_up',
  'shutter_down',
  'newspaper',
  'watch_wind',
  'camera_shutter',
  'tram_bell',
] as const
export type LazySoundId = (typeof LAZY_SOUND_IDS)[number]
export type SoundId = (typeof SOUND_IDS)[number] | LazySoundId

/** Folder under the site base. Each one-shot is `<id>.mp3`. */
export const AUDIO_DIR = 'assets/audio/'
export const AMBIENCE_FILE = 'ambience.mp3'
/** Subfolder of AUDIO_DIR for the lazily loaded sounds and beds (not counted in the first load). */
export const LAZY_DIR = 'lazy/'

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
  door_close: 0.55,
  // A real phone bell is loud: keep it below the door bell.
  phone_ring: 0.45,
  stamp: 0.7,
  shutter_up: 0.5,
  shutter_down: 0.5,
  newspaper: 0.55,
  // Inspect flavour: quiet, under the tool sounds.
  watch_wind: 0.3,
  camera_shutter: 0.45,
  // Far off, through the glass.
  tram_bell: 0.22,
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
  door_close: 60,
  stamp: 80,
  newspaper: 80,
  camera_shutter: 60,
  tram_bell: 100,
}

/** Inspecting an item of these categories makes a small sound, once per inspect. */
export const INSPECT_SOUND: Partial<Record<Category, LazySoundId>> = {
  watches: 'watch_wind',
  cameras: 'camera_shutter',
}

/**
 * Beds layered under the ambience (same bus, so the ambience level setting
 * covers them), faded in and out as their context comes and goes.
 */
export const BEDS = {
  /** Rain on the street and the window while the street shows rain. */
  rain: { file: 'rain_loop.mp3', gain: 0.75 },
  /** Canal water standing in the shop on the Flood's days. */
  flood: { file: 'flood_loop.mp3', gain: 0.9 },
} as const
export type BedId = keyof typeof BEDS

/** Rain bed level: base + range × the day's rain intensity (0–1). */
export const RAIN_BED = { base: 0.55, range: 0.45 }
/** Flood bed level by the Flood's phase, following the water render/life/flood.ts draws (none while it dries). */
export const FLOOD_BED: Partial<Record<FloodPhase, number>> = { flood: 1, receding: 0.6 }

/** A distant tram during open hours: real seconds between passes (seeded per day), and its first wait. */
export const TRAM = { first: [45, 120] as const, gap: [150, 330] as const }

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
  /** M5: a page turned in the passport book. */
  passport: 'tool_page',
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
  /** A pawn: the ticket is stamped first, the cash drawer this much later (and a little softer). */
  pawnCashDelay: 0.6,
  pawnCashGain: 0.8,
  /** Seconds after the item is picked up before its inspect sound (the camera is moving in). */
  inspectSoundDelay: 0.45,
  /** The paper is unfolded this long after the shutter starts going up. */
  newspaperDelay: 1.6,
  /** Seconds a bed takes to fade in or out (time constant × 3 ≈ this). */
  bedFade: 2.5,
  /** A lazily loaded cue that arrives later than this after it was asked for is dropped. */
  lazyMaxLate: 1.2,
  /** A door close waiting for the walk-out is dropped after this many seconds. */
  doorCloseTimeout: 12,
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
