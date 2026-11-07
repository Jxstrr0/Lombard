/**
 * Plain WebAudio playback: one-shot cues and the shop ambience.
 *
 * Mobile autoplay rules: nothing is created until the first user gesture (main
 * forwards every tap/click/key to `gesture()`), which creates or resumes the
 * AudioContext. Sounds load only after that, never on first page load. The
 * context is suspended while the page is hidden, which pauses the ambience
 * and anything scheduled.
 *
 * The ambience is played as overlapping passes with equal-power fades rather
 * than a native `loop`, so a codec's start/end padding (MP3 encoder delay)
 * never shows up as a gap or click at the seam, whatever the browser decodes.
 *
 * Reads no game state: main feeds it cues from src/audio/cues.ts.
 */
import { AMBIENCE_FILE, AUDIO_DIR, AUDIO_MIX, SOUND_DETUNE, SOUND_GAIN, SOUND_IDS, type SoundId } from '../data/audio'
import type { Cue } from './cues'
import { VOICE_DIR, VOICE_MIX } from '../data/voice'
import type { VoiceCue } from './voice'
import type { SoundSettings } from './settings'

type Ctx = AudioContext

function createContext(): Ctx | null {
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    return new Ctor({ latencyHint: 'interactive' })
  } catch {
    return null
  }
}

/** decodeAudioData with the callback form for older Safari. */
function decode(ctx: Ctx, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined
    p?.then(resolve, reject)
  })
}

export class AudioEngine {
  private ctx: Ctx | null = null
  private effects: GainNode | null = null
  private ambienceBus: GainNode | null = null
  private buffers = new Map<SoundId, AudioBuffer>()
  private ambience: AudioBuffer | null = null
  private loading = false
  private lastPlayed = new Map<SoundId, number>()
  private lastCueAt = -Infinity
  private ambiencePasses: { src: AudioBufferSourceNode; end: number }[] = []
  private ambienceNext = 0
  private ambienceTimer: number | null = null
  private settings: SoundSettings
  /** Voice lines, fetched the first time each is needed (never at load). */
  private voices = new Map<string, Promise<AudioBuffer | null>>()

  constructor(
    private readonly base: string,
    settings: SoundSettings,
  ) {
    this.settings = { ...settings }
    document.addEventListener('visibilitychange', () => this.onVisibility())
    window.addEventListener('pagehide', () => void this.ctx?.suspend().catch(() => {}))
  }

