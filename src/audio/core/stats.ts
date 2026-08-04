/** Counters the engine keeps for the diagnostics panel and the soak gates.
 *  Plain numeric fields, incremented in place — nothing here allocates. */
export class ApuStats {
  /** Writes whose timestamp was already in the past; clamped to `apu.cycle`,
   *  never dropped and never reordered. */
  lateWrites = 0
  /** Writes lost because the transport ring was full. Owned by the transport
   *  layer (WP4); the core only ever reports what it is told. */
  droppedWrites = 0
  /** Output samples that hit the ±1 clamp. */
  clippedSamples = 0
  /** Band-limited step edges handed to the delta buffer. */
  deltasEmitted = 0
  /** Channel timer expiries processed by the run loop — the number the perf budget
   *  is written against. Frame-counter steps are counted separately. */
  eventsProcessed = 0
  /** Frame-sequencer steps (quarter/half clocks). Exactly 4 per ~29 830 CPU cycles in
   *  4-step mode, whether or not anything is sounding — the one unit on the chip that
   *  cannot be switched off. */
  frameEvents = 0
  /** Frames the worklet could not fill in time. */
  frameSkips = 0

  reset(): void {
    this.lateWrites = 0
    this.droppedWrites = 0
    this.clippedSamples = 0
    this.deltasEmitted = 0
    this.eventsProcessed = 0
    this.frameEvents = 0
    this.frameSkips = 0
  }
}
