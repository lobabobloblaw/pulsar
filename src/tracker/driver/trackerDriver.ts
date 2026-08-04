/** TrackerDriver — the phase-2 write producer (design §2).
 *
 *  A main-thread tick scheduler that turns a `Song` into timestamped register writes
 *  on the one timeline everything else already uses. It holds no DOM types, no
 *  AudioContext and no Svelte: it is constructed with a `WriteSink` and a clock, which
 *  is what lets the SAME object drive live playback, the offline renderer (§5.4) and
 *  every unit test. If profiling ever demands it, this class moves to a worker
 *  unchanged — its only environment coupling is the pump, which lives in the bridge.
 *
 *  Threading (§2.1): `EngineHandle` remains the one and only ring producer. The driver
 *  and `LiveScheduler` are two CALLERS of it on one thread, and `PlaybackCoordinator`
 *  below guarantees exactly one of them owns the timeline during any interval — Rule L.
 *  Two call sites on one thread are not two producers; what the ring genuinely demands
 *  is non-decreasing cycle order, and the handoff buys that explicitly.
 *
 *  Drift (§2.2): `cycleOfTick(n)` is a CLOSED FORM of the tick index, so a main-thread
 *  stall produces a short burst of late writes (which `Apu2A03` clamps and counts,
 *  never drops, never reorders) and playback is immediately back in phase. A stall is
 *  a stutter, never a tempo error.
 *
 *  Allocation (§2.7): nothing on the per-tick path allocates. Per-channel state lives
 *  in preallocated typed arrays and patterns are compiled on load into dense
 *  `Int32Array`s, so a row read is an offset and never a search or an object.
 */
import {
  CANONICAL_CHANNELS,
  NOTE_CUT,
  NOTE_NONE,
  NOTE_RELEASE,
  emptySong,
  type Song,
} from '../model/types'
import {
  CMD_SLOTS,
  FX_ARPEGGIO,
  FX_CUT,
  FX_DELAY,
  FX_DUTY,
  FX_FINE_PITCH,
  FX_HALT,
  FX_JUMP,
  FX_NOTE_SLIDE_DOWN,
  FX_NOTE_SLIDE_UP,
  FX_PORTAMENTO,
  FX_SKIP,
  FX_SLIDE_DOWN,
  FX_SLIDE_UP,
  FX_SPEED,
  FX_TREMOLO,
  FX_VIBRATO,
  FX_VOLUME_SLIDE,
  LANE_FX0,
  LANE_INST,
  LANE_NOTE,
  LANE_VOL,
  LANES,
  MAX_FX,
  cmdChar,
  compileSong,
  type CompiledSong,
} from '../model/compile'
import {
  ARP_FIXED,
  ARP_RELATIVE,
  MACRO_ARPEGGIO,
  MACRO_DUTY,
  MACRO_HI_PITCH,
  MACRO_PITCH,
  MACRO_VOLUME,
  MacroEngine,
  compileMacros,
} from './macros'
import {
  CHAN_VOL_SCALE,
  MAX_CHAN_VOL8,
  MEMORY_COMMANDS,
  MIN_PULSE_PERIOD,
  MIN_TRIANGLE_PERIOD,
  OFF_ON_ZERO_COMMANDS,
  VIB_ACC_MASK,
  arpeggioOffset,
  clampNoiseIndex,
  clampPeriod,
  composeVolume,
  finePitchOffset,
  noteSlideStep,
  vibratoValue,
  volumeSlideStep,
} from './effects'
import { RegisterFile, SWEEP_OFF } from './registers'
import { RowAccumulator, cycleOfTick } from './tempo'
import { NTSC_CPU_HZ } from '../../audio/core/constants'
import { pulseTimerForMidi, triangleTimerForMidi } from '../../audio/host/pitch'
import { msToCycles } from '../../audio/timeline/clockMap'
import type { NesCycle, WriteSink } from '../../audio/timeline/types'

export type PlayMode = 'song' | 'pattern' | 'row'

export interface DriverClock {
  readonly clockRate: number
  /** Current position on the engine timeline. Offline renderers return their own. */
  nowCycle(): NesCycle
}

export interface DriverPosition {
  readonly playing: boolean
  readonly orderIndex: number
  readonly row: number
  readonly tick: number // tick within the row
  readonly tickIndex: number // absolute, since play start
  readonly bpm: number
  /** Per-channel 0..15 composed volume, for the grid's channel meters. */
  readonly levels: Int32Array
}

/** The same object, typed mutable — the driver writes it, the grid reads it in rAF.
 *  A plain object, deliberately NOT `$state` (phase-1 rule: the frame loop must not
 *  write reactive state). */
export interface MutableDriverPosition {
  playing: boolean
  orderIndex: number
  row: number
  tick: number
  tickIndex: number
  bpm: number
  levels: Int32Array
}

export interface DriverStats {
  ticksGenerated: number
  writesEmitted: number
  lateTicks: number
  rowsPlayed: number
  /** Note triggers emitted. Preset gate C asserts on this (§5.5). */
  noteOns: number
  /** Times the order walk returned to or before its starting frame. */
  loops: number
}

/** How far ahead of `nowCycle()` playback starts, so the handoff cannot land in the
 *  past on a busy main thread (design §2.6). */
export const START_LATENCY_MS = 40

/** Every allocation is sized for the canonical five lanes, so a song with fewer
 *  channels never forces a re-allocation and `loadSong` stays a compile + rebind. */
const MAX_CHANNELS = CANONICAL_CHANNELS.length

/** Rows of history the record sink can map an input timestamp back onto. 256 rows at
 *  6 ticks and 60 Hz is ~25 s — far more than any human reaction window. */
const ROW_LOG_CAPACITY = 256

/** Noise "pitch": the `$400E` period index, inverted so a rising keyboard is a rising
 *  pitch. **[ours]** — no licence-safe source documents FamiTracker's noise key map.
 *  Written down in docs/register-timeline.md so preset authors can aim: the design's
 *  suggested kit lands on ordinary MIDI notes (kick index 12–14 = notes ≡ 1..3 mod 16,
 *  snare index 6–8 = notes ≡ 7..9, hat index 1–3 = notes ≡ 12..14). */
