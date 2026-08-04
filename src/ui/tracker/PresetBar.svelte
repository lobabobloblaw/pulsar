<!--
  pulsar — the preset browser (design §5.6, preset-suite §7.3 step 9).

  One chip-styled native `<select>`, one option per registered song, filling
  `TrackerPanel`'s documented `presetBar` seam. It was a row of chips until the
  2026-08-04 UI audit: fourteen songs wrapped the transport bar to three rows,
  and the album will only grow — a picker costs one chip of space forever.
  Native `<select>`, so keyboard operation, focus order and screen-reader
  semantics still come free — a preset browser is not a place to invent a
  widget. Styling is the StatusBar's chip vocabulary verbatim (`--chip-bg`,
  `--chip-accent`, `--t-micro`, lowercase); tokens only, no literal colours.

  Songs come from `src/assets/songs/index.ts`, which is a glob of that directory,
  so this component never learns any song's name: adding a file adds a chip.

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

  let active = $state<string | null>(null)
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
      song.load(doc)
      bridge().loadSong(doc)
      tracker.setFrame(0)
      tracker.setCursor(0, tracker.channel, tracker.field)
      active = entry.id
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
    <label class="t-micro picker">
      <span class="muted">songs</span>
      <select
        class="window"
        bind:this={selectEl}
        value={active ?? ''}
        class:bad={failed !== null}
        onchange={onPick}
      >
        <option value="" disabled>load…</option>
        {#each PRESETS as entry (entry.id)}
          <option value={entry.id} data-song={entry.id}>{entry.title}</option>
        {/each}
      </select>
    </label>
  </div>

  <dialog bind:this={confirmEl} class="confirm" aria-label="discard unsaved changes">
    <p class="t-body">
      this song has unsaved edits. loading
      <strong>{pending?.title ?? 'another preset'}</strong> discards them.
    </p>
    <div class="row">
      <button type="button" class="chip action" onclick={cancelDiscard}>keep editing</button>
      <button type="button" class="chip action" onclick={confirmDiscard}>discard and load</button>
    </div>
  </dialog>
{/if}

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-1);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    padding: 3px var(--s-2);
    font-size: var(--t-micro-size);
    font-weight: var(--t-micro-weight);
    letter-spacing: var(--t-micro-track);
    text-transform: lowercase;
    color: var(--chip-ink);
    background: var(--chip-bg);
    border: 0;
    border-radius: var(--r-1);
    box-shadow: var(--sh-inset);
    white-space: nowrap;
  }

  .action {
    color: var(--chip-accent);
    cursor: pointer;
  }

  .muted {
    color: var(--enclosure-ink-2);
  }

  /* Silk name, glass window: the picker reads as a program slot — the ground
     and chevron come from tokens' `.window`. Native popup, native semantics. */
  .picker {
    display: inline-flex;
    align-items: center;
    gap: var(--s-1);
  }

  .picker select {
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    max-width: 22ch;
  }

  /* A failed load RINGS the window — non-text red, visible on the slab; the
     live-region announcement already said it in words. Red text on glass
     would sit at 2.5:1. */
  .picker select.bad {
    box-shadow:
      inset 0 1px 3px rgb(0 0 0 / 0.6),
      0 0 0 2px var(--st-bad);
  }

  .confirm {
    max-width: 44ch;
    padding: var(--s-3);
    color: var(--enclosure-ink);
    background: var(--enclosure-bg);
    border: 1px solid var(--grid-hairline);
    border-radius: var(--r-2);
  }

  .confirm::backdrop {
    background: rgb(0 0 0 / 0.4);
  }

  .row {
    display: flex;
    gap: var(--s-2);
    margin-block-start: var(--s-3);
  }

  button:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }
</style>
