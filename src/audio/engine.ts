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
 * The beds (rain, flood water) play the same way on the same bus, each with
 * its own gain faded in and out as main.ts asks (bedsFor in cues.ts).
 *
 * The ElevenLabs effects (LAZY_SOUND_IDS) and the beds are not in the first-tap
 * preload: each is fetched when first asked for, or ahead via prefetch(), and
 * a cue whose sound arrives too late is dropped.
 *
 * Reads no game state: main feeds it cues from src/audio/cues.ts.
 */
import {
  AMBIENCE_FILE,
  AUDIO_DIR,
  AUDIO_MIX,
  BEDS,
  LAZY_DIR,
  LAZY_SOUND_IDS,
  SOUND_DETUNE,
  SOUND_GAIN,
  SOUND_IDS,
  type BedId,
  type SoundId,
} from '../data/audio'
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

const LAZY: ReadonlySet<SoundId> = new Set(LAZY_SOUND_IDS)

/**
 * A looping bed on the ambience bus: overlapping passes with equal-power fades,
 * kept queued about 3 s ahead, behind its own gain so it can fade in and out.
 */
class Bed {
  private buffer: AudioBuffer | null = null
  private loading: Promise<void> | null = null
  private passes: { src: AudioBufferSourceNode; end: number }[] = []
  private next = 0
  private running = false
  private level = 0
  private stopTimer: number | null = null
  private readonly out: GainNode

  constructor(
    private readonly ctx: Ctx,
    bus: GainNode,
    private readonly load: () => Promise<AudioBuffer | null>,
    private readonly gain: number,
  ) {
    this.out = ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(bus)
  }

  /** Fade towards `level` (0–1); 0 stops the passes once faded out. */
  set(level: number): void {
    if (level === this.level && (level === 0 || this.running || this.loading)) return
    this.level = level
    this.out.gain.setTargetAtTime(level * this.gain, this.ctx.currentTime, AUDIO_MIX.bedFade / 3)
    if (level > 0) {
      if (this.stopTimer !== null) window.clearTimeout(this.stopTimer)
      this.stopTimer = null
      if (this.buffer) this.start()
      else if (!this.loading) {
        this.loading = this.load().then((b) => {
          this.buffer = b
          this.loading = null
          if (this.level > 0) this.start()
        })
      }
    } else if (this.running && this.stopTimer === null) {
      this.stopTimer = window.setTimeout(() => {
        this.stopTimer = null
        if (this.level === 0) this.stop()
      }, AUDIO_MIX.bedFade * 1000 + 300)
    }
  }

  /** Stop at once (sound off, ambience off); a later set() starts it again. */
  halt(): void {
    this.level = 0
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1)
    this.stop()
  }

  tick(): void {
    if (!this.running || !this.buffer) return
    const ctx = this.ctx
    const buf = this.buffer
    const now = ctx.currentTime
    this.passes = this.passes.filter((p) => p.end > now)
    const fade = Math.min(AUDIO_MIX.ambienceCrossfade, buf.duration / 4)
    const curve = new Float32Array(64)
    for (let i = 0; i < curve.length; i++) curve[i] = Math.sin((i / (curve.length - 1)) * (Math.PI / 2))
    const out = curve.slice().reverse()
    while (this.next < now + 3) {
      const t = Math.max(this.next, now + 0.02)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = ctx.createGain()
      g.gain.setValueCurveAtTime(curve, t, fade)
      g.gain.setValueCurveAtTime(out, t + buf.duration - fade, fade)
      src.connect(g).connect(this.out)
      src.start(t)
      src.stop(t + buf.duration)
      this.passes.push({ src, end: t + buf.duration })
      this.next = t + buf.duration - fade
    }
  }

  private start(): void {
    if (this.running || !this.buffer) return
    this.running = true
    this.next = this.ctx.currentTime + 0.05
    this.tick()
  }

  private stop(): void {
    this.running = false
    if (this.stopTimer !== null) window.clearTimeout(this.stopTimer)
    this.stopTimer = null
    for (const p of this.passes) {
      try {
        p.src.stop(this.ctx.currentTime + 0.3)
      } catch {
        // already stopped
      }
    }
    this.passes = []
  }
}

export class AudioEngine {
  private ctx: Ctx | null = null
  private effects: GainNode | null = null
  private ambienceBus: GainNode | null = null
  private buffers = new Map<SoundId, AudioBuffer>()
  private loading = false
  /** The first-tap preload (one-shots, then the ambience) has finished. */
  private preloaded = false
  /** Lazily loaded sounds, fetched on first use or prefetch (never in the preload). */
  private lazy = new Map<SoundId, Promise<AudioBuffer | null>>()
  private wantPrefetch: readonly SoundId[] = []
  private lastPlayed = new Map<SoundId, number>()
  private lastCueAt = -Infinity
  /** The shop ambience and the beds (all on the ambience bus). */
  private ambience: Bed | null = null
  private beds: Partial<Record<BedId, Bed>> = {}
  private bedLevels: Record<BedId, number> = { rain: 0, flood: 0 }
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