export function noisePeriodIndex(note: number): number {
  return 15 - (((note % 16) + 16) % 16)
}

function clampNote(n: number): number {
  return n < 0 ? 0 : n > 127 ? 127 : n
}

function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.round(v)
  return n < lo ? lo : n > hi ? hi : n
}

export class TrackerDriver {
  private readonly sink: WriteSink
  private readonly clock: DriverClock
  private readonly clockRate: number

  private compiled: CompiledSong
  private readonly macros: MacroEngine
  private readonly regs = new RegisterFile(MAX_CHANNELS)
  private readonly rowAcc = new RowAccumulator()

  private channelCount = MAX_CHANNELS
  private engineHz = 60
  private speed = 6
  private tempo = 150
  private splitPoint = 0x20
  private evenTempoMode = false
  private evenTicks = 6
  private rowsPerPattern = 64

  /** Timeline origin of tick 0. Set by `play()`, overwritten by the handoff. */
  originCycle: NesCycle = 0
  private nextTick = 0

  private playingValue = false
  private mode: PlayMode = 'song'
  private orderIndex = 0
  private row = 0
  private tickInRow = 0
  private rowStart = true

  // --- per-channel state, all preallocated -------------------------------------------
  private readonly baseNote = new Int32Array(MAX_CHANNELS)
  private readonly instrument = new Int32Array(MAX_CHANNELS)
  private readonly sounding = new Int32Array(MAX_CHANNELS)
  private readonly chanVol8 = new Int32Array(MAX_CHANNELS)
  private readonly pendNote = new Int32Array(MAX_CHANNELS)
  private readonly pendInst = new Int32Array(MAX_CHANNELS)
  private readonly pendVol = new Int32Array(MAX_CHANNELS)
  private readonly pendTick = new Int32Array(MAX_CHANNELS)
  private readonly cutTick = new Int32Array(MAX_CHANNELS)
  private readonly arpParam = new Int32Array(MAX_CHANNELS)
  private readonly arpStep = new Int32Array(MAX_CHANNELS)
  private readonly slideRate = new Int32Array(MAX_CHANNELS)
  private readonly slideAccum = new Int32Array(MAX_CHANNELS)
  private readonly portaEnabled = new Int32Array(MAX_CHANNELS)
  private readonly portaSpeed = new Int32Array(MAX_CHANNELS)
  private readonly portaTarget = new Int32Array(MAX_CHANNELS)
  private readonly portaNote = new Int32Array(MAX_CHANNELS)
  private readonly noteSlideSpeed = new Int32Array(MAX_CHANNELS)
  private readonly noteSlideSemis = new Int32Array(MAX_CHANNELS)
  private readonly noteSlideActive = new Int32Array(MAX_CHANNELS)
  private readonly noteSlidePending = new Int32Array(MAX_CHANNELS)
  private readonly vibSpeed = new Int32Array(MAX_CHANNELS)
  private readonly vibDepth = new Int32Array(MAX_CHANNELS)
  private readonly vibAcc = new Int32Array(MAX_CHANNELS)
  private readonly tremSpeed = new Int32Array(MAX_CHANNELS)
  private readonly tremDepth = new Int32Array(MAX_CHANNELS)
  private readonly tremAcc = new Int32Array(MAX_CHANNELS)
  private readonly volSlide = new Int32Array(MAX_CHANNELS)
  private readonly finePitch = new Int32Array(MAX_CHANNELS)
  private readonly dutyOverride = new Int32Array(MAX_CHANNELS)
  private readonly pitchAccum = new Int32Array(MAX_CHANNELS)
  private readonly muted = new Int32Array(MAX_CHANNELS)
  private readonly liveNote = new Int32Array(MAX_CHANNELS)
  private readonly liveVel = new Int32Array(MAX_CHANNELS)
  private readonly liveHeld = new Int32Array(MAX_CHANNELS)
  private readonly triggerFlag = new Int32Array(MAX_CHANNELS)
  private readonly memory = new Int32Array(MAX_CHANNELS * CMD_SLOTS)

  private soloChannel = -1
  private liveChannel = 0
  private editStep = 1

  // Flow effects recorded at the row latch (§3.1 step 1), applied at end of tick.
  private flowJump = -1
  private flowSkip = -1
  private flowHalt = false
  private flowSpeed = -1

  private readonly rowLogTick = new Float64Array(ROW_LOG_CAPACITY)
  private readonly rowLogOrder = new Int32Array(ROW_LOG_CAPACITY)
  private readonly rowLogRow = new Int32Array(ROW_LOG_CAPACITY)
  private rowLogCount = 0

  /** Read in rAF. A plain mutable object, deliberately NOT `$state`. */
  readonly position: MutableDriverPosition = {
    playing: false,
    orderIndex: 0,
    row: 0,
    tick: 0,
    tickIndex: 0,
    bpm: 0,
    levels: new Int32Array(MAX_CHANNELS),
  }

  readonly stats: DriverStats = {
    ticksGenerated: 0,
    writesEmitted: 0,
    lateTicks: 0,
    rowsPlayed: 0,
    noteOns: 0,
    loops: 0,
  }

  /** `sampleIndex -> {address ($4012 units), length ($4013 units)}` for the 32 KiB
   *  DPCM image, built by whoever also called `Apu2A03.setDpcmMemory`. Null until
   *  then, and a dpcm note is simply silent — never an error (§3.7). */
  dpcmLayout: Map<number, { address: number; length: number }> | null = null

  constructor(sink: WriteSink, clock: DriverClock, opts: { song?: Song } = {}) {
    this.sink = sink
    this.clock = clock
    this.clockRate = clock.clockRate > 0 ? clock.clockRate : NTSC_CPU_HZ
    const song = opts.song ?? emptySong()
    this.compiled = compileSong(song)
    this.macros = new MacroEngine(MAX_CHANNELS, compileMacros(song))
    this.resetChannels()
    this.applySong(song)
  }

  get playing(): boolean {
    return this.playingValue
  }

