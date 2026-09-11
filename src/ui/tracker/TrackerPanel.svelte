<!--
  pulsar — the tracker workspace (design §4.1, §5.6, §7.2; Ivory).

  Editbar → order strip → lane mix → grid well → instrument section. The
  workspace replaces the instrument's screen and voice modules between the
  transport row and the keytop; the transport, the song picker, the BPM
  readout and the keybed live in the enclosure now and serve both workspaces,
  so the panel hosts none of them.

  Below 720 px the ModeSwitch cannot open this at all (App's `compact` rule),
  so there is no narrow fallback here any more. An 8-column grid on a phone is
  a lie, and plan-file already said desktop-first.

  Tempo and speed are document fields: they go through `song.run` like every
  other edit, so they share the one undo stack, and an edit while the song
  plays reaches the driver through App's `song.version` reload effect.
-->
<script lang="ts">
  import { song } from '../../state/song.svelte'
  import { CHANNEL_LABELS, MAX_SPEED, MAX_TEMPO, MIN_SPEED, MIN_TEMPO } from '../../state/songModel'
  import { tracker } from '../../state/tracker.svelte'
  import InstrumentEditor from './InstrumentEditor.svelte'
  import { laneCaption } from './laneCaptions'
  import OrderList from './OrderList.svelte'
  import PatternGrid from './PatternGrid.svelte'

  interface Props {
    announce?: ((message: string) => void) | undefined
  }
  let { announce }: Props = $props()

  /** Lowercase store copy, for announcements and accessible names. */
  const labels = $derived(song.doc.channels.map((c) => CHANNEL_LABELS[c]))
  /** The printed name, full words — `laneCaptions.ts` owns the spelling, and the
   *  M/S captions below must keep it inside their accessible names (invariant 33). */
  const captions = $derived(song.doc.channels.map(laneCaption))

  function clampInt(raw: string, lo: number, hi: number, fallback: number): number {
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return fallback
    return n < lo ? lo : n > hi ? hi : n
  }

  function onStep(e: Event): void {
    const el = e.currentTarget as HTMLInputElement
    tracker.setEditStep(clampInt(el.value, 0, 16, tracker.editStep))
    el.value = String(tracker.editStep)
  }

  function onTempo(e: Event): void {
    const el = e.currentTarget as HTMLInputElement
    const tempo = clampInt(el.value, MIN_TEMPO, MAX_TEMPO, song.doc.meta.tempo)
    if (tempo !== song.doc.meta.tempo) song.run({ kind: 'setMeta', meta: { tempo } })
    el.value = String(song.doc.meta.tempo)
  }

  function onSpeed(e: Event): void {
    const el = e.currentTarget as HTMLInputElement
    const speed = clampInt(el.value, MIN_SPEED, MAX_SPEED, song.doc.meta.speed)
    if (speed !== song.doc.meta.speed) song.run({ kind: 'setMeta', meta: { speed } })
    el.value = String(song.doc.meta.speed)
  }

  function mute(c: number): void {
    tracker.toggleMute(c)
    announce?.(`${labels[c]} ${tracker.muted[c] ? 'muted' : 'unmuted'}`)
  }

  function solo(c: number): void {
    tracker.toggleSolo(c)
    announce?.(tracker.solo === c ? `${labels[c]} solo` : 'solo off')
  }
</script>

<section class="tracker" aria-label="tracker">
  <div class="editbar">
    <button
      type="button"
      class="key rec"
      aria-pressed={tracker.editing}
      onclick={() => tracker.toggleEdit()}
    >
      Edit
    </button>
    <button type="button" class="key" onclick={() => tracker.play('pattern')}>Loop pattern</button>
    <label class="field">
      <span>Step</span>
      <input
        class="window"
        type="number"
        min="0"
        max="16"
        value={tracker.editStep}
        title="Rows advanced after each note"
        onchange={onStep}
      />
    </label>
    <label class="field">
      <span>Tempo</span>
      <input
        class="window"
        type="number"
        min={MIN_TEMPO}
        max={MAX_TEMPO}
        value={song.doc.meta.tempo}
        onchange={onTempo}
      />
    </label>
    <label class="field">
      <span>Speed</span>
      <input
        class="window"
        type="number"
        min={MIN_SPEED}
        max={MAX_SPEED}
        value={song.doc.meta.speed}
        onchange={onSpeed}
      />
    </label>
    <button
      type="button"
      class="key"
      aria-pressed={tracker.follow}
      onclick={() => tracker.toggleFollow()}
    >
      Follow
    </button>

    <details class="help">
      <!-- A "?" cap, not a text link. The name reaches AT through the sr span
           (aria-label on summary is unreliable in VoiceOver); title serves
           the pointer. -->
      <summary class="key mini" title="keyboard reference">
        <span aria-hidden="true">?</span>
        <span class="sr">keyboard reference</span>
      </summary>
      <p class="t-body">
        Space toggles edit · Enter plays from the cursor · Shift-Enter loops the pattern ·
        Escape stops · Tab moves between channels · 1 writes a note cut, ` writes a release ·
        Ctrl-Z undoes. Live shell: Z–M lower octave · Q–I upper · − and = shift octave ·
        Shift-drag dials for fine control. Screen readers get cell-level navigation and
        editing, not a spoken pattern — no tracker solves that honestly.
      </p>
    </details>
  </div>

  <OrderList {announce} />

  <!-- Mute and solo are also on the grid's keymap; the caps make them visible
       and reachable by pointer, one pair per lane. -->
  <div class="lanes" role="group" aria-label="channel mix">
    {#each captions as caption, c (c)}
      <span class="lane">
        <span class="name">{caption}</span>
        <!-- The accessible name carries the lane's PRINTED spelling, not the
             store's lowercase one: aria-label replaces the visible content, and
             voice control can only match a name that contains the visible word
             (invariant 33). `VRC6 Pulse 1` is visible, so `VRC6 Pulse 1` is the
             name. -->
        <button
          type="button"
          class="key mini"
          aria-pressed={tracker.muted[c] === true}
          aria-label="M mute {caption}"
          onclick={() => mute(c)}
        >
          M
        </button>
        <button
          type="button"
          class="key mini"
          aria-pressed={tracker.solo === c}
          aria-label="S solo {caption}"
          onclick={() => solo(c)}
        >
          S
        </button>
      </span>
    {/each}
  </div>

  <PatternGrid {announce} />

  <InstrumentEditor {announce} />
</section>

<style>
  .tracker {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    min-width: 0;
  }

  .editbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 0 0 16px;
  }

  .field {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--enclosure-ink);
  }

  /* `appearance: textfield` first: Chrome's number spinners eat the box and
     leave the digit with nowhere to render. */
  .field input {
    appearance: textfield;
    width: 53px;
    padding: 7px 3px;
    font-size: var(--t-value-size);
    font-weight: 400;
  }

  .help {
    position: relative;
    margin-inline-start: auto;
    color: var(--enclosure-ink-2);
    line-height: 1.6;
  }

  .help summary {
    list-style: none;
    font-family: var(--font-ui);
    font-weight: 700;
    width: 28px;
    padding: 3px 0;
  }

  .help summary::-webkit-details-marker {
    display: none;
  }

  .help[open] p {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 5;
    width: min(60ch, 80vw);
    margin: 0;
    padding: 12px 14px;
    color: var(--enclosure-ink);
    background: var(--chip-bg);
    border: 1px solid var(--enclosure-hairline);
    border-radius: 8px;
    box-shadow: 0 8px 16px rgb(0 0 0 / 0.15);
  }

  .lanes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    padding: 12px 0 8px;
  }

  .lane {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .name {
    margin-inline-end: 3px;
    font-family: var(--font-ui);
    font-size: 12px;
    color: var(--enclosure-ink);
  }

  .lane .key {
    min-height: 24px;
    padding: 2px 7px;
    font-family: var(--font-ui);
    font-size: 10px;
    letter-spacing: 1px;
  }

  @media (pointer: coarse) {
    .field input {
      width: 64px;
    }
  }

  button:focus-visible,
  input:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }
</style>
