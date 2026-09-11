<!--
  pulsar — the order strip (design §4.1, §4.4; Ivory).

  Plain DOM, on purpose. It is small, it is where a screen-reader user actually
  builds a song's structure, and drawing it on canvas would cost accessibility
  for nothing (§4.1). A horizontal strip of frame caps — the hex index over
  the five pattern indices — so a short song's whole structure is visible at
  once; the current frame's five pattern numbers are editable in the compact
  row under the strip, one hex field per lane.

  Every mutation goes through the command layer, so the order list shares one
  undo stack with the grid (§4.6).
-->
<script lang="ts">
  import { song } from '../../state/song.svelte'
  import { CHANNEL_LABELS, newFrame, type Frame } from '../../state/songModel'
  import { tracker } from '../../state/tracker.svelte'

  interface Props {
    announce?: ((message: string) => void) | undefined
  }
  let { announce }: Props = $props()

  const labels = $derived(song.doc.channels.map((c) => CHANNEL_LABELS[c]))
  const current = $derived<Frame>(song.doc.order[tracker.frame] ?? [])
  const hex2 = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0')
  const hex = (n: number): string => n.toString(16).toUpperCase()

  function setEntry(frame: number, channel: number, value: string): void {
    const n = Number.parseInt(value, 16)
    if (!Number.isFinite(n)) return
    song.run({
      kind: 'setOrderEntry',
      frame,
      channel,
      pattern: Math.max(0, Math.min(255, n)),
    })
  }

  function addFrame(duplicate: boolean): void {
    const at = tracker.frame + 1
    const currentFrame = song.doc.order[tracker.frame]
    // "add" gets fresh pattern numbers, "clone" gets this frame's — the two ways
    // a tracker player extends a song, and the only difference is this value.
    const value = duplicate && currentFrame ? [...currentFrame] : newFrame(song.doc)
    song.run({ kind: 'insertFrame', frame: at, value })
    tracker.setFrame(at)
    announce?.(`frame ${at} added`)
  }

  function removeFrame(): void {
    if (song.doc.order.length <= 1) {
      announce?.('a song needs at least one frame')
      return
    }
    const at = tracker.frame
    song.run({ kind: 'deleteFrame', frame: at })
    tracker.setFrame(Math.min(at, song.doc.order.length - 1))
    announce?.(`frame ${at} removed`)
  }

  function moveFrame(delta: number): void {
    const from = tracker.frame
    const to = from + delta
    if (to < 0 || to >= song.doc.order.length) return
    const order = [...song.doc.order]
    const moved = order.splice(from, 1)[0] as Frame
    order.splice(to, 0, moved)
    song.run({ kind: 'setOrder', order })
    tracker.setFrame(to)
    announce?.(`frame moved to ${to}`)
  }
</script>

<section class="order" aria-labelledby="order-title" aria-describedby="order-desc">
  <div class="caps">
    <h2 id="order-title" class="t-micro">Order / Patterns per channel</h2>
    <span class="t-micro">{song.doc.order.length} {song.doc.order.length === 1 ? 'frame' : 'frames'}</span>
  </div>
  <p id="order-desc" class="sr">
    song order: one button per frame, showing its pattern numbers per channel in hex; the row
    under the strip edits the current frame's pattern numbers
  </p>

  <div class="strip">
    {#each song.doc.order as frame, f (f)}
      <button
        type="button"
        class="key frame"
        aria-pressed={f === tracker.frame}
        onclick={() => tracker.setFrame(f)}
      >
        <span class="index">{hex2(f)}</span>
        <small>{frame.map(hex).join(' ')}</small>
      </button>
    {/each}
  </div>

  <div class="ops">
    <button type="button" class="key mini" onclick={() => addFrame(false)}>Add frame</button>
    <button type="button" class="key mini" onclick={() => addFrame(true)}>Clone frame</button>
    <button type="button" class="key mini" onclick={removeFrame}>Remove frame</button>
    <button type="button" class="key mini" disabled={tracker.frame <= 0} onclick={() => moveFrame(-1)}>
      Move up
    </button>
    <button
      type="button"
      class="key mini"
      disabled={tracker.frame >= song.doc.order.length - 1}
      onclick={() => moveFrame(1)}
    >
      Move down
    </button>

    <div class="edit" role="group" aria-label="frame {tracker.frame} patterns">
      <span class="t-micro">Frame {hex2(tracker.frame)}</span>
      {#each current as pattern, c (c)}
        <label class="cell">
          <span class="t-micro">{labels[c]}</span>
          <input
            class="window"
            type="text"
            inputmode="numeric"
            maxlength="2"
            size="2"
            value={hex2(pattern)}
            aria-label="frame {tracker.frame} {labels[c]} pattern"
            onchange={(e) => setEntry(tracker.frame, c, e.currentTarget.value)}
          />
        </label>
      {/each}
    </div>
  </div>
</section>

<style>
  .order {
    display: grid;
    gap: 8px;
    min-width: 0;
    padding-bottom: 8px;
  }

  .caps {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  h2 {
    margin: 0;
  }

  /* The strip scrolls inside its own region; the document never does. */
  .strip {
    display: flex;
    gap: 5px;
    min-width: 0;
    overflow-x: auto;
    padding-bottom: 10px;
    scrollbar-width: thin;
  }

  .frame {
    flex: 0 0 auto;
    flex-direction: column;
    gap: 4px;
    min-width: 76px;
    padding: 6px;
    font-family: var(--font-ui);
    font-size: 12px;
    line-height: 1.3;
  }

  .frame small {
    font-size: 9px;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  .ops {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .edit {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    margin-inline-start: auto;
  }

  .cell {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .cell input {
    width: 3.5ch;
    padding: 4px 3px;
    text-align: center;
    font-size: var(--t-value-size);
    font-weight: 400;
  }

  @media (pointer: coarse) {
    .cell input {
      width: 44px;
    }
  }

  button:focus-visible,
  input:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }
</style>
