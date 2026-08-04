/** NTSC master clock: 236.25 MHz / 11. */
export const NTSC_MASTER_HZ = 236_250_000 / 11

/** NTSC CPU clock = master / 12 (≈ 1 789 772.727 Hz). The canonical integer value
 *  1 789 773 is used everywhere; register-write timestamps, frame-counter events,
 *  and the noise/DMC period tables are all natively in CPU cycles. */
export const NTSC_CPU_HZ = 1_789_773

/** PAL CPU clock (2A07): 26 601 712.5 / 16. */
export const PAL_CPU_HZ = 1_662_607