  /** Which beds should play and how loud (bedsFor in cues.ts); faded, fetched on first need. */
  setBeds(levels: Record<BedId, number>): void {
    this.bedLevels = { ...levels }
    if (this.ambienceTimer !== null) this.applyBeds()
  }

  /** Fetch these lazily loaded sounds ahead of their cue (after the first-tap preload). */
  prefetch(ids: readonly SoundId[]): void {
    this.wantPrefetch = ids
    if (!this.ctx || !this.preloaded || !this.settings.enabled) return
    for (const id of ids) if (LAZY.has(id) && !this.buffers.has(id)) void this.lazyBuffer(id)
  }

  play(cues: readonly Cue[]): void {
    const ctx = this.ctx
    if (!ctx || !this.effects || !this.settings.enabled || ctx.state !== 'running') return
    for (const cue of cues) {
      const buf = this.buffers.get(cue.sound)
      if (buf) {
        this.start(cue, buf, ctx.currentTime + (cue.delay ?? 0))
        continue
      }
      if (!LAZY.has(cue.sound)) continue
      // Not fetched yet: fetch it now and play it if it arrives in time.
      const asked = ctx.currentTime
      void this.lazyBuffer(cue.sound).then((b) => {
        if (!b || !this.settings.enabled || ctx.state !== 'running') return
        if (!cue.lateOk && ctx.currentTime - asked > AUDIO_MIX.lazyMaxLate) return
        this.start(cue, b, Math.max(ctx.currentTime, asked + (cue.delay ?? 0)))
      })
    }
  }

  private start(cue: Cue, buf: AudioBuffer, at: number): void {
    const ctx = this.ctx
    if (!ctx || !this.effects) return
    const last = this.lastPlayed.get(cue.sound) ?? -Infinity
    if (at - last < AUDIO_MIX.minRepeat) return
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

  private lazyBuffer(id: SoundId): Promise<AudioBuffer | null> {
    let p = this.lazy.get(id)
    if (!p) {
      p = this.fetchBuffer(`${LAZY_DIR}${id}.mp3`).then((b) => {
        if (b) this.buffers.set(id, b)
        else this.lazy.delete(id) // try again next time
        return b
      })
      this.lazy.set(id, p)
    }
    return p
  }

  private async fetchBuffer(file: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx
    if (!ctx) return null
    try {
      const res = await fetch(`${this.base}${AUDIO_DIR}${file}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await decode(ctx, await res.arrayBuffer())
    } catch (err) {
      console.warn(`[audio] could not load ${file}`, err)
      return null
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
    if (this.loading || !this.ctx || !this.ambienceBus) return
    this.loading = true
    const ctx = this.ctx
    const bus = this.ambienceBus
    // Small one-shots first (about 70 KB in all), then the ambience. The lazy sounds wait.
    await Promise.all(
      SOUND_IDS.map(async (id) => {
        const b = await this.fetchBuffer(`${id}.mp3`)
        if (b) this.buffers.set(id, b)
      }),
    )
    const ambience = await this.fetchBuffer(AMBIENCE_FILE)
    this.ambience = new Bed(ctx, bus, () => Promise.resolve(ambience), 1)
    for (const id of Object.keys(BEDS) as BedId[]) {
      this.beds[id] = new Bed(ctx, bus, () => this.fetchBuffer(`${LAZY_DIR}${BEDS[id].file}`), BEDS[id].gain)
    }
    this.preloaded = true
    if (this.settings.enabled && this.ambienceLevel() > 0) this.startAmbience()
    this.prefetch(this.wantPrefetch)
  }

  private startAmbience(): void {
    if (!this.ambience || this.ambienceTimer !== null) return
    this.ambience.set(1)
    this.applyBeds()
    this.ambienceTimer = window.setInterval(() => {
      this.ambience?.tick()
      for (const b of Object.values(this.beds)) b.tick()
    }, 1000)
  }

  private applyBeds(): void {
    for (const id of Object.keys(this.beds) as BedId[]) this.beds[id]?.set(this.bedLevels[id])
  }

  private stopAmbience(): void {
    if (this.ambienceTimer !== null) window.clearInterval(this.ambienceTimer)
    this.ambienceTimer = null
    this.ambience?.halt()
    for (const b of Object.values(this.beds)) b.halt()
  }

  private onVisibility(): void {
    if (!this.ctx) return
    if (document.hidden) void this.ctx.suspend().catch(() => {})
    else if (this.settings.enabled) void this.ctx.resume().catch(() => {})
  }
}