  /** Call from every user gesture: creates/resumes the context while sound is on. */
  gesture(): void {
    if (!this.settings.enabled || document.hidden) return
    if (!this.ctx) {
      this.ctx = createContext()
      if (!this.ctx) return
      this.effects = this.ctx.createGain()
      this.effects.gain.value = AUDIO_MIX.effects
      this.effects.connect(this.ctx.destination)
      this.ambienceBus = this.ctx.createGain()
      this.ambienceBus.gain.value = this.ambienceLevel()
      this.ambienceBus.connect(this.ctx.destination)
    }
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {})
    void this.load()
  }

  apply(settings: SoundSettings): void {
    const was = this.settings
    this.settings = { ...settings }
    if (!this.ctx) return
    if (!settings.enabled) {
      this.stopAmbience()
      void this.ctx.suspend().catch(() => {})
      return
    }
    if (!was.enabled && !document.hidden) void this.ctx.resume().catch(() => {})
    const t = this.ctx.currentTime
    this.ambienceBus?.gain.setTargetAtTime(this.ambienceLevel(), t, 0.15)
    if (this.ambienceLevel() > 0) this.startAmbience()
    else this.stopAmbience()
  }

  play(cues: readonly Cue[]): void {
    const ctx = this.ctx
    if (!ctx || !this.effects || !this.settings.enabled || ctx.state !== 'running') return
    for (const cue of cues) {
      const buf = this.buffers.get(cue.sound)
      if (!buf) continue
      const at = ctx.currentTime + (cue.delay ?? 0)
      const last = this.lastPlayed.get(cue.sound) ?? -Infinity
      if (at - last < AUDIO_MIX.minRepeat) continue
      this.lastPlayed.set(cue.sound, at)
      if (cue.sound !== 'ui_tap') this.lastCueAt = ctx.currentTime
      const src = ctx.createBufferSource()
      src.buffer = buf
      const spread = SOUND_DETUNE[cue.sound] ?? 0
      if (spread > 0 && src.detune) src.detune.value = (Math.random() * 2 - 1) * spread
      const g = ctx.createGain()
      g.gain.value = SOUND_GAIN[cue.sound] * (cue.gain ?? 1)
      src.connect(g).connect(this.effects)
      src.start(at)
    }
  }

  /** Say a voice line (src/audio/voice.ts). Fetched on first use; dropped if it can't load in time. */
  say(cue: VoiceCue | null): void {
    const ctx = this.ctx
    if (!cue || !ctx || !this.effects || !this.settings.enabled) return
    const asked = ctx.currentTime
    let p = this.voices.get(cue.file)
    if (!p) {
      p = fetch(`${this.base}${VOICE_DIR}${cue.file}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.arrayBuffer()
        })
        .then((data) => decode(ctx, data))
        .catch((err: unknown) => {
          console.warn(`[audio] could not load ${cue.file}`, err)
          this.voices.delete(cue.file)
          return null
        })
      this.voices.set(cue.file, p)
    }
    void p.then((buf) => {
      if (!buf || !this.effects || !this.settings.enabled || ctx.state !== 'running') return
      if (ctx.currentTime - asked > VOICE_MIX.maxLate) return
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = ctx.createGain()
      g.gain.value = VOICE_MIX.gain
      src.connect(g).connect(this.effects)
      src.start(Math.max(ctx.currentTime, asked + cue.delay))
      this.lastCueAt = ctx.currentTime
    })
  }

  /** A UI button tap; skipped when the tap already made a state sound (door, tool, cash…). */
  tap(): void {
    const ctx = this.ctx
    if (!ctx) return
    if (ctx.currentTime - this.lastCueAt < AUDIO_MIX.tapSuppress) return
    this.play([{ sound: 'ui_tap' }])
  }

  private ambienceLevel(): number {
    return AUDIO_MIX.ambience * this.settings.ambience
  }

  private async load(): Promise<void> {
    if (this.loading || !this.ctx) return
    this.loading = true
    const ctx = this.ctx
    const fetchBuffer = async (file: string): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(`${this.base}${AUDIO_DIR}${file}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await decode(ctx, await res.arrayBuffer())
      } catch (err) {
        console.warn(`[audio] could not load ${file}`, err)
        return null
      }
    }
    // Small one-shots first (about 70 KB in all), then the ambience.
    await Promise.all(
      SOUND_IDS.map(async (id) => {
        const b = await fetchBuffer(`${id}.mp3`)
        if (b) this.buffers.set(id, b)
      }),
    )
    this.ambience = await fetchBuffer(AMBIENCE_FILE)
    if (this.settings.enabled && this.ambienceLevel() > 0) this.startAmbience()
  }

  private startAmbience(): void {
    const ctx = this.ctx
    if (!ctx || !this.ambience || this.ambienceTimer !== null) return
    this.ambienceNext = ctx.currentTime + 0.05
    this.scheduleAmbience()
    this.ambienceTimer = window.setInterval(() => this.scheduleAmbience(), 1000)
  }

  private stopAmbience(): void {
    if (this.ambienceTimer !== null) window.clearInterval(this.ambienceTimer)
    this.ambienceTimer = null
    const ctx = this.ctx
    for (const p of this.ambiencePasses) {
      try {
        p.src.stop(ctx ? ctx.currentTime + 0.3 : 0)
      } catch {
        // already stopped
      }
    }
    this.ambiencePasses = []
  }

  /** Keep passes queued about 3 s ahead; each fades in while the previous fades out. */
  private scheduleAmbience(): void {
    const ctx = this.ctx
    const buf = this.ambience
    if (!ctx || !buf || !this.ambienceBus) return
    const now = ctx.currentTime
    this.ambiencePasses = this.ambiencePasses.filter((p) => p.end > now)
    const fade = Math.min(AUDIO_MIX.ambienceCrossfade, buf.duration / 4)
    const curve = new Float32Array(64)
    for (let i = 0; i < curve.length; i++) curve[i] = Math.sin((i / (curve.length - 1)) * (Math.PI / 2))
    const out = curve.slice().reverse()
    while (this.ambienceNext < now + 3) {
      const t = Math.max(this.ambienceNext, now + 0.02)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = ctx.createGain()
      g.gain.setValueCurveAtTime(curve, t, fade)
      g.gain.setValueCurveAtTime(out, t + buf.duration - fade, fade)
      src.connect(g).connect(this.ambienceBus)
      src.start(t)
      src.stop(t + buf.duration)
      this.ambiencePasses.push({ src, end: t + buf.duration })
      this.ambienceNext = t + buf.duration - fade
    }
  }

  private onVisibility(): void {
    if (!this.ctx) return
    if (document.hidden) void this.ctx.suspend().catch(() => {})
    else if (this.settings.enabled) void this.ctx.resume().catch(() => {})
  }
}