  get song(): Song {
    return this.compiled.song
  }

  /** Cycle of the most recent write emitted — the handoff horizon `stop()` reports. */
  get lastWriteCycle(): NesCycle {
    return this.regs.lastCycle
  }

  /** Cycle the next tick would be generated at. Non-decreasing, always ≥ every write
   *  already emitted, which is what makes it a safe handoff point. */
  get horizonCycle(): NesCycle {
    return cycleOfTick(this.originCycle, this.nextTick, this.clockRate, this.engineHz)
  }

  // --- loading -------------------------------------------------------------------------

  /** Rebuild the dense pattern views and the macro banks. Cheap enough to run on any
   *  document change, which is what lets undo take effect at the next row boundary. */
  loadSong(song: Song): void {
    this.compiled = compileSong(song)
    this.macros.setMacros(compileMacros(song))
    this.applySong(song)
  }

  private applySong(song: Song): void {
    this.channelCount = Math.min(MAX_CHANNELS, this.compiled.channelCount)
    this.engineHz = song.meta.engineSpeed
    this.speed = song.meta.speed
    this.tempo = song.meta.tempo
    this.splitPoint = song.meta.speedSplitPoint
    this.evenTempoMode = song.meta.evenTempo
    this.rowsPerPattern = song.meta.rowsPerPattern
    this.rowAcc.setRatio(this.engineHz, this.speed, this.tempo)
    this.evenTicks = Math.max(1, Math.round(this.rowAcc.num / this.rowAcc.den))
    this.position.bpm = this.bpm()
  }

  private resetChannels(): void {
    this.baseNote.fill(NOTE_NONE)
    this.instrument.fill(0)
    this.sounding.fill(0)
    this.chanVol8.fill(MAX_CHAN_VOL8)
    this.pendNote.fill(NOTE_NONE)
    this.pendInst.fill(-1)
    this.pendVol.fill(-1)
    this.pendTick.fill(-1)
    this.cutTick.fill(-1)
    this.arpParam.fill(0)
    this.arpStep.fill(0)
    this.slideRate.fill(0)
    this.slideAccum.fill(0)
    this.portaEnabled.fill(0)
    this.portaSpeed.fill(0)
    this.portaTarget.fill(0)
    this.portaNote.fill(NOTE_NONE)
    this.noteSlideSpeed.fill(0)
    this.noteSlideSemis.fill(0)
    this.noteSlideActive.fill(0)
    this.noteSlidePending.fill(0)
    this.vibSpeed.fill(0)
    this.vibDepth.fill(0)
    this.vibAcc.fill(0)
    this.tremSpeed.fill(0)
    this.tremDepth.fill(0)
    this.tremAcc.fill(0)
    this.volSlide.fill(0)
    this.finePitch.fill(0)
    this.dutyOverride.fill(-1)
    this.pitchAccum.fill(0)
    this.liveNote.fill(-1)
    this.liveVel.fill(127)
    this.liveHeld.fill(0)
    this.triggerFlag.fill(0)
    this.memory.fill(0)
    this.position.levels.fill(0)
  }

  // --- transport ------------------------------------------------------------------------

  play(mode: PlayMode, from?: { order: number; row: number }): void {
    this.mode = mode
    this.resetChannels()
    this.regs.reset()
    this.rowAcc.reset()
    this.rowLogCount = 0
    this.applySong(this.compiled.song)
    const frames = Math.max(1, this.compiled.frameCount)
    this.orderIndex = from === undefined ? 0 : clampInt(from.order, 0, frames - 1)
    this.row = from === undefined ? 0 : clampInt(from.row, 0, this.rowsPerPattern - 1)
    this.tickInRow = 0
    this.rowStart = true
    this.nextTick = 0
    this.originCycle = this.clock.nowCycle()
    this.flowJump = -1
    this.flowSkip = -1
    this.flowHalt = false
    this.flowSpeed = -1
    const s = this.stats
    s.ticksGenerated = 0
    s.writesEmitted = 0
    s.lateTicks = 0
    s.rowsPlayed = 0
    s.noteOns = 0
    s.loops = 0
    this.playingValue = true
    this.publish()
  }

  /** Silence every channel and hand the timeline back.
   *
   *  The default cycle is the driver's own horizon — every write it has queued is at
   *  or before it, so the all-channels-off cannot land in front of a note that is
   *  still to sound. An explicit `atCycle` is for a caller that owns the frame
   *  boundary (the offline renderer): it must still be >= `lastWriteCycle`. */
  stop(atCycle?: NesCycle): void {
    if (!this.playingValue) return
    const horizon = this.horizonCycle
    const at = atCycle === undefined ? horizon : Math.max(atCycle, this.regs.lastCycle)
    this.haltAt(at)
  }

  private haltAt(cycle: NesCycle): void {
    this.playingValue = false
    this.regs.enable = 0
    this.regs.status(this.sink, cycle, true)
    for (let ch = 0; ch < MAX_CHANNELS; ch++) {
      this.sounding[ch] = 0
      this.position.levels[ch] = 0
    }
    // Effect memory is cleared by stop(), never by a note (§3.5).
    this.memory.fill(0)
    this.publish()
  }

  setChannelMute(channel: number, muted: boolean): void {
    if (channel < 0 || channel >= MAX_CHANNELS) return
    if ((this.muted[channel] === 1) === muted) return
    this.muted[channel] = muted ? 1 : 0
    if (!muted) this.regs.invalidate(channel)
  }

  setSoloChannel(channel: number): void {
    if (this.soloChannel === channel) return
    this.soloChannel = channel
    this.regs.invalidate(-1)
  }

  isSuppressed(channel: number): boolean {
    if (this.muted[channel] === 1) return true
    return this.soloChannel >= 0 && this.soloChannel !== channel
  }

  /** Which channel live input steals while playing (§2.6). */
  setLiveChannel(channel: number): void {
    if (channel < 0 || channel >= MAX_CHANNELS) return
    this.liveChannel = channel
  }

  get liveChannelIndex(): number {
    return this.liveChannel
  }

