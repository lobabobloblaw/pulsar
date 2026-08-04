/** NTSC master clock: 236.25 MHz / 11. */
export const NTSC_MASTER_HZ = 236_250_000 / 11

/** NTSC CPU clock = master / 12 (≈ 1 789 772.727 Hz). The canonical integer value
 *  1 789 773 is used everywhere; register-write timestamps, frame-counter events,
 *  and the noise/DMC period tables are all natively in CPU cycles. */
export const NTSC_CPU_HZ = 1_789_773

/** PAL CPU clock (2A07): 26 601 712.5 / 16. */
export const PAL_CPU_HZ = 1_662_607

/** Pulse, noise and DMC timers are clocked every SECOND CPU cycle; the triangle
 *  is clocked every CPU cycle. One timeline, one unit — no conversions anywhere. */
export const APU_TIMER_DIVIDER = 2

/** Widest value an 11-bit channel timer can hold. */
export const MAX_TIMER = 0x7ff

/** A pulse channel is muted below this timer period (highest audible pulse is
 *  t = 8 → 12 429.0 Hz). Muting applies regardless of the sweep unit's enable
 *  and shift fields. */
export const PULSE_MIN_TIMER = 8

/** Highest volume / envelope level. */
export const MAX_VOLUME = 15

/** Register block. */
export const REG_BASE = 0x4000
export const REG_LAST = 0x4017
export const REG_STATUS = 0x4015
export const REG_FRAME_COUNTER = 0x4017

/** Analog output section (rate-agnostic — coefficients derive from the sample rate).
 *  NES: HP 90 Hz → HP 440 Hz → LP 14 kHz. Famicom: a single HP 37 Hz. */
export const NES_HP1_HZ = 90
export const NES_HP2_HZ = 440
export const NES_LP_HZ = 14_000
export const FAMICOM_HP_HZ = 37

/** The LUT mixer's swing is 0 → ~1.0 before DC removal; once the high-passes strip
 *  the DC it becomes roughly ±0.5, so 2.0 restores full scale. */
export const DEFAULT_MASTER_GAIN = 2.0

/** Fallback used only when no context sample rate is known yet. Never forced onto
 *  an AudioContext — the worklet reads the real `sampleRate` global (deviation D8). */
export const DEFAULT_SAMPLE_RATE = 48_000

/** Render quantum of the Web Audio API. */
export const RENDER_QUANTUM = 128
