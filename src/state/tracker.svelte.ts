/* pulsar — tracker editor + transport state (design §4.3, §4.5, §2.6, §7.2).
 *
 * Everything the pattern grid, the order list and the transport buttons read.
 * The document itself lives in `song.svelte.ts`; this store owns the things
 * undo must NEVER touch (§4.6): the cursor, the scroll, mute/solo, edit mode,
 * follow mode and playback.
 *
 * The playhead is the DRIVER's: `bridge.play` starts it and `bridge.playback`
 * reports it — on the real bridge and on the stub alike — so `pump()` copies the
 * driver's own position and this store integrates no time of its own.
 */

import type { AudioBridge } from '../audio/bridge'
import { bpm as bpmOf, type ClipboardBlock } from './songModel'
import { song } from './song.svelte'

/** design §6.3's bridge surface, restated as the subset this store uses so
 *  `state/` never has to import the driver. Every member is present on the real
 *  bridge AND on the stub; they stay optional, and every call site stays a `?.`,
 *  because the store is also correct before `attach()` — where there is no bridge
 *  at all and the honest answer to "what is playing" is "nothing". */
export type PlayMode = 'song' | 'pattern' | 'row'

/** Structurally the driver's own `DriverPosition`. */
export interface DriverPosition {
  readonly playing: boolean
  readonly orderIndex: number
  readonly row: number
  readonly tick: number
  readonly tickIndex: number
  readonly bpm: number
  readonly levels: Int32Array
}

interface TrackerApi {
  loadSong?(song: unknown): void
  play?(mode: PlayMode, from?: { order: number; row: number }): void
  stopPlayback?(): void
  readonly playback?: DriverPosition
  setLiveChannel?(channel: number): void
  setChannelMute?(channel: number, muted: boolean): void
  setEditStep?(rows: number): void
  readonly recordSink?: { onNote(note: number, velocity: number): number } | null
}

/** What `bridge.diagnostics` exposes on the real bridge (absent on the stub). */
interface DiagnosticsSource {
  readonly diagnostics?: {
    readonly lateWrites: number
    readonly droppedWrites: number
    readonly underruns: number
  }
}

/** Mutable position, read in rAF only — never `$state` (design §2.4). */
export interface MutablePosition {
  playing: boolean
  orderIndex: number
  row: number
  bpm: number
}

/** Diagnostics poll. 4 Hz, on its own timer: the frame loop never writes state. */
const DIAG_INTERVAL_MS = 250

class TrackerState {
  /** The panel is opt-in behind a StatusBar chip — the Phase-1 live-play shell
   *  must stay usable on its own (§4.1). */
  open = $state(false)
  /** True while the grid owns the keyboard. `attachKeyboard`'s focus guard reads
   *  this so the global QWERTY listener does not also fire (§4.5). The grid's
   *  unmount cleanup and `toggleOpen` both reset it — a stuck true would
   *  suppress every global keydown. */
  focused = $state(false)

  editing = $state(false)
  /** Rows the cursor advances after a note is written. */
  editStep = $state(1)
  /** follow = the view keeps the playhead in the centre third; free = the user
   *  scrolled, and follow re-arms on the next play (§4.3). */
  follow = $state(true)

  frame = $state(0)
  row = $state(0)
  channel = $state(0)
  field = $state(0)
  /** Which digit of a two-digit field is armed (§4.5, "left-to-right"). */
  digit = $state(0)

  /** Selection anchor; the selection is the rectangle anchor..cursor. */
  anchor = $state<{ row: number; channel: number } | null>(null)

  muted = $state<boolean[]>([false, false, false, false, false])
  solo = $state(-1)

  clipboard = $state<ClipboardBlock | null>(null)

  /** The `[drv]` chip (§7.2). Copied off the bridge's 10 Hz snapshot at 4 Hz. */
  drv = $state({ late: 0, dropped: 0, underruns: 0 })

  /** Read in the frame loop. Deliberately a plain object. */
  readonly position: MutablePosition = { playing: false, orderIndex: 0, row: 0, bpm: 150 }

  /** Mirrors `position.playing` for the chips. play()/stop() write it eagerly;
   *  pump() re-syncs it from the driver, because a driver-initiated stop (Cxx
   *  halt) never comes through stop(). */
  playing = $state(false)

  #bridge: (AudioBridge & TrackerApi & DiagnosticsSource) | null = null
  #diagTimer: ReturnType<typeof setInterval> | null = null

