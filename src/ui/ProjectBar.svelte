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
  <div class="actions">
    <button type="button" onclick={() => ask('new')}>New project</button>
    <button type="button" onclick={() => file?.click()}>Open project</button>
    <button type="button" onclick={downloadProject}>Download project</button>
    <button type="button" disabled={!song.canUndo} onclick={() => song.undo()}>Undo</button>
    <button type="button" disabled={!song.canRedo} onclick={() => song.redo()}>Redo</button>
  </div>
  <input bind:this={file} type="file" accept=".json,.pulsar.json,application/json" onchange={readFile} hidden />
  <p class:error={song.draftError} role="status">{song.dirty ? 'Modified · ' : ''}{song.draftMessage || 'Edits are saved on this browser. Download a project to keep a file.'}</p>
  {#if error}<p role="alert">{error}</p>{/if}
</div>
<dialog bind:this={dialog} aria-label="replace current project" oncancel={cancel}>
  <p>Replace this edited project? Download it first to keep a separate copy.</p>
  <div class="actions">
    <button type="button" onclick={cancel}>Keep editing</button>
    <button type="button" onclick={downloadProject}>Download project</button>
    <button type="button" onclick={confirm}>Replace project</button>
  </div>
</dialog>
<style>
  .project {
    font-size: 12px;
    text-align: left;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  button {
    font: inherit;
    padding: 8px 12px;
    min-height: 36px;
    border: 1px solid var(--enclosure-hairline);
    border-radius: 4px;
    color: var(--enclosure-ink);
    background: var(--enclosure-bg);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  p {
    margin: 8px 0 0;
    line-height: 1.5;
  }
  .error,
  [role='alert'] {
    font-weight: 600;
  }
  dialog {
    max-width: min(440px, calc(100% - 24px));
    color: var(--enclosure-ink);
    background: var(--enclosure-bg);
    border: 1px solid var(--enclosure-hairline);
    border-radius: 8px;
    padding: 20px;
  }
  dialog .actions {
    margin-top: 16px;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
  @media (pointer: coarse) {
    button {
      min-height: 44px;
    }
  }
</style>
