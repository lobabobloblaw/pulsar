<!--
  pulsar — the pattern grid (design §4.2–§4.5).

  Two surfaces, one component:

    the canvas       aria-hidden, drawn through `canvas/patternRenderer.ts` on
                     the app's SINGLE rAF, and only when a dirty flag is set.
                     Dirty comes from scroll, cursor, selection, data, focus,
                     room, geometry/DPR and the driver's row — nothing else, so
                     an idle frame costs one boolean test (§4.3).

    the semantic model   a real `role="grid"` beside it with one `role="row"` /
                     `role="gridcell"` per VISIBLE row, carrying
                     aria-rowindex/aria-colindex so the virtualization is
                     announced correctly. The container is the single tab stop
                     and `aria-activedescendant` points at the cursor cell
                     (§4.4). Cells are clipped, never `display:none` — a hidden
                     cell is a cell no screen reader can reach.

  What this component does NOT promise, and says so in the panel's help text:
  reading a whole pattern aurally. The honest promise is cell-level navigation
  and editing parity with the mouse (§4.4).
-->
<script lang="ts">
  import { untrack } from 'svelte'
  import { bridge } from '../../audio/bridge'
  import { LOCAL_VELOCITY, NOTE_KEYS } from '../../input/keyboard'
  import { resolveTrackerKey, type ColumnKind, type TrackerKeyContext } from '../../input/trackerKeys'
  import { motion } from '../../state/motion.svelte'
  import { song } from '../../state/song.svelte'
  import { tracker } from '../../state/tracker.svelte'
  import { transport } from '../../state/transport.svelte'
  import {
    buildLayout,
    deviceRatio,
    resolvePalette,
    resolveType,
    watchDevicePixelRatio,
    watchRoom,
  } from '../canvas/gridMetrics'
  import {
    CHANNEL_LABELS,
    NOTE_CUT,
    NOTE_RELEASE,
    type CellField,
    type Command,
  } from '../../state/songModel'
  import {
    drawFurniture,
    drawRows,
    hitTest,
    laneText,
    LANES_PER_CHANNEL,
    LANE_FX0,
    LANE_INST,
    LANE_NOTE,
    LANE_VOL,
    type GridLayout,
    type GridPalette,
    type PatternView,
  } from '../canvas/patternRenderer'
  import { useFrame } from '../frame'

  interface Props {
    /** Routed to App's LiveRegion. Throttled here, not there. */
    announce?: ((message: string) => void) | undefined
  }
  let { announce }: Props = $props()

  const audio = bridge()
  const frame = useFrame()

  let host = $state<HTMLDivElement | null>(null)
  let canvas = $state<HTMLCanvasElement | null>(null)
  let gridEl = $state<HTMLDivElement | null>(null)

  /* ---- everything below is plain, non-reactive render state --------------- */
  let ctx: CanvasRenderingContext2D | null = null
  let layout: GridLayout | null = null
  let palette: GridPalette | null = null
  let furniture: HTMLCanvasElement | null = null
  let dirty = true
  let furnitureDirty = true
  let dpr = 1
  let cssW = 0
  let cssH = 0
  let scrollRow = 0
  let scrollX = 0
  let lastPlayRow = -1
  let lastPlayFrame = -1
  let lastAnnounceAt = 0
  let view: Int32Array = new Int32Array(0)
  let viewFirst = 0
  let viewCount = 0

  /** Which QWERTY codes are auditioning a note, so keyup releases the right one. */
  const auditioning = new Map<string, number>()

  const ROW_H = 18
  const HEADER_H = 22
  /** Two rows of overscan, per §4.3's `[firstVisible - 2, lastVisible + 2]`. */
  const OVERSCAN = 2
  /** The DOM model's row window: 48 rows, snapped to a 16-row block around the
   *  cursor rather than centred on it. Snapping is what keeps arrow-key movement
   *  cheap — a centred window would rebuild 48 x channels labelled cells on
   *  every single row move, where this one changes once every 16 rows and the
   *  cursor is inside it by construction (so `aria-activedescendant` always
   *  points at an element that exists). */
  const MODEL_BLOCK = 16
  const MODEL_ROWS = 48

  const channelCount = $derived(song.doc.channels.length)
  const rowsPerPattern = $derived(song.doc.meta.rowsPerPattern)
  const labels = $derived(song.doc.channels.map((c) => CHANNEL_LABELS[c]))
  /** Changes only when the grid's COLUMN geometry changes — not on every edit. */
  const shape = $derived(`${song.doc.channels.length}:${song.doc.effectColumns.join(',')}`)

  const modelFirst = $derived(
    Math.max(0, Math.floor(tracker.row / MODEL_BLOCK) * MODEL_BLOCK - MODEL_BLOCK),
  )
  const visibleRows = $derived.by(() => {
    const last = Math.min(rowsPerPattern - 1, modelFirst + MODEL_ROWS - 1)
    const out: number[] = []
    for (let r = modelFirst; r <= last; r++) out.push(r)
    return out
  })

  const columnOf = (field: number): ColumnKind =>
    layout?.channels[tracker.channel]?.fields[field]?.kind ?? 'note'

  const keyContext = (): TrackerKeyContext => ({
    editing: tracker.editing,
    column: columnOf(tracker.field),
    noteKeys: NOTE_KEYS,
  })

  /* ---- geometry ---------------------------------------------------------- */

  function rebuild(): void {
    const el = canvas
    const box = host
    if (!el || !box) return
    const c = ctx ?? el.getContext('2d', { alpha: false })
    if (!c) return
    ctx = c

    dpr = deviceRatio()
    const type = resolveType()
    layout = buildLayout(c, type, {
      channels: channelCount,
      effectColumns: song.doc.effectColumns,
    })
    palette = resolvePalette()

    cssW = Math.max(240, Math.floor(box.clientWidth))
    cssH = Math.max(ROW_H * 8 + HEADER_H, Math.floor(box.clientHeight))
    el.style.width = `${cssW}px`
    el.style.height = `${cssH}px`
    el.width = Math.round(cssW * dpr)
    el.height = Math.round(cssH * dpr)
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.imageSmoothingEnabled = false

    furnitureDirty = true
    dirty = true
  }

  function rebuildFurniture(): void {
    if (!layout || !palette) return
    const w = Math.round(cssW * dpr)
    const h = Math.round(cssH * dpr)
    let surface = furniture
    if (surface === null || surface.width !== w || surface.height !== h) {
      surface = document.createElement('canvas')
      surface.width = w
      surface.height = h
      furniture = surface
    }
    const fc = surface.getContext('2d', { alpha: false })
    if (!fc) return
    fc.setTransform(dpr, 0, 0, dpr, 0, 0)
    fc.imageSmoothingEnabled = false
    drawFurniture(fc, layout, palette, labels, cssW, cssH, scrollX, tracker.muted)
    furnitureDirty = false
  }

  /* ---- the frame ---------------------------------------------------------- */

  function follow(): void {
    if (!tracker.follow || !tracker.position.playing) return
    const visible = (cssH - HEADER_H) / ROW_H
    const target = clamp(tracker.position.row - visible / 3, 0, Math.max(0, rowsPerPattern - visible))
    if (Math.abs(target - scrollRow) < 0.01) {
      scrollRow = target
      return
    }
    // Information-bearing motion: it still moves under prefers-reduced-motion,
    // it just stops easing (§4.3, plan C1's motion policy).
    scrollRow = motion.reduced ? target : scrollRow + (target - scrollRow) * 0.35
    dirty = true
  }

  function paint(): void {
    const c = ctx
    if (!c || !layout || !palette) return
    if (furnitureDirty) rebuildFurniture()

    const first = Math.max(0, Math.floor(scrollRow) - OVERSCAN)
    const count = Math.min(
      rowsPerPattern - first,
      Math.ceil((cssH - HEADER_H) / ROW_H) + OVERSCAN * 2 + 1,
    )
    const need = count * channelCount * LANES_PER_CHANNEL
    if (view.length < need) view = new Int32Array(need)
    song.fillView(view, tracker.frame, first, count)
    viewFirst = first
    viewCount = count

    const surface = furniture
    if (surface !== null) {
      c.drawImage(surface, 0, 0, surface.width, surface.height, 0, 0, cssW, cssH)
    }

    const patternView: PatternView = {
      firstRow: first,
      rowCount: count,
      channels: channelCount,
      data: view,
      beat: song.doc.meta.rowHighlight,
      bar: song.doc.meta.rowHighlight2,
      rowsPerPattern,
    }

    drawRows(c, layout, palette, patternView, {
      scrollRow,
      scrollX,
      viewportW: cssW,
      viewportH: cssH,
      cursorRow: tracker.row,
      cursorChannel: tracker.channel,
      cursorField: tracker.field,
      cursorDigit: tracker.digit,
      editing: tracker.editing,
      focused: tracker.focused,
      playRow: tracker.position.playing && tracker.position.orderIndex === tracker.frame
        ? tracker.position.row
        : -1,
      selection: tracker.selection,
      muted: tracker.muted,
    })
    dirty = false
  }

  /* ---- edits -------------------------------------------------------------- */

  const NOTE_FIELD: CellField = { kind: 'note' }
  const INST_FIELD: CellField = { kind: 'inst' }

  /** The cursor's column, as the sub-field an edit names. An effect stays TWO
   *  columns here — the command character and its two hex digits — because that
   *  is how a tracker is typed; the model's single `Effect` is composed on the
   *  way into the command, by the store's `cellFieldCommand`. */
  function fieldAt(field: number): CellField {
    const f = layout?.channels[tracker.channel]?.fields[field]
    if (!f) return NOTE_FIELD
    if (f.kind === 'fxCmd') return { kind: 'fx', slot: f.fx, part: 'cmd' }
    if (f.kind === 'fxParam') return { kind: 'fx', slot: f.fx, part: 'param' }
    return { kind: f.kind }
  }

  function write(field: CellField, value: number | null): void {
    song.writeField(tracker.frame, tracker.channel, tracker.row, field, value)
    dirty = true
  }

  function advance(): void {
    if (tracker.editStep > 0) tracker.moveRow(tracker.editStep)
  }

  /** Where a written note lands.
   *
   *  Stopped: the cursor row — step record. Playing: live record, and the row
   *  comes from the input event's OWN timestamp, not from the lookahead
   *  (§2.6). WP9's `recordSink.onNote` is that mapping and returns the row it
   *  chose; until it lands, the driver's current row is the same row the player
   *  heard themselves play, which is the property that matters. */
  function recordRow(note: number): number {
    if (!tracker.position.playing) return tracker.row
    const sink = (audio as { recordSink?: { onNote(n: number, v: number): number } | null })
      .recordSink
    const row = sink?.onNote(note, LOCAL_VELOCITY) ?? -1
    return row >= 0 ? row : tracker.position.row
  }

  function writeNote(note: number): void {
    const row = recordRow(note)
    if (row !== tracker.row) tracker.setCursor(row, tracker.channel, tracker.field)
    write(NOTE_FIELD, note)
    if (note >= 0 && song.field(tracker.frame, tracker.channel, tracker.row, INST_FIELD) === null) {
      write(INST_FIELD, 0)
    }
    announceCell(true)
    if (!tracker.position.playing) advance()
  }

  function audition(code: string, note: number): void {
    if (auditioning.has(code)) return
    auditioning.set(code, note)
    if (transport.noteOn(note, 'tracker')) audio.noteOn(note, LOCAL_VELOCITY)
  }

  function releaseAudition(code: string): void {
    const note = auditioning.get(code)
    if (note === undefined) return
    auditioning.delete(code)
    if (transport.noteOff(note, 'tracker')) audio.noteOff(note)
  }

  function releaseAllAuditions(): void {
    for (const [code] of auditioning) releaseAudition(code)
  }

  /** §4.5 gives hex columns "hex digit entry, left-to-right within the field"
   *  and gives `editStep` only to note entry — so a digit fills its nibble and
   *  arms the next one, and the row does NOT advance. That is also the only
   *  behaviour that lets you type a note, an instrument, a volume and an effect
   *  onto one row without navigating back to it four times. */
  function hexInto(field: CellField, digits: number, value: number): void {
    const current = song.field(tracker.frame, tracker.channel, tracker.row, field) ?? 0
    if (digits === 1) {
      write(field, value)
      announceCell(true)
      return
    }
    if (tracker.digit === 0) {
      write(field, ((value << 4) | (current & 0x0f)) & 0xff)
      tracker.digit = 1
    } else {
      write(field, ((current & 0xf0) | value) & 0xff)
      tracker.digit = 0
      announceCell(true)
    }
    dirty = true
  }

  /* ---- key handling ------------------------------------------------------- */

  function onKeyDown(e: KeyboardEvent): void {
    const action = resolveTrackerKey(e, keyContext())
    if (action === null) return
    e.preventDefault()
    if (e.repeat && (action.kind === 'note' || action.kind === 'toggleEdit')) return

    switch (action.kind) {
      case 'toggleEdit':
        tracker.toggleEdit()
        announce?.(tracker.editing ? 'edit mode on' : 'edit mode off')
        break
      case 'play':
        tracker.play(action.mode)
        announce?.(action.mode === 'pattern' ? 'playing pattern' : 'playing')
        break
      case 'stop':
        tracker.stop()
        releaseAllAuditions()
        announce?.('stopped')
        break
      case 'move':
        if (action.rows !== 0) tracker.moveRow(action.rows, e.shiftKey)
        if (action.columns !== 0) tracker.moveField(action.columns)
        if (action.channels !== 0) tracker.moveChannel(action.channels)
        normaliseField()
        announceCell(false)
        break
      case 'jump':
        if (action.to === 'rowFirst') tracker.setCursor(0, tracker.channel, tracker.field)
        else if (action.to === 'rowLast') {
          tracker.setCursor(rowsPerPattern - 1, tracker.channel, tracker.field)
        } else if (action.to === 'songStart') {
          tracker.setFrame(0)
          tracker.setCursor(0, tracker.channel, tracker.field)
        } else {
          tracker.setFrame(tracker.frameCount - 1)
          tracker.setCursor(rowsPerPattern - 1, tracker.channel, tracker.field)
        }
        announceCell(false)
        break
      case 'octave':
        transport.setOctave(transport.octave + action.delta)
        announce?.(`octave ${transport.octave}`)
        break
      case 'note': {
        const note = (transport.octave + 1) * 12 + action.semitone
        if (note < 0 || note > 119) break
        audition(e.code, note)
        if (tracker.editing) writeNote(note)
        break
      }
      case 'noteSpecial':
        if (!tracker.editing) break
        writeNote(action.value === 'cut' ? NOTE_CUT : NOTE_RELEASE)
        break
      case 'hex': {
        const kind = columnOf(tracker.field)
        if (kind === 'note' || kind === 'fxCmd') break
        hexInto(fieldAt(tracker.field), kind === 'vol' ? 1 : 2, action.value)
        break
      }
      case 'fxChar':
        write(fieldAt(tracker.field), action.char.charCodeAt(0))
        announceCell(true)
        break
      case 'clearField':
        write(fieldAt(tracker.field), null)
        announce?.('cleared')
        break
      case 'clearRow': {
        // The whole visual row, across every lane — one command, one undo.
        song.clearBlock(tracker.frame, tracker.row, tracker.row, 0, channelCount - 1)
        announce?.(`row ${tracker.row} cleared`)
        dirty = true
        break
      }
      case 'insertRow':
      case 'deleteRow': {
        // Across every lane: inserting into one channel alone would slide it out
        // of time with the others, which is never what a musician meant. One
        // list, so one undo entry.
        const cmds: Command[] = []
        for (let c = 0; c < channelCount; c++) {
          const id = song.channelId(c)
          if (id === null) continue
          cmds.push({
            kind: action.kind,
            channel: id,
            pattern: song.patternAt(tracker.frame, c),
            row: tracker.row,
          })
        }
        song.run(cmds)
        announce?.(action.kind === 'insertRow' ? 'row inserted' : 'row deleted')
        dirty = true
        break
      }
      case 'undo':
        announce?.(song.undo() ? 'undo' : 'nothing to undo')
        dirty = true
        break
      case 'redo':
        announce?.(song.redo() ? 'redo' : 'nothing to redo')
        dirty = true
        break
      case 'clipboard':
        clipboard(action.op)
        break
      case 'mute':
        if (action.channel < channelCount) {
          tracker.toggleMute(action.channel)
          furnitureDirty = true
          dirty = true
          announce?.(`${labels[action.channel]} ${tracker.muted[action.channel] ? 'muted' : 'unmuted'}`)
        }
        break
      case 'solo':
        if (action.channel < channelCount) {
          tracker.toggleSolo(action.channel)
          furnitureDirty = true
          dirty = true
          announce?.(tracker.solo === action.channel ? `${labels[action.channel]} solo` : 'solo off')
        }
        break
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    releaseAudition(e.code)
  }

  function clipboard(op: 'copy' | 'cut' | 'paste'): void {
    const sel = tracker.selection ?? {
      row0: tracker.row,
      row1: tracker.row,
      channel0: tracker.channel,
      channel1: tracker.channel,
    }
    if (op === 'paste') {
      const block = tracker.clipboard
      if (block === null) {
        announce?.('clipboard empty')
        return
      }
      song.pasteBlock(tracker.frame, tracker.row, tracker.channel, block)
      announce?.(`pasted ${block.rows} rows`)
      dirty = true
      return
    }
    tracker.clipboard = song.copyBlock(tracker.frame, sel.row0, sel.row1, sel.channel0, sel.channel1)
    if (op === 'cut') {
      song.clearBlock(tracker.frame, sel.row0, sel.row1, sel.channel0, sel.channel1)
      dirty = true
    }
    announce?.(`${op === 'cut' ? 'cut' : 'copied'} ${sel.row1 - sel.row0 + 1} rows`)
  }

  /** Left/right runs off the end of a channel into the next one. */
  function normaliseField(): void {
    const fields = layout?.channels[tracker.channel]?.fields.length ?? 1
    if (tracker.field >= fields) {
      if (tracker.channel < channelCount - 1) {
        tracker.channel += 1
        tracker.field = 0
      } else {
        tracker.field = fields - 1
      }
    } else if (tracker.field < 0) {
      if (tracker.channel > 0) {
        tracker.channel -= 1
        tracker.field = (layout?.channels[tracker.channel]?.fields.length ?? 1) - 1
      } else {
        tracker.field = 0
      }
    }
    ensureVisible()
  }

  function ensureVisible(): void {
    const visible = (cssH - HEADER_H) / ROW_H
    if (tracker.row < scrollRow) scrollRow = tracker.row
    else if (tracker.row > scrollRow + visible - 1) scrollRow = tracker.row - visible + 1
    scrollRow = clamp(scrollRow, 0, Math.max(0, rowsPerPattern - visible))

    const ch = layout?.channels[tracker.channel]
    if (ch && layout) {
      const right = ch.x + ch.w - (cssW - layout.gutterW)
      if (ch.x - scrollX < layout.gutterW) scrollX = Math.max(0, ch.x - layout.gutterW)
      else if (scrollX < right) scrollX = right
      furnitureDirty = true
    }
    dirty = true
  }

  /* ---- announcements (§4.4) ----------------------------------------------- */

  function cellLabel(row: number, channel: number): string {
    const name = labels[channel] ?? ''
    const cell = song.cell(tracker.frame, channel, row)
    if (cell === null) return `channel ${name}, row ${row}, empty`
    const parts: string[] = []
    if (cell.note !== undefined) {
      parts.push(
        `note ${cell.note === NOTE_CUT ? 'cut' : cell.note === NOTE_RELEASE ? 'release' : laneText(LANE_NOTE, cell.note)}`,
      )
    }
    if (cell.inst !== undefined) parts.push(`instrument ${laneText(LANE_INST, cell.inst)}`)
    if (cell.vol !== undefined) parts.push(`volume ${laneText(LANE_VOL, cell.vol)}`)
    const fx = cell.fx ?? []
    for (let i = 0; i < fx.length; i++) {
      const e = fx[i]
      if (!e) continue
      const hex = laneText(LANE_FX0 + 1, e.param)
      parts.push(`effect ${e.cmd.toLowerCase()} ${hex[0]} ${hex[1]}`)
    }
    if (parts.length === 0) return `channel ${name}, row ${row}, empty`
    return `channel ${name}, row ${row}, ${parts.join(', ')}`
  }

  /** One announcement per 250 ms for movement; edits always announce (§4.4). */
  function announceCell(immediate: boolean): void {
    const now = performance.now()
    if (!immediate && now - lastAnnounceAt < 250) return
    lastAnnounceAt = now
    announce?.(cellLabel(tracker.row, tracker.channel))
  }

  const cellId = (row: number, channel: number): string => `pg-${row}-${channel}`

  /* ---- pointer ------------------------------------------------------------ */

  function onPointerDown(e: PointerEvent): void {
    const el = canvas
    if (!el || !layout) return
    gridEl?.focus()
    const box = el.getBoundingClientRect()
    const hit = hitTest(layout, { scrollRow, scrollX }, e.clientX - box.left, e.clientY - box.top)
    if (hit === null) return
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    tracker.setCursor(hit.row, hit.channel, hit.field, e.shiftKey)
    announceCell(false)
    dirty = true
  }

  function onPointerMove(e: PointerEvent): void {
    const el = canvas
    if (!el || !layout || !el.hasPointerCapture(e.pointerId)) return
    const box = el.getBoundingClientRect()
    const hit = hitTest(layout, { scrollRow, scrollX }, e.clientX - box.left, e.clientY - box.top)
    if (hit === null) return
    tracker.setCursor(hit.row, hit.channel, hit.field, true)
    dirty = true
  }

  function onPointerUp(e: PointerEvent): void {
    canvas?.releasePointerCapture(e.pointerId)
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault()
    const visible = (cssH - HEADER_H) / ROW_H
    scrollRow = clamp(scrollRow + Math.sign(e.deltaY) * 3, 0, Math.max(0, rowsPerPattern - visible))
    // Any manual scroll drops out of follow, which re-arms on the next play.
    if (tracker.position.playing) tracker.follow = false
    dirty = true
  }

  function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v
  }

  /* ---- lifecycle ---------------------------------------------------------- */

  $effect(() => {
    const box = host
    if (!box || !canvas) return
    // `rebuild` reads the document; running it inside the effect's tracking
    // scope would re-subscribe the frame loop on every keystroke.
    untrack(rebuild)

    const ro = new ResizeObserver(() => rebuild())
    ro.observe(box)
    const stopDpr = watchDevicePixelRatio(() => rebuild())
    const stopRoom = watchRoom(() => {
      palette = resolvePalette()
      furnitureDirty = true
      dirty = true
    })
    // The webfont lands after first paint; the column geometry is measured from
    // it, so re-measure once it is really there.
    void document.fonts?.ready.then(() => rebuild())

    const stop = frame.subscribe(() => {
      follow()
      const p = tracker.position
      if (p.row !== lastPlayRow || p.orderIndex !== lastPlayFrame) {
        if (p.orderIndex !== lastPlayFrame && p.playing) {
          // The frame loop writes $state exactly here and nowhere else: an
          // order-frame change is a once-per-few-seconds event, not per-frame
          // work, and it is also the moment §4.4 says to announce.
          announce?.(`frame ${p.orderIndex}`)
          if (tracker.follow) tracker.frame = p.orderIndex
        }
        lastPlayRow = p.row
        lastPlayFrame = p.orderIndex
        dirty = true
      }
      if (dirty) paint()
    })

    return () => {
      stop()
      ro.disconnect()
      stopDpr()
      stopRoom()
      releaseAllAuditions()
    }
  })

  // Every reactive input the canvas depends on, in one place. Reading them here
  // is what subscribes the effect; setting a plain flag is what keeps the
  // repaint on the frame loop instead of in the effect (§4.3).
  $effect(() => {
    void song.version
    void tracker.row
    void tracker.channel
    void tracker.field
    void tracker.digit
    void tracker.editing
    void tracker.focused
    void tracker.frame
    void tracker.anchor
    void tracker.muted
    void tracker.solo
    dirty = true
  })

  $effect(() => {
    void shape
    untrack(rebuild)
  })