  setEditStep(rows: number): void {
    this.editStep = rows < 0 ? 0 : rows
  }

  get editStepRows(): number {
    return this.editStep
  }

  // --- live input while playing (Rule L, §2.6) --------------------------------------------

  /** The driver plays the live note on the editor's cursor channel, stealing it from
   *  the song for as long as the key is held: that channel's pattern data is
   *  suppressed, its macros and effects freeze, and it resumes from the song at the
   *  first row boundary after release. No writes are emitted here — the note lands on
   *  the driver's next generated tick, which is why live latency during playback is
   *  the lookahead and the UI says so. */
  liveNoteOn(channel: number, note: number, velocity: number): void {
    const ch = channel < 0 || channel >= MAX_CHANNELS ? this.liveChannel : channel
    this.liveNote[ch] = note
    this.liveVel[ch] = velocity
    this.liveHeld[ch] = 1
  }

  liveNoteOff(channel: number, note: number): void {
    const ch = channel < 0 || channel >= MAX_CHANNELS ? this.liveChannel : channel
    if (this.liveNote[ch] !== note) return
    this.liveHeld[ch] = 0
  }

  /** Release every stolen channel — the stuck-note guard's playing-mode counterpart. */
  liveAllOff(): void {
    for (let ch = 0; ch < MAX_CHANNELS; ch++) this.liveHeld[ch] = 0
  }

  /** Map an input event's own engine cycle back to the row it was played over.
   *  Quantization is therefore unaffected by the lookahead — the note lands on the
   *  row the player HEARD themselves play (§2.6). Returns −1 when unmappable. */
  rowAtCycle(cycle: NesCycle): number {
    const i = this.rowLogIndexAt(cycle)
    return i < 0 ? -1 : this.rowLogRow[i % ROW_LOG_CAPACITY]
  }

  orderAtCycle(cycle: NesCycle): number {
    const i = this.rowLogIndexAt(cycle)
    return i < 0 ? -1 : this.rowLogOrder[i % ROW_LOG_CAPACITY]
  }

  private rowLogIndexAt(cycle: NesCycle): number {
    if (this.rowLogCount === 0) return -1
    const tick = ((cycle - this.originCycle) * this.engineHz) / this.clockRate
    const oldest = Math.max(0, this.rowLogCount - ROW_LOG_CAPACITY)
    for (let i = this.rowLogCount - 1; i >= oldest; i--) {
      if (this.rowLogTick[i % ROW_LOG_CAPACITY] <= tick) return i
    }
    return oldest
  }

  // --- the tick loop ----------------------------------------------------------------------

  /** Generate every tick whose cycle is <= `horizonCycle`. Idempotent and resumable:
   *  called once per pump, and repeatedly by the offline renderer. The output is
   *  independent of how it is chunked, which `trackerDriver.test.ts` asserts against
   *  1-tick, 7-tick and one-shot horizons. */
  runTo(horizonCycle: NesCycle): void {
    let guard = 0
    // Sampled once per pump, not per tick. A tick generated behind the engine's own
    // position is one the main thread was too slow to produce in time — the honest
    // measure of the §2.1 risk, and what the `[drv]` chip reads.
    const now = this.clock.nowCycle()
    while (this.playingValue) {
      const c = cycleOfTick(this.originCycle, this.nextTick, this.clockRate, this.engineHz)
      if (c > horizonCycle) return
      if (c < now) this.stats.lateTicks++
      this.tickOnce(c)
      this.nextTick++
      this.stats.ticksGenerated++
      if (++guard > 4_000_000) return
    }
  }

  private tickOnce(cycle: NesCycle): void {
    this.lastCycleHint = cycle
    if (this.rowStart) {
      this.latchRow()
      this.rowStart = false
      this.tickInRow = 0
    }
    for (let ch = 0; ch < this.channelCount; ch++) this.tickChannel(ch, cycle)
    // Publish BEFORE the row accumulator runs, so `position` describes the tick that
    // was just generated rather than the row that is about to start — the playhead
    // must sit on the row you are hearing.
    this.publish()
    this.endOfTick(cycle)
    this.tickInRow++
  }

  // --- step 1: the row latch -----------------------------------------------------------

  private latchRow(): void {
    this.flowJump = -1
    this.flowSkip = -1
    this.flowHalt = false
    this.flowSpeed = -1
    const ticksThisRow = this.evenTempoMode ? this.evenTicks : this.rowAcc.ticksThisRow()

    const li = this.rowLogCount % ROW_LOG_CAPACITY
    this.rowLogTick[li] = this.nextTick
    this.rowLogOrder[li] = this.orderIndex
    this.rowLogRow[li] = this.row
    this.rowLogCount++

    const compiled = this.compiled
    for (let ch = 0; ch < this.channelCount; ch++) {
      this.pendNote[ch] = NOTE_NONE
      this.pendInst[ch] = -1
      this.pendVol[ch] = -1
      this.pendTick[ch] = -1
      this.cutTick[ch] = -1
      // A stolen channel returns to the song at the first row boundary after the key
      // came up (§2.6).
      if (this.liveHeld[ch] === 0 && this.liveNote[ch] >= 0) {
        this.liveNote[ch] = -1
        this.sounding[ch] = 0
        this.regs.setEnabled(ch, false)
        this.regs.invalidate(ch)
      }

      const slot = compiled.order[this.orderIndex * compiled.channelCount + ch]
      if (slot < 0) continue
      const rows = compiled.rows[slot]
      const base = this.row * LANES
      const note = rows[base + LANE_NOTE]
      const inst = rows[base + LANE_INST]
      const vol = rows[base + LANE_VOL]

      let delay = 0
      const columns = compiled.effectColumns[ch]
      for (let f = 0; f < columns && f < MAX_FX; f++) {
        const packed = rows[base + LANE_FX0 + f]
        if (packed < 0) continue
        const cmd = packed >> 8
        const param = this.resolveParam(ch, cmd, packed & 0xff)
        const d = this.applyRowEffect(ch, cmd, param)
        if (d >= 0) delay = d
      }
      if (delay > ticksThisRow - 1) delay = ticksThisRow - 1
      if (delay < 0) delay = 0

      this.pendNote[ch] = note
      this.pendInst[ch] = inst
      this.pendVol[ch] = vol
      if (note !== NOTE_NONE || inst >= 0 || vol >= 0) this.pendTick[ch] = delay
    }
  }