  attach(bridge: AudioBridge): void {
    this.#bridge = bridge as AudioBridge & TrackerApi & DiagnosticsSource
    this.#bridge.loadSong?.(song.doc)
    this.#diagTimer = setInterval(() => {
      const d = this.#bridge?.diagnostics
      if (d === undefined) return
      if (
        d.lateWrites !== this.drv.late ||
        d.droppedWrites !== this.drv.dropped ||
        d.underruns !== this.drv.underruns
      ) {
        this.drv = { late: d.lateWrites, dropped: d.droppedWrites, underruns: d.underruns }
      }
    }, DIAG_INTERVAL_MS)
  }

  detach(): void {
    if (this.#diagTimer !== null) clearInterval(this.#diagTimer)
    this.#diagTimer = null
    this.#bridge = null
  }

  /* ---- panel ------------------------------------------------------------- */

  toggleOpen(): void {
    this.open = !this.open
    if (!this.open) {
      this.focused = false
      this.stop()
    }
  }

  /* ---- cursor ------------------------------------------------------------ */

  get rowsPerPattern(): number {
    return song.doc.meta.rowsPerPattern
  }
  get channelCount(): number {
    return song.doc.channels.length
  }
  get frameCount(): number {
    return song.doc.order.length
  }

  setCursor(row: number, channel: number, field: number, extend = false): void {
    if (extend && this.anchor === null) this.anchor = { row: this.row, channel: this.channel }
    if (!extend) this.anchor = null
    this.row = clamp(row, 0, this.rowsPerPattern - 1)
    this.setChannel(channel)
    this.field = Math.max(0, field)
    this.digit = 0
  }

  moveRow(delta: number, extend = false): void {
    const rows = this.rowsPerPattern
    let row = this.row + delta
    let frame = this.frame
    // Walking off the end of a pattern walks into the next frame, which is what
    // makes ctrl+home/end and page-down feel like one continuous song.
    while (row < 0 && frame > 0) {
      frame--
      row += rows
    }
    while (row >= rows && frame < this.frameCount - 1) {
      frame++
      row -= rows
    }
    // Extending must not span a pattern boundary, and the crossing has to be
    // captured BEFORE the frame write: the anchor refers to the frame it was
    // set in, so re-anchoring at the old row in the new frame would fake an
    // up-to-full-pattern selection.
    const crossed = frame !== this.frame
    if (crossed) {
      this.frame = frame
      this.anchor = null
    }
    this.setCursor(row, this.channel, this.field, extend && !crossed)
  }

  moveField(delta: number): void {
    this.field += delta
    this.digit = 0
    this.anchor = null
  }

  /** The ONE channel write path. While a song plays the driver steals the
   *  editor's cursor channel for live notes (§2.6), so every way the channel
   *  can change — Tab, a pointer click, field normalisation — must push it here,
   *  or a click on the noise lane still steals whichever channel the last Tab
   *  press picked. */
  setChannel(channel: number): void {
    this.channel = clamp(channel, 0, this.channelCount - 1)
    this.#bridge?.setLiveChannel?.(this.channel)
  }

  moveChannel(delta: number): void {
    const n = this.channelCount
    this.setChannel((((this.channel + delta) % n) + n) % n)
    this.field = 0
    this.digit = 0
    this.anchor = null
  }

  setFrame(frame: number): void {
    this.frame = clamp(frame, 0, this.frameCount - 1)
    this.anchor = null
  }

  get selection(): {
    row0: number
    row1: number
    channel0: number
    channel1: number
  } | null {
    const a = this.anchor
    if (a === null) return null
    return {
      row0: Math.min(a.row, this.row),
      row1: Math.max(a.row, this.row),
      channel0: Math.min(a.channel, this.channel),
      channel1: Math.max(a.channel, this.channel),
    }
  }

  /* ---- modes ------------------------------------------------------------- */

  toggleEdit(): void {
    this.editing = !this.editing
  }

  setEditStep(rows: number): void {
    this.editStep = clamp(rows, 0, 16)
    this.#bridge?.setEditStep?.(this.editStep)
  }

  toggleFollow(): void {
    this.follow = !this.follow
  }

  toggleMute(channel: number): void {
    const next = [...this.muted]
    next[channel] = !next[channel]
    this.muted = next
    this.#bridge?.setChannelMute?.(channel, next[channel] === true)
  }

  toggleSolo(channel: number): void {
    this.solo = this.solo === channel ? -1 : channel
    for (let c = 0; c < this.channelCount; c++) {
      const muted = this.solo === -1 ? this.muted[c] === true : this.solo !== c
      this.#bridge?.setChannelMute?.(c, muted)
    }
  }

  isAudible(channel: number): boolean {
    if (this.solo !== -1) return this.solo === channel
    return this.muted[channel] !== true
  }

  /* ---- transport --------------------------------------------------------- */

  play(mode: PlayMode): void {
    const from = { order: this.frame, row: mode === 'row' ? this.row : 0 }
    this.follow = true
    // Seeded here rather than waited for: the driver's first snapshot is a frame
    // away, and the transport chips must not flicker through a stale position.
    this.position.playing = true
    this.position.orderIndex = from.order
    this.position.row = from.row
    this.position.bpm = bpmOf(song.doc.meta)
    this.playing = true

    const api = this.#bridge
    api?.loadSong?.(song.doc)
    api?.play?.(mode, from)
  }

  stop(): void {
    this.position.playing = false
    this.playing = false
    this.#bridge?.stopPlayback?.()
  }

  togglePlay(mode: PlayMode = 'row'): void {
    if (this.playing) this.stop()
    else this.play(mode)
  }

  /**
   * Called once per frame from the app's single rAF, before the grid renders.
   * Returns true when the position moved, which is the grid's dirty trigger.
   *
   * The frame timestamp is part of the loop's contract and deliberately unused:
   * the playhead is the driver's, sampled from `bridge.playback`, so this store
   * never integrates time of its own. The only `$state` written here is the
   * `playing` mirror, and only on a transition — the documented-exception class
   * of the grid's `tracker.frame` write.
   */
  pump(_nowMs: number): boolean {
    const p = this.position
    const driver = this.#bridge?.playback
    if (driver === undefined) return false
    const moved =
      driver.playing !== p.playing || driver.row !== p.row || driver.orderIndex !== p.orderIndex
    p.playing = driver.playing
    p.orderIndex = driver.orderIndex
    p.row = driver.row
    p.bpm = driver.bpm
    // A driver-initiated stop (Cxx halt) never comes through stop(); without
    // this re-sync the mirror reads "playing" forever over a silent song.
    if (driver.playing !== this.playing) this.playing = driver.playing
    return moved
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export const tracker = new TrackerState()
