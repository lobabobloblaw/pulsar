/** notes, lanes and the two number bases — the primitives every other module shares.
 *
 *  Nothing here reads a file or holds state: it is arithmetic plus the hardware
 *  boundaries from preset-suite §1 and docs/register-timeline.md "VRC6 lanes", stated
 *  once so `check()` and the composer read the same numbers.
 */

/** Canonical lane indices. Same order as `CANONICAL_CHANNELS` in the model. */
export const L = Object.freeze({ P1: 0, P2: 1, TRI: 2, NOISE: 3, DPCM: 4, V1: 5, V2: 6, SAW: 7 })

export const CHANNELS = Object.freeze([
  'pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw',
])

/** `---` hard cut and `===` release, the model's two out-of-band note sentinels. */
export const CUT = -1
export const REL = -2

export const MAX_NOTE = 119
export const MAX_SEQUENCE_LENGTH = 253
export const MAX_EFFECT_COLUMNS = 4

/** Lanes whose note column is a PITCH. Noise carries a period index and dpcm a key-map
 *  slot; neither belongs in a scale, and the preset lint agrees (`MELODIC`). */
export const MELODIC_LANES = Object.freeze([L.P1, L.P2, L.TRI, L.V1, L.V2, L.SAW])

/** Lowest MIDI note each lane can SOUND. 2A03 pulse: the 11-bit timer saturates at 33.
 *  Triangle: /32, so a1 octave lower. The VRC6's dividers are 12-bit — its pulses reach
 *  21 and its sawtooth, dividing by 14 rather than 16, bottoms out at 24. Both VRC6
 *  numbers are the ones `soundtrack.test.ts` derives from `pitch.ts` at run time. */
export const LANE_FLOOR = Object.freeze({
  [L.P1]: 33, [L.P2]: 33, [L.TRI]: 21, [L.V1]: 21, [L.V2]: 21, [L.SAW]: 24,
})

/** The noise lane's window: `period index = 47 − note`, monotonic, no wrap (§3.4). */
export const NOISE_MIN = 32
export const NOISE_MAX = 47

/** The effect set an album piece may use — types.ts's `SUPPORTED_EFFECTS` minus `Cxx`,
 *  which halts playback and never belongs in a looping piece (§2.9). */
export const ALLOWED_EFFECTS = Object.freeze(
  ['0', '1', '2', '3', '4', '7', 'A', 'B', 'D', 'F', 'G', 'P', 'Q', 'R', 'S', 'V'],
)

/** Effects that LATCH on their channel until a zero param cancels them (§2.9 rule 3):
 *  `0xy` arpeggio, `3xx` portamento, `4xy` vibrato, `7xy` tremolo. `line()` clears these
 *  automatically so a hook does not keep wobbling under the next phrase. */
export const STICKY_EFFECTS = Object.freeze(['0', '3', '4', '7'])

const PITCH_CLASS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const NOTE_RE = /^([a-g])(#|s|b)?(-?\d+)$/

/** `n('c#4')` → 61, `n('c4')` → 60, `n('a4')` → 69, `n('c-1')` → 0 (octave minus one).
 *
 *  Octaves are written WITHOUT a separator, so `c-1` is unambiguous and FamiTracker's
 *  `A-4` spelling is rejected rather than silently read as octave −4. `'---'` is a cut,
 *  `'==='` a release, and a number passes through after a range check. */
export function n(name) {
  if (typeof name === 'number') {
    if (!Number.isInteger(name) || name < REL || name > MAX_NOTE) {
      throw new Error(`n(${name}): not a MIDI note in 0..${MAX_NOTE} (or CUT/REL)`)
    }
    return name
  }
  if (name === '---') return CUT
  if (name === '===') return REL
  const m = NOTE_RE.exec(String(name).trim().toLowerCase())
  if (m === null) {
    throw new Error(`n(${JSON.stringify(name)}): expected a note like "c4", "c#5", "eb3", "c-1", "---" or "==="`)
  }
  const step = m[2] === '#' || m[2] === 's' ? 1 : m[2] === 'b' ? -1 : 0
  const midi = (Number(m[3]) + 1) * 12 + PITCH_CLASS[m[1]] + step
  if (midi < 0 || midi > MAX_NOTE) {
    throw new Error(
      `n(${JSON.stringify(name)}) = ${midi}: outside MIDI 0..${MAX_NOTE}. Octaves take no ` +
        'separator — write "a4", not "A-4"; "c-1" is octave minus one.',
    )
  }
  return midi
}

/** Params on disk are DECIMAL (§1, the album's most likely authoring mistake).
 *  `hex(0x47)` → 71 and `hex('047')` → 71: both spellings of the grid's `047`. */
export function hex(value) {
  const v = typeof value === 'string' ? Number.parseInt(value.trim(), 16) : value
  if (!Number.isInteger(v) || v < 0 || v > 255) {
    throw new Error(`hex(${JSON.stringify(value)}): not an effect param in 0..255`)
  }
  return v
}

/** Two nibbles as one param: `nib(4, 7)` → 71, the `047` major triad. */
export function nib(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 15 || y < 0 || y > 15) {
    throw new Error(`nib(${x}, ${y}): both nibbles must be integers in 0..15`)
  }
  return (x << 4) | y
}

/** Note name for a MIDI number, for report and error messages. Sharps only. */
const NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
export function noteName(midi) {
  if (midi === CUT) return '---'
  if (midi === REL) return '==='
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}