  /** Effect memory (§3.5). Recorded for all eight memory letters; consulted on a `00`
   *  only where §3.2 documents no "off" meaning — `7xy`, `Qxy`, `Rxy`. The reasoning
   *  is in `effects.ts`'s `OFF_ON_ZERO_COMMANDS`. */
  private resolveParam(ch: number, cmd: number, param: number): number {
    const c = cmdChar(cmd)
    if (MEMORY_COMMANDS.indexOf(c) < 0) return param
    const slot = ch * CMD_SLOTS + cmd
    if (param !== 0) {
      this.memory[slot] = param
      return param
    }
    if (OFF_ON_ZERO_COMMANDS.indexOf(c) >= 0) return 0
    return this.memory[slot]
  }

  /** Applies one row-scope effect. Returns the `Gxx` delay for a `Gxx`, else −1. */
  private applyRowEffect(ch: number, cmd: number, param: number): number {
    switch (cmd) {
      case FX_ARPEGGIO:
        this.arpParam[ch] = param
        return -1
      case FX_SLIDE_UP:
        this.arpParam[ch] = 0
        this.portaEnabled[ch] = 0
        this.noteSlideActive[ch] = 0
        this.slideRate[ch] = -param
        return -1
      case FX_SLIDE_DOWN:
        this.arpParam[ch] = 0
        this.portaEnabled[ch] = 0
        this.noteSlideActive[ch] = 0
        this.slideRate[ch] = param
        return -1
      case FX_PORTAMENTO:
        // "Automatically slides to NEW NOTES" — a persistent channel mode, not a
        // one-row effect. `100`/`200` cancel it (§3.2); `300` freezes it in place.
        this.arpParam[ch] = 0
        this.slideRate[ch] = 0
        this.noteSlideActive[ch] = 0
        this.portaEnabled[ch] = 1
        this.portaSpeed[ch] = param
        return -1
      case FX_VIBRATO:
        this.vibSpeed[ch] = (param >> 4) & 0x0f
        this.vibDepth[ch] = param & 0x0f
        if (param === 0) this.vibAcc[ch] = 0
        return -1
      case FX_TREMOLO:
        this.tremSpeed[ch] = (param >> 4) & 0x0f
        this.tremDepth[ch] = param & 0x0f
        if (param === 0) this.tremAcc[ch] = 0
        return -1
      case FX_VOLUME_SLIDE:
        this.volSlide[ch] = param
        return -1
      case FX_FINE_PITCH:
        this.finePitch[ch] = finePitchOffset(param)
        return -1
      case FX_DUTY:
        this.dutyOverride[ch] = param
        return -1
      case FX_CUT:
        this.cutTick[ch] = param
        return -1
      case FX_NOTE_SLIDE_UP:
      case FX_NOTE_SLIDE_DOWN:
        // "x is the SPEED and y is the number of SEMITONES" — in that order.
        this.noteSlideSpeed[ch] = noteSlideStep((param >> 4) & 0x0f)
        this.noteSlideSemis[ch] = cmd === FX_NOTE_SLIDE_UP ? param & 0x0f : -(param & 0x0f)
        this.noteSlideActive[ch] = 1
        this.noteSlidePending[ch] = 1
        this.portaEnabled[ch] = 0
        this.slideRate[ch] = 0
        this.arpParam[ch] = 0
        return -1
      case FX_DELAY:
        return param
      case FX_JUMP:
        this.flowJump = param
        return -1
      case FX_SKIP:
        this.flowSkip = param
        return -1
      case FX_HALT:
        this.flowHalt = true
        return -1
      case FX_SPEED:
        this.flowSpeed = param
        return -1
      default:
        // Unknown or deferred command: the validator already warned; the driver
        // ignores it so the document still round-trips (§1.2).
        return -1
    }
  }

  // --- step 2: one channel, one tick -----------------------------------------------------

