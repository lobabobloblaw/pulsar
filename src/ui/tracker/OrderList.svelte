<!--
  pulsar — the order list (design §4.1, §4.4).

  Plain DOM, on purpose. It is small, it is where a screen-reader user actually
  builds a song's structure, and drawing it on canvas would cost accessibility
  for nothing (§4.1). A real `<table>`: rows are frames, columns are lanes, and
  every pattern index is a number input, so the browser's own editing,
  selection and announcement all come free.

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
  const hex2 = (n: number): string => n.toString(16).padStart(2, '0')

  /** `pulse 1` -> `p1`, `triangle` -> `tri`. Visible text only. */
  function short(label: string): string {
    const parts = label.split(' ')
    return parts.length > 1
      ? `${(parts[0] as string)[0]}${parts[1]}`
      : label.slice(0, 3)
  }

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
    const current = song.doc.order[tracker.frame]
    // "add" gets fresh pattern numbers, "clone" gets this frame's — the two ways
    // a tracker player extends a song, and the only difference is this value.
    const value = duplicate && current ? [...current] : newFrame(song.doc)
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

<section class="order" aria-labelledby="order-title">
  <div class="head">
    <h2 id="order-title" class="t-label">order</h2>
    <span class="t-micro count"
      >{song.doc.order.length} {song.doc.order.length === 1 ? 'frame' : 'frames'}</span
    >
  </div>

  <div class="scroll">
    <table>
      <caption class="sr">
        song order: one row per frame, one column per channel, values are pattern numbers in hex
      </caption>
      <thead>
        <tr>
          <th scope="col" class="t-micro">frm</th>
          <!-- Abbreviated so five lanes fit the narrow column; the full channel
               name still reaches assistive tech through aria-label. -->
          {#each labels as label, c (c)}
            <th scope="col" class="t-micro" aria-label={label}>{short(label)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each song.doc.order as frame, f (f)}
          <tr class:current={f === tracker.frame}>
            <th scope="row">
              <button
                type="button"
                class="t-micro frame"
                aria-current={f === tracker.frame ? 'true' : undefined}
                onclick={() => tracker.setFrame(f)}
              >
                {hex2(f)}
              </button>
            </th>
            {#each frame as pattern, c (c)}
              <td>
                <input
                  class="t-value"
                  type="text"
                  inputmode="numeric"
                  maxlength="2"
                  size="2"
                  value={hex2(pattern)}
                  aria-label="frame {f} {labels[c]} pattern"
                  onchange={(e) => setEntry(f, c, e.currentTarget.value)}
                  onfocus={() => tracker.setFrame(f)}
                />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="ops">
    <button type="button" class="chip t-micro" onclick={() => addFrame(false)}>add</button>
    <button type="button" class="chip t-micro" onclick={() => addFrame(true)}>clone</button>
    <button type="button" class="chip t-micro" onclick={removeFrame}>remove</button>
    <button type="button" class="chip t-micro" onclick={() => moveFrame(-1)}>up</button>
    <button type="button" class="chip t-micro" onclick={() => moveFrame(1)}>down</button>
  </div>
</section>

<style>
  .order {
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: var(--s-2);
    min-width: 0;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--s-2);
  }

  h2 {
    margin: 0;
    color: var(--enclosure-ink-2);
  }

  .count {
    color: var(--enclosure-ink-2);
  }

  .scroll {
    overflow: auto;
    max-height: clamp(200px, 40vh, 460px);
    background: var(--grid-bg);
    border-radius: var(--r-2);
    box-shadow: var(--sh-inset);
  }

  table {
    border-collapse: collapse;
    width: 100%;
  }

  caption {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  th,
  td {
    padding: 2px var(--s-1);
    text-align: left;
    color: var(--grid-ink-dim);
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--grid-bg-alt);
    color: var(--grid-ink);
    border-bottom: 1px solid var(--grid-hairline);
    white-space: nowrap;
  }

  tbody tr.current {
    background: var(--grid-bg-beat);
  }

  .frame {
    padding: 1px var(--s-1);
    color: var(--grid-ink-dim);
    background: transparent;
    border: 0;
    border-radius: var(--r-1);
    cursor: pointer;
  }

  .frame[aria-current='true'] {
    color: var(--n-000);
    background: var(--grid-accent);
  }

  input {
    width: 3ch;
    padding: 1px 2px;
    font-family: var(--font-ui);
    color: var(--grid-ink);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--r-1);
  }

  input:hover {
    border-color: var(--grid-hairline);
  }

  .ops {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-1);
  }

  .chip {
    padding: 3px var(--s-2);
    color: var(--chip-accent);
    background: var(--chip-bg);
    border: 0;
    border-radius: var(--r-1);
    box-shadow: var(--sh-inset);
    cursor: pointer;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  button:focus-visible,
  input:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }
</style>
