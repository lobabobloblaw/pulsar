/**
 * NES 2C02 master palette — pinned 2026-08-03.
 *
 * The 2C02 PPU has no RGB palette in silicon; it emits NTSC composite video, so every
 * "NES palette" in circulation is one decoding choice. These 64 values are the pinned
 * table for PULSAR: cross-emulator sRGB drift (Nestopia/FCEUX/Mesen differ by a few
 * units per channel) is cosmetic and deliberately not chased.
 *
 * `NES_2C02` — all 64 hardware entries, in hardware index order ($00..$3F).
 * `NES_2C02_QUANT` — the 55 entries usable as a quantization target: $0D
 * (blacker-than-black, illegal on real hardware) and the eight duplicate blacks
 * ($0E $0F $1E $1F $2E $2F $3E $3F) are dropped; $1D is kept as true black.
 *
 * DUPLICATED BY DESIGN: `tools/assets/pixelize.py` carries byte-identical copies of both
 * lists so the Python asset pipeline needs no JS runtime. `tests/unit/paletteDrift.test.ts`
 * parses both files and fails if they ever diverge.
 */

/** All 64 2C02 entries, hardware index order $00..$3F. */
export const NES_2C02: readonly string[] = [
  // $00..$0F
  '#545454', '#001E74', '#081090', '#300088',
  '#440064', '#5C0030', '#540400', '#3C1800',
  '#202A00', '#083A00', '#004000', '#003C00',
  '#00323C', '#000000', '#000000', '#000000',
  // $10..$1F
  '#989698', '#084CC4', '#3032EC', '#5C1EE4',
  '#8814B0', '#A01464', '#982220', '#783C00',
  '#545A00', '#287200', '#087C00', '#007628',
  '#006678', '#000000', '#000000', '#000000',
  // $20..$2F
  '#ECEEEC', '#4C9AEC', '#787CEC', '#B062EC',
  '#E454EC', '#EC58B4', '#EC6A64', '#D48820',
  '#A0AA00', '#74C400', '#4CD020', '#38CC6C',
  '#38B4CC', '#3C3C3C', '#000000', '#000000',
  // $30..$3F
  '#ECEEEC', '#A8CCEC', '#BCBCEC', '#D4B2EC',
  '#ECAEEC', '#ECAED4', '#ECB4B0', '#E4C490',
  '#CCD278', '#B4DE78', '#A8E290', '#98E2B4',
  '#A0D6E4', '#A0A2A0', '#000000', '#000000',
]

/** The 55 quantization-safe entries ($0D and the eight duplicate blacks removed). */
export const NES_2C02_QUANT: readonly string[] = [
  // $00..$0C
  '#545454', '#001E74', '#081090', '#300088',
  '#440064', '#5C0030', '#540400', '#3C1800',
  '#202A00', '#083A00', '#004000', '#003C00',
  '#00323C',
  // $10..$1D
  '#989698', '#084CC4', '#3032EC', '#5C1EE4',
  '#8814B0', '#A01464', '#982220', '#783C00',
  '#545A00', '#287200', '#087C00', '#007628',
  '#006678', '#000000',
  // $20..$2D
  '#ECEEEC', '#4C9AEC', '#787CEC', '#B062EC',
  '#E454EC', '#EC58B4', '#EC6A64', '#D48820',
  '#A0AA00', '#74C400', '#4CD020', '#38CC6C',
  '#38B4CC', '#3C3C3C',
  // $30..$3D
  '#ECEEEC', '#A8CCEC', '#BCBCEC', '#D4B2EC',
  '#ECAEEC', '#ECAED4', '#ECB4B0', '#E4C490',
  '#CCD278', '#B4DE78', '#A8E290', '#98E2B4',
  '#A0D6E4', '#A0A2A0',
]