  private tickChannel(ch: number, cycle: NesCycle): void {
    // Live input steals the cursor channel: pattern data suppressed, macros and
    // effects frozen, for as long as the key is held (§2.6).
    if (this.liveNote[ch] >= 0) {
      this.emitLive(ch, cycle)
      return
    }

    // a. delayed events due on this tick: the Gxx note trigger and the Sxx cut.
    if (this.pendTick[ch] === this.tickInRow) {
      this.fire(ch)
      this.pendTick[ch] = -1
    }
    if (this.cutTick[ch] === this.tickInRow) {
      this.cut(ch)
      this.cutTick[ch] = -1
    }

    // c. macros advance one step each; tick 0 of a note reads index 0, so the first
    //    macro value IS applied on the trigger tick.
    const macroVol = this.macros.read(ch, MACRO_VOLUME, 15)
    const macroArp = this.macros.read(ch, MACRO_ARPEGGIO, 0)
    const macroDuty = this.macros.read(ch, MACRO_DUTY, -1)
    if (this.macros.has(ch, MACRO_PITCH)) {
      this.pitchAccum[ch] += this.macros.read(ch, MACRO_PITCH, 0)
    }
    if (this.macros.has(ch, MACRO_HI_PITCH)) {
      // "Hi-pitch multiplies the value by 16" — documented verbatim in the manual.
      this.pitchAccum[ch] += this.macros.read(ch, MACRO_HI_PITCH, 0) * 16
    }
    const arpMode = this.macros.arpMode(ch)
    const hasArp = this.macros.has(ch, MACRO_ARPEGGIO)
    if (arpMode === ARP_RELATIVE && hasArp) this.macros.state.relArp[ch] += macroArp

    // d. effects, in the documented order. The per-tick DELTA group does not STEP on
    //    tick 0 of a row — the row's own values are heard first and the slide starts
    //    on tick 1 (§3.1). Their accumulated state still applies, which is what keeps
    //    `1xx`'s documented "persists past the row" true.
    const arpOffset = arpeggioOffset(this.arpParam[ch], this.arpStep[ch])
    this.arpStep[ch]++
    if (this.tickInRow > 0) this.stepPitchEffects(ch)
    const vib = this.vibDepth[ch] > 0 ? vibratoValue(this.vibAcc[ch], this.vibDepth[ch]) : 0
    this.vibAcc[ch] = (this.vibAcc[ch] + this.vibSpeed[ch]) & VIB_ACC_MASK
    let trem = 0
    if (this.tremDepth[ch] > 0) {
      const v = vibratoValue(this.tremAcc[ch], this.tremDepth[ch])
      trem = v < 0 ? -v : v
      if (this.tickInRow > 0) {
        this.tremAcc[ch] = (this.tremAcc[ch] + this.tremSpeed[ch]) & VIB_ACC_MASK
      }
    }
    if (this.tickInRow > 0 && this.volSlide[ch] !== 0) {
      this.chanVol8[ch] = volumeSlideStep(this.chanVol8[ch], this.volSlide[ch])
    }

    // e. compose
    let note = this.baseNote[ch]
    if (arpMode === ARP_FIXED && hasArp) note = macroArp
    else if (arpMode === ARP_RELATIVE) note = note + this.macros.state.relArp[ch]
    else note = note + macroArp
    note = note + arpOffset

    const volume = composeVolume(this.chanVol8[ch], macroVol, trem)
    this.position.levels[ch] = this.sounding[ch] === 1 ? volume : 0

    // f. emit every byte that changed, in the channel's canonical order.
    //    Mute/solo suppresses EMISSION only — the driver keeps running the channel's
    //    state, so unmuting mid-song resumes coherently (the re-arm below).
    if (this.isSuppressed(ch)) {
      if (this.regs.isEnabled(ch)) {
        this.regs.setEnabled(ch, false)
        this.regs.status(this.sink, cycle, false)
      }
      this.triggerFlag[ch] = 0
    } else if (this.sounding[ch] === 1) {
      if (!this.regs.isEnabled(ch)) {
        this.regs.setEnabled(ch, true)
        this.regs.invalidate(ch)
        this.triggerFlag[ch] = 1
      }
      this.emitChannel(ch, cycle, note, volume, macroDuty, vib, false)
    }
    this.macros.advance(ch)
  }

  /** The per-tick delta group: 1xx / 2xx / 3xx / Qxy / Rxy. */
  private stepPitchEffects(ch: number): void {
    if (this.slideRate[ch] !== 0) this.slideAccum[ch] += this.slideRate[ch]

    if (this.noteSlideActive[ch] === 1) {
      if (this.noteSlidePending[ch] === 1) this.armNoteSlide(ch)
      const target = this.portaTarget[ch]
      const step = this.noteSlideSpeed[ch]
      const cur = this.slideAccum[ch]
      if (cur < target) this.slideAccum[ch] = Math.min(target, cur + step)
      else if (cur > target) this.slideAccum[ch] = Math.max(target, cur - step)
      if (this.slideAccum[ch] === target) {
        // One-shot: latch the arrived note and clear the glide.
        this.baseNote[ch] = clampNote(this.portaNote[ch])
        this.slideAccum[ch] = 0
        this.portaTarget[ch] = 0
        this.noteSlideActive[ch] = 0
      }
      return
    }

    if (this.portaEnabled[ch] === 1 && this.portaSpeed[ch] > 0) {
      const target = this.portaTarget[ch]
      const step = this.portaSpeed[ch]
      const cur = this.slideAccum[ch]
      if (cur < target) this.slideAccum[ch] = Math.min(target, cur + step)
      else if (cur > target) this.slideAccum[ch] = Math.max(target, cur - step)
      if (this.slideAccum[ch] === target && this.portaNote[ch] !== NOTE_NONE) {
        this.baseNote[ch] = this.portaNote[ch]
        this.slideAccum[ch] = 0
        this.portaTarget[ch] = 0
        this.portaNote[ch] = NOTE_NONE
      }
    }
  }

  /** Compute a `Qxy`/`Rxy` target from whatever note the channel is on now. */
  private armNoteSlide(ch: number): void {
    this.noteSlidePending[ch] = 0
    const from = this.baseNote[ch] === NOTE_NONE ? 60 : this.baseNote[ch]
    const target = clampNote(from + this.noteSlideSemis[ch])
    this.portaNote[ch] = target
    this.portaTarget[ch] = this.periodOf(ch, target) - this.periodOf(ch, from)
  }

  // --- note lifecycle ----------------------------------------------------------------------

  private fire(ch: number): void {
    const vol = this.pendVol[ch]
    const inst = this.pendInst[ch]
    const note = this.pendNote[ch]
    if (vol >= 0) this.chanVol8[ch] = vol * CHAN_VOL_SCALE

    if (note === NOTE_CUT) {
      if (inst >= 0) this.instrument[ch] = inst
      this.cut(ch)
      return
    }
    if (note === NOTE_RELEASE) {
      if (inst >= 0) this.instrument[ch] = inst
      this.release(ch)
      return
    }
    if (note === NOTE_NONE) {
      if (inst >= 0) {
        // Instrument change WITHOUT a note: swap the macro SET, keep the INDICES.
        this.instrument[ch] = inst
        this.macros.swapInstrument(ch, inst)
      }
      return
    }
    if (inst >= 0) this.instrument[ch] = inst

    // A note with 3xx / Qxy / Rxy DOES NOT retrigger: it only sets the target. Macros
    // keep running, phase is untouched. This is the rule that makes legato lines
    // possible and the one most often got wrong.
    if (this.noteSlideActive[ch] === 1) {
      this.baseNote[ch] = note
      this.noteSlidePending[ch] = 1
      this.armNoteSlide(ch)
      return
    }
    if (this.portaEnabled[ch] === 1 && this.baseNote[ch] !== NOTE_NONE) {
      this.portaNote[ch] = note
      this.portaTarget[ch] = this.periodOf(ch, note) - this.periodOf(ch, this.baseNote[ch])
      return
    }
    this.trigger(ch, note)
  }