</script>

<div class="grid-host" bind:this={host}>
  <canvas
    bind:this={canvas}
    aria-hidden="true"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onwheel={onWheel}
  ></canvas>

  <div
    class="model"
    bind:this={gridEl}
    role="grid"
    tabindex="0"
    aria-label="pattern grid"
    aria-rowcount={rowsPerPattern}
    aria-colcount={channelCount}
    aria-activedescendant={cellId(tracker.row, tracker.channel)}
    aria-readonly={!tracker.editing}
    onkeydown={onKeyDown}
    onkeyup={onKeyUp}
    onfocus={() => {
      tracker.focused = true
      dirty = true
    }}
    onblur={() => {
      tracker.focused = false
      releaseAllAuditions()
      dirty = true
    }}
  >
    {#each visibleRows as r (r)}
      <div role="row" aria-rowindex={r + 1}>
        {#each song.doc.channels as _ch, ci (ci)}
          <span role="gridcell" id={cellId(r, ci)} aria-colindex={ci + 1}>
            {cellLabel(r, ci)}
          </span>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .grid-host {
    position: relative;
    min-width: 0;
    height: clamp(280px, 46vh, 520px);
    overflow: hidden;
    background: var(--grid-bg);
    border-radius: var(--r-2);
    box-shadow: var(--sh-inset);
  }

  canvas {
    display: block;
    image-rendering: pixelated;
    touch-action: none;
  }

  /* Clipped, not display:none — the cells must stay reachable by a screen
     reader, and the canvas is the sighted rendering of the same model. */
  .model {
    position: absolute;
    inset: 0;
    clip-path: inset(50%);
    white-space: nowrap;
    overflow: hidden;
  }

  /* The one tab stop. Its focus is drawn on the canvas (patternRenderer's focus
     ring) because the DOM model has no visible box of its own. */
  .model:focus {
    outline: none;
  }
</style>
