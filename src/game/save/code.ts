/**
 * Save code: "LMB1." + base64url(deflate(JSON)) + "." + checksum.
 *
 *   LMB1.<payload>.<checksum>
 *
 * - payload: base64url (no padding) of the max-compression (raw) deflate of the state JSON.
 * - checksum: FNV-1a (32 bit) of "LMB1." + payload, base36, always 7 characters.
 *   A truncated or edited paste fails the checksum instead of loading garbage.
 *
 * Decoding is forgiving about what chat apps and notes apps do to pasted text
 * (spaces, line breaks, smart dashes, quotes or a full stop around the code) but
 * strict about content: anything that does not verify throws SaveCodeError with
 * a message that is safe to show the player.
 *
 * Pure: no DOM, no Node-only APIs (base64url is done by hand).
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import { tuning } from '../../data/tuning'
import type { GameState } from '../state'
import { migrate, SaveFormatError } from './migrations'

export const SAVE_CODE_PREFIX = 'LMB1.'
const CHECKSUM_LEN = 7

export class SaveCodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'SaveCodeError'
  }
}

// --- lean state ---------------------------------------------------------------

/**
 * Drop data that is safe to drop before encoding. Deliberately minimal: the
 * player can copy a code mid-day, so the queue, current visit, inspect/haggle
 * state, today's ledger and the RNG are all kept (the reducer needs them to
 * continue identically). The only trimming is the day-summary history, capped
 * to `tuning.save.historyDays`, which is exactly the cap the reducer applies
 * at every day close, so the trimmed state is one the game could have reached.
 */
export function leanState(state: GameState): GameState {
  const keep = tuning.save.historyDays
  if (state.history.length <= keep) return state
  return { ...state, history: state.history.slice(-keep) }
}

// --- base64url (by hand: works the same in Node and browsers) ----------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const B64_INDEX: Record<string, number> = Object.fromEntries([...B64].map((c, i) => [c, i]))

export function toBase64Url(bytes: Uint8Array): string {
  const out: string[] = []
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0
    const b1 = bytes[i + 1] ?? 0
    const b2 = bytes[i + 2] ?? 0
    const n = (b0 << 16) | (b1 << 8) | b2
    out.push(B64.charAt((n >> 18) & 63), B64.charAt((n >> 12) & 63))
    if (i + 1 < bytes.length) out.push(B64.charAt((n >> 6) & 63))
    if (i + 2 < bytes.length) out.push(B64.charAt(n & 63))
  }
  return out.join('')
}

/** Throws on characters outside the base64url alphabet or an impossible length. */
export function fromBase64Url(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new Error('bad length')
  const out = new Uint8Array(Math.floor((text.length * 3) / 4))
  let o = 0
  for (let i = 0; i < text.length; i += 4) {
    let n = 0
    const chunk = Math.min(4, text.length - i)
    for (let j = 0; j < 4; j++) {
      const v = j < chunk ? B64_INDEX[text.charAt(i + j)] : 0
      if (v === undefined) throw new Error('bad character')
      n = (n << 6) | v
    }
    out[o++] = (n >> 16) & 255
    if (chunk > 2) out[o++] = (n >> 8) & 255
    if (chunk > 3) out[o++] = n & 255
  }
  return out
}

// --- checksum -----------------------------------------------------------------

/** FNV-1a 32-bit over UTF-16 code units (the text is ASCII), base36, zero-padded. */
export function checksum(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36).padStart(CHECKSUM_LEN, '0')
}

// --- encode -------------------------------------------------------------------

export function encodeSaveCode(state: GameState): string {
  const json = JSON.stringify(leanState(state))
  const packed = deflateSync(strToU8(json), { level: 9, mem: 12 })
  const payload = toBase64Url(packed)
  return `${SAVE_CODE_PREFIX}${payload}.${checksum(SAVE_CODE_PREFIX + payload)}`
}

// --- decode -------------------------------------------------------------------

/** Undo what messaging and notes apps do to a pasted code. */
function sanitize(input: string): string {
  return input
    .replace(new RegExp('[\\s\\u200B-\\u200D\\u2060\\uFEFF]+', 'g'), '') // spaces, line breaks, zero-width characters
    .replace(new RegExp('[\\u2010-\\u2015\\u2212]', 'g'), '-') // smart dashes back to hyphen-minus
}

export function decodeSaveCode(code: string): GameState {
  if (typeof code !== 'string') throw new SaveCodeError('Paste a save code first.')
  const text = sanitize(code)
  if (text.length === 0) throw new SaveCodeError('Paste a save code first.')
  if (text.length > tuning.save.maxCodeChars) throw new SaveCodeError('That text is far too long to be a Lombard save code.')

  // Quotes, brackets or a sentence before the code are skipped by searching for the prefix.
  const start = text.toUpperCase().indexOf(SAVE_CODE_PREFIX)
  if (start < 0) throw new SaveCodeError('That does not look like a Lombard save code. It should start with LMB1.')

  const rest = text.slice(start + SAVE_CODE_PREFIX.length)
  const dot = rest.indexOf('.')
  if (dot < 0) throw new SaveCodeError('That save code looks cut off. Copy the whole thing and try again.')
  const payload = rest.slice(0, dot)
  const given = rest.slice(dot + 1, dot + 1 + CHECKSUM_LEN).toLowerCase()
  if (given.length < CHECKSUM_LEN) throw new SaveCodeError('That save code looks cut off. Copy the whole thing and try again.')
  if (checksum(SAVE_CODE_PREFIX + payload) !== given) {
    throw new SaveCodeError('That save code is damaged or incomplete (checksum mismatch). Copy it again and try once more.')
  }

  let json: string
  try {
    const bytes = fromBase64Url(payload)
    const limit = tuning.save.maxInflatedBytes
    const inflated = inflateSync(bytes, { out: new Uint8Array(limit) })
    if (inflated.length >= limit) throw new Error('too large')
    json = strFromU8(inflated)
  } catch (cause) {
    throw new SaveCodeError('That save code could not be unpacked. It may be damaged.', { cause })
  }

  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch (cause) {
    throw new SaveCodeError('That save code unpacked into something unreadable.', { cause })
  }

  try {
    return migrate(raw)
  } catch (cause) {
    if (cause instanceof SaveFormatError && cause.kind === 'future') {
      throw new SaveCodeError('That save code was made by a newer version of Lombard. Update the game and try again.', { cause })
    }
    throw new SaveCodeError('That save code is not a valid Lombard career.', { cause })
  }
}
