<!--
  pulsar — the song picker (design §5.6, preset-suite §7.3 step 9; Ivory).

  One native `<select>`, one option per registered song, mounted in the
  transport row's `data-slot="preset-bar"` seam. It was a row of chips until
  the 2026-08-04 UI audit: fourteen songs wrapped the transport bar to three
  rows, and the album will only grow — a picker costs one slot of space
  forever. Native `<select>`, so keyboard operation, focus order and
  screen-reader semantics still come free — a song browser is not a place to
  invent a widget. Ivory prints a small "Song" caption above an underlined,
  transparent select in the UI sans.

  Songs come from `src/assets/songs/index.ts`, which is a glob of that directory,
  so this component never learns any song's name: adding a file adds an option.

  Loading is deliberately two calls and nothing else — `song.load()` replaces the
  document (clearing undo and the dirty flag) and `bridge.loadSong()` hands the
  same object to the driver. Coupling is kept to those two public surfaces on
  purpose: the store and the transport are owned elsewhere.

  A dirty document prompts first, through a plain `<dialog>`. Losing unsaved
  edits to a stray click is the one failure this component can actually cause.
-->
<script lang="ts">
  import { PRESETS, type PresetEntry } from '../../assets/songs/index'
  import { bridge } from '../../audio/bridge'
  import { parseSong, type Diagnostic } from '../../tracker/model/validate'
  import { song } from '../../state/song.svelte'
  import { tracker } from '../../state/tracker.svelte'

  interface Props {
    announce?: ((message: string) => void) | undefined
  }
  let { announce }: Props = $props()

  const active = $derived(song.presetId)
  let failed = $state<string | null>(null)
  let pending = $state<PresetEntry | null>(null)
  let confirmEl = $state<HTMLDialogElement | null>(null)
  let selectEl = $state<HTMLSelectElement | null>(null)

  /** The select's value is bound to `active`, but a cancelled dialog or a
   *  failed load leaves `active` unchanged — no reactive update fires, and the
   *  select would keep showing the song that never loaded. Put it back. */
  function syncSelect(): void {
    if (selectEl) selectEl.value = active ?? ''
  }

  function onPick(e: Event): void {
    const id = (e.currentTarget as HTMLSelectElement).value
    const entry = PRESETS.find((p) => p.id === id)
    if (entry) pick(entry)
  }

  function apply(entry: PresetEntry): void {
    try {
      const { song: doc, diagnostics } = parseSong(entry.song)
      // Playback first: a document swap under a running driver is a half-loaded song.
      tracker.stop()
      song.load(doc, entry.id)
      bridge().loadSong(doc)
      tracker.setFrame(0)
      tracker.setCursor(0, tracker.channel, tracker.field)
      failed = null
      const warnings = diagnostics.filter((d: Diagnostic) => d.severity === 'warn').length
      announce?.(`loaded ${entry.title}${warnings > 0 ? `, ${warnings} warnings` : ''}`)
    } catch (e) {
      failed = entry.id
      syncSelect()
      announce?.(`${entry.title} failed to load: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function pick(entry: PresetEntry): void {
    if (song.dirty) {
      pending = entry
      confirmEl?.showModal()
      return
    }
    apply(entry)
  }

  function confirmDiscard(): void {
    const entry = pending
    pending = null
    confirmEl?.close()
    if (entry !== null) apply(entry)
  }

  function cancelDiscard(): void {
    pending = null
    confirmEl?.close()
    syncSelect()
  }
</script>

{#if PRESETS.length > 0}
  <div class="presets" role="group" aria-label="preset songs">
    <label class="picker">
      <span class="name">Song</span>
      <select
        bind:this={selectEl}
        value={active ?? ''}
        class:bad={failed !== null}
        onchange={onPick}
      >
        <option value="" disabled>{song.dirty ? song.doc.meta.name || 'Your project' : 'Choose a song'}</option>
        {#each PRESETS as entry (entry.id)}
          <option value={entry.id} data-song={entry.id}>{entry.title}</option>
        {/each}
      </select>
    </label>
  </div>

  <!-- oncancel, not just the button: Esc fires cancel with no click, and an
       unwired cancel leaves `pending` set and the select showing a song that
       never loaded — the desync syncSelect() exists to prevent. -->
  <dialog
    bind:this={confirmEl}
    class="confirm"
    aria-label="discard unsaved changes"
    oncancel={cancelDiscard}
  >
    <p>
      This song has unsaved edits. Loading
      <strong>{pending?.title ?? 'another song'}</strong> discards them.
    </p>
    <div class="row">
      <button type="button" class="key" onclick={cancelDiscard}>Keep editing</button>
      <button type="button" class="key" onclick={confirmDiscard}>Discard and load</button>
    </div>
  </dialog>
{/if}

<style>
  .presets {
    min-width: 0;
  }

  /* A caption over an underlined value: the picker reads as a printed field,
     not a boxed control. Native popup, native semantics. */
  .picker {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    font-size: 11px;
    color: var(--enclosure-ink-2);
  }

  .picker select {
    width: 100%;
    min-width: 0;
    padding: 6px 24px 6px 0;
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.3;
    color: var(--enclosure-ink);
    background-color: transparent;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Cpath d='M1 1.5l4 4 4-4' fill='none' stroke='%23252720' stroke-width='1.5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 4px center;
    border: 0;
    border-bottom: 1px solid var(--enclosure-hairline);
    border-radius: 0;
    appearance: none;
    cursor: pointer;
    text-overflow: ellipsis;
  }

  .picker select:focus-visible {
    outline: none;
    box-shadow: var(--focus);
    border-radius: var(--r-1);
  }

  /* 320px: the caption sits beside the field instead of above it, so the
     Play page keeps one row for the picker. */
  @media (max-width: 360px) {
    .picker {
      flex-direction: row;
      align-items: baseline;
      gap: 8px;
    }
    .picker select {
      flex: 1 1 0;
      width: auto;
    }
  }

  /* A failed load RINGS the field — non-text red, visible on the slab; the
     live-region announcement already said it in words. */
  .picker select.bad {
    box-shadow: 0 0 0 2px var(--st-bad);
  }

  .confirm {
    max-width: 44ch;
    padding: 20px;
    font-family: var(--font-sans);
    font-size: var(--t-ui-size);
    line-height: 1.5;
    color: var(--enclosure-ink);
    background: var(--chip-bg);
    border: 1px solid var(--enclosure-hairline);
    border-radius: 8px;
  }

  .confirm p {
    margin: 0;
  }

  .confirm::backdrop {
    background: rgb(0 0 0 / 0.4);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    margin-block-start: var(--s-3);
  }
</style>