  private trigger(ch: number, note: number): void {
    this.baseNote[ch] = note
    this.sounding[ch] = 1
    this.arpStep[ch] = 0
    this.slideAccum[ch] = 0
    this.pitchAccum[ch] = 0
    this.portaTarget[ch] = 0
    this.portaNote[ch] = NOTE_NONE
    this.vibAcc[ch] = 0
    this.tremAcc[ch] = 0
    this.macros.trigger(ch, this.instrument[ch])
    this.regs.setEnabled(ch, true)
    this.triggerFlag[ch] = 1
    this.stats.noteOns++
  }

  private cut(ch: number): void {
    this.sounding[ch] = 0
    this.baseNote[ch] = NOTE_NONE
    this.regs.setEnabled(ch, false)
    this.regs.invalidate(ch)
    this.regs.status(this.sink, this.lastCycleHint, false)
    this.position.levels[ch] = 0
  }

  /** `===`. The VOLUME sequence decides: with a release point the note releases, with
   *  none the note is CUT — and the other four macros follow the volume macro's
   *  verdict, so a pitch macro with a release point and a volume macro without one
   *  still produces a cut. */
  private release(ch: number): void {
    if (!this.macros.canRelease(this.instrument[ch])) {
      this.cut(ch)
      return
    }
    this.macros.release(ch)
  }

  /** The cycle the current tick is being generated at. Set once per tick so `cut()`
   *  can push its `$4015` update without threading the cycle through five callers. */
  private lastCycleHint: NesCycle = 0

  // --- emission ----------------------------------------------------------------------------

  private periodOf(ch: number, note: number): number {
    const id = this.compiled.channels[ch]
    const n = clampNote(note)
    if (id === 'triangle') return triangleTimerForMidi(n, this.clockRate)
    if (id === 'noise') return noisePeriodIndex(n)
    return pulseTimerForMidi(n, this.clockRate)
  }

  private emitChannel(
    ch: number,
    cycle: NesCycle,
    note: number,
    volume: number,
    macroDuty: number,
    vib: number,
    live: boolean,
  ): void {
    const trigger = this.triggerFlag[ch] === 1
    this.triggerFlag[ch] = 0
    const id = this.compiled.channels[ch]
    const offset = this.slideAccum[ch] + this.pitchAccum[ch] + vib + this.finePitch[ch]

    if (id === 'pulse1' || id === 'pulse2') {
      // Vxx sets the value immediately; a duty MACRO overwrites it from the next tick.
      // Documented behaviour, not a bug: macros are per-tick, Vxx is per-row.
      let duty = 2
      if (this.dutyOverride[ch] >= 0) duty = this.dutyOverride[ch] & 3
      if (macroDuty >= 0) duty = macroDuty & 3
      const timer = clampPeriod(this.periodOf(ch, note) + offset, MIN_PULSE_PERIOD)
      this.regs.pulse(this.sink, cycle, ch, trigger, duty, volume, timer, SWEEP_OFF)
      return
    }
    if (id === 'triangle') {
      const timer = clampPeriod(this.periodOf(ch, note) + offset, MIN_TRIANGLE_PERIOD)
      // On the triangle the composed volume is a GATE, not a level (§3.3).
      this.regs.triangle(this.sink, cycle, ch, trigger, volume > 0, timer)
      return
    }
    if (id === 'noise') {
      let mode = 0
      if (this.dutyOverride[ch] >= 0) mode = this.dutyOverride[ch] & 1
      if (macroDuty >= 0) mode = macroDuty & 1
      const index = clampNoiseIndex(this.periodOf(ch, note) + offset)
      this.regs.noise(this.sink, cycle, ch, trigger, volume, index, mode)
      return
    }
    if (id === 'dpcm' && trigger && !live) this.emitDpcm(ch, cycle, note)
  }

  /** DPCM triggering (§3.7). Format, validation and grid support are mandatory; this
   *  trigger path is the single item §3.7 names as cuttable, and it is kept because it
   *  is small — the 32 KiB image and its layout are built by the host, which already
   *  has `Apu2A03.setDpcmMemory`. */
  private emitDpcm(ch: number, cycle: NesCycle, note: number): void {
    const layout = this.dpcmLayout
    if (layout === null) return
    const inst = this.compiled.song.instruments[this.instrument[ch]]
    const map = inst === undefined ? undefined : inst.dpcm
    if (map === undefined) return
    const a = map[String(note)]
    if (a === undefined) return
    const entry = layout.get(a.sample)
    if (entry === undefined) return
    this.regs.dpcm(
      this.sink,
      cycle,
      ch,
      a.pitch,
      a.loop,
      entry.address,
      entry.length,
      a.delta === undefined ? -1 : a.delta,
    )
  }

  private emitLive(ch: number, cycle: NesCycle): void {
    const note = this.liveNote[ch]
    if (this.sounding[ch] === 0 || this.baseNote[ch] !== note) {
      this.baseNote[ch] = note
      this.sounding[ch] = 1
      this.slideAccum[ch] = 0
      this.pitchAccum[ch] = 0
      this.regs.setEnabled(ch, true)
      this.triggerFlag[ch] = 1
      this.stats.noteOns++
    }
    const vel = this.liveVel[ch]
    const volume = vel <= 0 ? 0 : Math.max(1, Math.min(15, Math.round((15 * vel) / 127)))
    this.position.levels[ch] = volume
    if (this.isSuppressed(ch)) {
      if (this.regs.isEnabled(ch)) {
        this.regs.setEnabled(ch, false)
        this.regs.status(this.sink, cycle, false)
      }
      this.triggerFlag[ch] = 0
      return
    }
    this.emitChannel(ch, cycle, note, volume, -1, 0, true)
  }

  // --- step 3: end of tick ---------------------------------------------------------------

