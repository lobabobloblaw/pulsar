/** Cathedral of Gears — the eight-voice piece, ported directly (tools/songs/octet/README.md).
 *
 *  The arrangement is OCTET's and is carried over untouched: VRC6 pulse 1 = the melody
 *  (and pad tones in the intro, B section and coda), VRC6 pulse 2 = wide-duty inner-harmony
 *  chords and pads, VRC6 saw = the bass gallop throughout and the B section's solo lead,
 *  triangle = the saw doubled an octave up, 2A03 pulse 1 = the counter-melody (A sections)
 *  and the `0xy` arpeggio chords (B section), 2A03 pulse 2 = a three-row echo of whichever
 *  line leads, noise = the kit and the coda's `Fxx` ritardando. Speed 6 at tempo 150: a row
 *  is a sixteenth, sixteen rows a bar, four bars a pattern, 88 bars. Nothing is re-voiced;
 *  the duty macros keep their VRC6 values (0–7) because pulsar's VRC6 lanes take them.
 *
 *  ONE correction is made here, and it belongs to the target driver rather than to the
 *  music:
 *
 *  - Loop entry. The final `B02` returns to frame 2 (the first A frame, skipping the
 *    intro), and pulsar's presets state every lane explicitly on that row. Six of the seven
 *    sounding lanes already strike a note there with an instrument and a volume; only 2A03
 *    pulse 2 does not, because the echo lane is silent across the seam — so it gets a cut.
 *    The assertion below pins that list: if the source document ever changes, this comment
 *    fails rather than quietly becoming wrong.
 *
 *  The engine differences shared by every song (the `Axy` nibble swap, the `7xy` tremolo
 *  re-expression, the `100` after a glide or a scoop) are applied by `convert.mjs`, on the
 *  VRC6 lanes exactly as on the 2A03 pulses.
 *
 *  The 2026-09-11 release folded this piece onto four 2A03 lanes because pulsar had no VRC6
 *  yet; docs/soundtrack.md records that arrangement and the commit that holds it.
 *
 *  LEVELS. Eight voices are louder than four: at pulsar's render gain (DEFAULT_MASTER_GAIN
 *  2.0, the app knob at maximum) the two-pass mix measures -16.62 dBFS RMS and its
 *  unclamped peak is 1.1623, so 38 samples out of 13.2 million clamp, in 21 isolated
 *  spots of a few samples each, none more than 1.3 dB over. The source project's own render
 *  of this same document peaks at 0.6063, so this is the render gain meeting the VRC6's
 *  linear headroom (up to 0.625 on top of the 2A03's full-scale mix), not the arrangement.
 *  The piece stays at the composed levels: scaling the volume columns would quantise every
 *  voice onto the 0..15 grid and change their balance, and lowering the core's gain would
 *  quieten every song and live play alike. Instead the song DECLARES the clamp it needs
 *  (`qa.clippedSamplesMax`, gate C), which is honest about the one place it happens: the
 *  knob's top 1.3 dB. At the app's default output (0.72, about 5.7 dB lower) nothing clips.
 */
import { LANE, ensureLoopEntry, expectLanes } from './convert.mjs'

export const id = 'cathedral-of-gears'
export const name = 'Cathedral of Gears'
export const author = 'OCTET demo, rebuilt for pulsar'
export const rowHighlight = 4 // a row is a sixteenth: four to the beat
export const rowHighlight2 = 16 // sixteen to the bar

/** The frame the final `Bxx` returns to (the first A frame; frames 0–1 are the intro). */
const LOOP_FRAME = 2

export function reduce(doc) {
  const written = ensureLoopEntry(doc, LOOP_FRAME, {
    [LANE.P1]: 'cut',
    [LANE.P2]: 'cut',
    [LANE.TRI]: 'cut',
    [LANE.NOISE]: 'cut',
    [LANE.V1]: 'cut',
    [LANE.V2]: 'cut',
    [LANE.SAW]: 'cut',
  })
  expectLanes('loop entry', written, [LANE.P2])
  return doc
}

export const qa = {
  key: 'd-minor',
  accidentalFractionMax: 0.2,
  channels: ['pulse1', 'pulse2', 'triangle', 'noise', 'vrc6p1', 'vrc6p2', 'vrc6saw'],
  effects: ['0', '1', '3', '4', '7', 'A', 'B', 'F', 'Q', 'R'],
  bpmRange: [148, 152],
  durationSec: [135, 155],
  loopFrame: 2,
  percussionGap: 16,
  percussionCoverage: 0.75,
  clippedSamplesMax: 48,
  form: [
    'intro', 'intro',
    'A', 'A', 'A', 'A',
    'A repeat', 'A repeat', 'A repeat', 'A repeat',
    'B', 'B', 'B', 'B',
    "A'", "A'", "A'", "A'",
    'coda', 'coda', 'coda', 'coda',
  ],
  notes:
    'Gothic action theme, 150 BPM, sixteen rows a bar, eight voices. D minor with the harmonic-minor raised seventh (C#) at the cadences and a Phrygian bII chord in the theme; the A-prime section restates the theme a minor third up in F minor and the coda pivots back through Eb, Bb and Gm, which is where the chromatic allowance goes. The VRC6 sawtooth is the bass the whole way through — a driving-sixteenth gallop the triangle doubles an octave up through the loud sections — and takes the lead itself in the B section, alternating a low pedal with a running line and then singing long notes that bend into pitch from a pitch macro. VRC6 pulse 1 carries the melody on a duty macro that opens on the 50% square and settles on a narrow 3/16 pulse, plus the wide organ chords of the intro and coda; VRC6 pulse 2 the reedy 25% inner harmony. The 2A03 pulses answer: pulse 1 the counter-melody and the 0xy arpeggio chords under the solo, pulse 2 a three-row echo of whichever line leads. Noise is the kit and carries the coda Fxx ritardando before Bxx loops back to the A theme. The drums stop where the piece stops them: the intro has two crashes and a snare roll, the coda thins the kit bar by bar and then holds chords under the ritardando, so 22% of the rows sit in a drum-free stretch longer than sixteen rows (percussionCoverage 0.75, percussionGap 16 for the thinning bars). Level: eight voices at the render gain (the output knob at maximum) put the unclamped peak at 1.16, so 38 samples in two passes clamp, in 21 spots of a few samples, none more than 1.3 dB over; the composed levels are kept and the clamp is declared (clippedSamplesMax 48). At the default output nothing clips.',
  renderChecksum: 602407995,
}
