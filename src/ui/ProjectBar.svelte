<!--
  pulsar — the footer (Ivory).

  One printed line: the save state on the left, the project actions and undo
  history as text caps in the middle, the serial on the right. The save state
  is the draft store's own truth — saved, modified, restored, or the error
  sentence when a draft could not be written — never a decorative "saved".

  The hidden file input, the `pulsar:project` host bridge and the replace
  dialog are unchanged in behaviour; only their clothes are Ivory.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { song } from '../state/song.svelte'
  import { tracker } from '../state/tracker.svelte'
  import { bridge } from '../audio/bridge'
  import { parseSong } from '../tracker/model/validate'
  import type { Song } from '../tracker/model/types'
  import { downloadProject } from '../state/projectHost'
  let file = $state<HTMLInputElement | null>(null)
  let dialog = $state<HTMLDialogElement | null>(null)
  let pending = $state<Song | 'new' | null>(null)
  let error = $state('')

  const saveState = $derived.by(() => {
    if (song.draftError) return song.draftMessage
    if (song.dirty) return 'Modified · saved on this browser'
    return song.draftMessage || 'Saved on this browser'
  })

  function replace(next: Song | 'new'): void {
    tracker.stop()
    if (next === 'new') song.reset()
    else song.load(next)
    bridge().loadSong(song.doc)
    tracker.setFrame(0)
    tracker.setCursor(0, 0, 0)
    error = ''
  }
  function ask(next: Song | 'new'): void {
    if (song.dirty) {
      pending = next
      dialog?.showModal()
    } else replace(next)
  }
  function confirm(): void {
    if (pending !== null) replace(pending)
    pending = null
    dialog?.close()
  }
  function cancel(): void {
    pending = null
    dialog?.close()
  }
  async function readFile(): Promise<void> {
    const selected = file?.files?.[0]
    if (file) file.value = ''
    if (!selected) return
    try {
      if (selected.size > 8 * 1024 * 1024) throw new Error('Project must be smaller than 8 MB.')
      ask(parseSong(await selected.text()).song)
    } catch (e) {
      error = `Could not open project. ${e instanceof Error ? e.message : ''}`
    }
  }
  function action(event: Event): void {
    if ((event as CustomEvent<string>).detail === 'new') ask('new')
    else file?.click()
  }
  onMount(() => {
    window.addEventListener('pulsar:project', action)
    return () => window.removeEventListener('pulsar:project', action)
  })
</script>

<div class="project" aria-label="project">
  <p class="save" class:error={song.draftError} role="status">● {saveState}</p>
  <div class="actions">
    <button type="button" class="key text" onclick={() => ask('new')}>New project</button>
    <button type="button" class="key text" onclick={() => file?.click()}>Open project</button>
    <button type="button" class="key text" onclick={downloadProject}>Download project</button>
    <button type="button" class="key text" disabled={!song.canUndo} onclick={() => song.undo()}>Undo</button>
    <button type="button" class="key text" disabled={!song.canRedo} onclick={() => song.redo()}>Redo</button>
  </div>
  <span class="serial">PULSAR / 2A03</span>
  <input bind:this={file} type="file" accept=".json,.pulsar.json,application/json" onchange={readFile} hidden />
  {#if error}<p class="open-error" role="alert">{error}</p>{/if}
</div>
<dialog bind:this={dialog} aria-label="replace current project" oncancel={cancel}>
  <p>Replace this edited project? Download it first to keep a separate copy.</p>
  <div class="dialog-actions">
    <button type="button" class="key" onclick={cancel}>Keep editing</button>
    <button type="button" class="key" onclick={downloadProject}>Download project</button>
    <button type="button" class="key" onclick={confirm}>Replace project</button>
  </div>
</dialog>
<style>
  .project {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 14px;
    padding-top: 22px;
    font-family: var(--font-ui);
    font-size: var(--t-caption-size);
    line-height: 1.4;
    color: var(--enclosure-ink-2);
  }

  .save {
    margin: 0;
  }

  .save.error,
  .open-error {
    font-weight: 700;
    color: var(--enclosure-ink);
  }

  .open-error {
    flex-basis: 100%;
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--t-body-size);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
  }

  .actions .key {
    color: var(--enclosure-ink);
  }

  .actions .key:disabled {
    opacity: 0.4;
  }

  .serial {
    letter-spacing: 2px;
    white-space: nowrap;
  }

  dialog {
    max-width: min(440px, calc(100% - 24px));
    padding: 20px;
    font-family: var(--font-sans);
    font-size: var(--t-ui-size);
    line-height: 1.5;
    color: var(--enclosure-ink);
    background: var(--chip-bg);
    border: 1px solid var(--enclosure-hairline);
    border-radius: 8px;
  }

  dialog p {
    margin: 0;
  }

  .dialog-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }

  @media (max-width: 600px) {
    .project {
      justify-content: flex-start;
      padding-top: 16px;
    }
    .save {
      flex-basis: 100%;
    }
    .serial {
      display: none;
    }
  }
</style>