  private endOfTick(cycle: NesCycle): void {
    // Fxx applies immediately, BEFORE the row accumulator; rowAccum keeps its residue.
    if (this.flowSpeed >= 0) {
      const v = this.flowSpeed
      this.flowSpeed = -1
      if (v > 0) {
        if (v < this.splitPoint) this.speed = clampInt(v, 1, 31)
        else this.tempo = clampInt(v, 32, 255)
        this.rowAcc.setRatio(this.engineHz, this.speed, this.tempo)
        this.evenTicks = Math.max(1, Math.round(this.rowAcc.num / this.rowAcc.den))
        this.position.bpm = this.bpm()
      }
    }

    let advanced = 0
    if (this.evenTempoMode) {
      advanced = this.tickInRow + 1 >= this.evenTicks ? 1 : 0
    } else {
      advanced = this.rowAcc.step()
    }
    if (advanced === 0) return

    for (let i = 0; i < advanced; i++) {
      this.stats.rowsPlayed++
      if (this.flowHalt) {
        this.haltAt(cycle)
        return
      }
      this.advanceRow()
      if (!this.playingValue) return
    }
  }

  private advanceRow(): void {
    const jump = this.flowJump
    const skip = this.flowSkip
    this.flowJump = -1
    this.flowSkip = -1
    this.rowStart = true

    if (this.mode === 'pattern') {
      // 'pattern' loops the current frame: flow effects that would leave it are
      // ignored, which is what makes the mode a loop rather than a preview.
      this.row++
      if (this.row >= this.rowsPerPattern) {
        this.row = 0
        this.stats.loops++
      }
      return
    }

    const frames = Math.max(1, this.compiled.frameCount)
    if (jump >= 0 || skip >= 0) {
      // Bxx sets the frame, Dxx sets the row within the NEXT frame, both together
      // mean "frame from Bxx, row from Dxx".
      const next = jump >= 0 ? clampInt(jump, 0, frames - 1) : (this.orderIndex + 1) % frames
      if (next <= this.orderIndex) this.stats.loops++
      this.orderIndex = next
      this.row = skip >= 0 ? clampInt(skip, 0, this.rowsPerPattern - 1) : 0
      return
    }

    this.row++
    if (this.row >= this.rowsPerPattern) {
      this.row = 0
      this.orderIndex++
      if (this.orderIndex >= frames) {
        this.orderIndex = 0
        this.stats.loops++
      }
    }
  }

  private bpm(): number {
    const rh = this.compiled.song.meta.rowHighlight
    if (rh <= 0) return 0
    return (24 * this.tempo) / (this.speed * rh)
  }

  private publish(): void {
    const p = this.position
    p.playing = this.playingValue
    p.orderIndex = this.orderIndex
    p.row = this.row
    p.tick = this.tickInRow
    p.tickIndex = this.nextTick
    this.stats.writesEmitted = this.regs.writes
  }
}

// --- Rule L: the one-owner-at-a-time handoff (design §2.6) -------------------------------

/** What the coordinator needs from the engine. `EngineHandle` satisfies it. */
export interface CoordinatorEngine {
  readonly clockRate: number
  nowCycle(): NesCycle
  flush(): void
}

/** What the coordinator needs from `LiveScheduler`. `reset()` is one of the two narrow
 *  additive host APIs design §2.6 flags (the other is `EngineHandle.pending`, which is
 *  diagnostic only); nothing under `src/audio/{core,dsp,worklet,protocol}` or
 *  `timeline/types.ts` changes, and nothing may. */
export interface CoordinatorScheduler {
  allNotesOff(): void
  reset(cycle: NesCycle): void
  readonly lastScheduledCycle: NesCycle
}

/** Rule L, in one object: exactly one producer owns the timeline at a time.
 *
 *    stopped -> `LiveScheduler` owns it. Behaviour is bit-identical to phase 1: the
 *               3–25 ms adaptive lead, the monotonic clamp, the canonical note-on. The
 *               instrument the user judges latency by does not get slower because a
 *               tracker was added.
 *    playing -> `TrackerDriver` owns it, and live input steals the cursor channel.
 *
 *  The handoff is what discharges K2's non-decreasing-cycle requirement: playback
 *  starts strictly after the scheduler's last scheduled cycle, and the scheduler's
 *  monotonic clamp is moved past the driver's horizon on the way back. No merge
 *  buffer, no second producer, and the two owners can never both believe they own the
 *  `$4015` byte. */
export class PlaybackCoordinator {
  private readonly engine: CoordinatorEngine
  private readonly scheduler: CoordinatorScheduler
  readonly driver: TrackerDriver

  constructor(engine: CoordinatorEngine, scheduler: CoordinatorScheduler, driver: TrackerDriver) {
    this.engine = engine
    this.scheduler = scheduler
    this.driver = driver
  }

  get playing(): boolean {
    return this.driver.playing
  }

  /** Steps 1–5 of §2.6's handoff, in order. Returns the cycle playback was anchored
   *  at, so a caller (or a test) can assert the ordering. */
  start(mode: PlayMode, from?: { order: number; row: number }, lookaheadCycles = 0): NesCycle {
    if (this.driver.playing) this.stop()
    this.scheduler.allNotesOff()
    const start = Math.max(
      this.engine.nowCycle() + msToCycles(this.engine.clockRate, START_LATENCY_MS),
      this.scheduler.lastScheduledCycle + 1,
    )
    this.scheduler.reset(start)
    this.driver.play(mode, from)
    this.driver.originCycle = start
    if (lookaheadCycles > 0) this.driver.runTo(start + lookaheadCycles)
    this.engine.flush()
    return start
  }

  /** The driver emits its final all-channels-off writes at horizon H, then the
   *  scheduler's monotonic clamp resumes from H + 1 — so the first live note after a
   *  stop can never be scheduled behind a write the driver already queued. */
  stop(): NesCycle {
    const h = this.driver.horizonCycle
    this.driver.stop()
    const after = Math.max(h, this.driver.lastWriteCycle) + 1
    this.scheduler.reset(after)
    this.engine.flush()
    return after
  }

  /** One pump: generate every tick up to `now + lookahead`, then flush. */
  pump(lookaheadCycles: number): void {
    if (!this.driver.playing) return
    this.driver.runTo(this.engine.nowCycle() + lookaheadCycles)
    this.engine.flush()
  }
}
