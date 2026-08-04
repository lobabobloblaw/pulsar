<!--
  pulsar — the preset browser (design §5.6, preset-suite §7.3 step 9).

  A row of chips, one per registered song, filling `TrackerPanel`'s documented
  `presetBar` seam. Chips are `<button>`s, so keyboard operation, focus order and
  screen-reader semantics come free — a preset browser is not a place to invent a
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
  }
</script>

{#if PRESETS.length > 0}
  <div class="presets" role="group" aria-label="preset songs">
    <span class="chip t-micro muted">songs</span>
    {#each PRESETS as entry (entry.id)}
      <button
        type="button"
        class="chip action"
        class:bad={failed === entry.id}
        aria-pressed={active === entry.id}
        data-song={entry.id}
        onclick={() => pick(entry)}
      >
        {entry.title}
      </button>
    {/each}
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

  .action[aria-pressed='true'] {
    color: var(--n-000);
    background: var(--chip-accent);
    box-shadow: none;
  }

  .bad {
    color: var(--st-bad);
  }

  .muted {
    color: var(--enclosure-ink-2);
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
