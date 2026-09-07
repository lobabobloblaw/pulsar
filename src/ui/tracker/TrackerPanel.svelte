<!--
  pulsar — the tracker panel (design §4.1, §5.6, §7.2).

  Layout, transport, mode chips, the preset-bar slot, and the two plain-DOM
  editors either side of the canvas grid. The panel is opt-in behind a StatusBar
  chip: the Phase-1 live-play shell has to stay usable on its own, and it does
  not regress when this is closed (§4.1).

  Below 720 px the working area collapses to a line of copy pointing at a wider
  window. An 8-channel grid on a phone is a lie, and plan-file already said
  desktop-first.

  Chips reuse the StatusBar's vocabulary verbatim — white ground, blue text (the
  one place blue clears 4.5:1 on this enclosure), lowercase, pressed state as a
  filled chip. A tracker is a dense instrument; it earns nothing by inventing a
  second control language.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { bpm } from '../../state/songModel'
  import { song } from '../../state/song.svelte'
  import { tracker } from '../../state/tracker.svelte'
  import { transport } from '../../state/transport.svelte'
  import Icon from '../Icon.svelte'
  import InstrumentEditor from './InstrumentEditor.svelte'
  import OrderList from './OrderList.svelte'
  import PatternGrid from './PatternGrid.svelte'
  import KeyBed from '../KeyBed.svelte'

  interface Props {
    announce?: ((message: string) => void) | undefined
    /** ===== PresetBar mount seam (design §5.6 / §6.2) ====================
     *  Filled by `src/App.svelte`, which owns the LiveRegion the preset bar
     *  announces through:
     *
     *      <TrackerPanel announce={announceText}>
     *        {#snippet presetBar()}<PresetBar announce={announceText} />{/snippet}
     *      </TrackerPanel>
     *
     *  Left as a prop rather than imported here so the panel keeps no
     *  dependency on the preset registry, and so a host that has no presets
     *  (a test, an embed) renders the placeholder instead. The slot keeps its
     *  size and position either way, so the panel's layout does not move. */
    presetBar?: Snippet | undefined
    /** The dot-matrix screen, re-homed into the work row's left pane while the
     *  panel is open (§4.1 as amended): the song page sits beside the grid it
     *  narrates, and the enclosure's screen row is gone for the duration —
     *  that row is why the open tracker never fit a laptop viewport. App
     *  passes the SAME snippet it gives the enclosure. */
    screen?: Snippet | undefined
  }
  let { announce, presetBar, screen }: Props = $props()

  const songBpm = $derived(Math.round(bpm(song.doc.meta) * 10) / 10)
  const drvTone = $derived(
    tracker.drv.dropped > 0 ? 'bad' : tracker.drv.late > 0 || tracker.drv.underruns > 0 ? 'warn' : 'ok',
  )
</script>

<section class="tracker" aria-label="tracker">
  <div class="bar">
    <div class="group" role="group" aria-label="transport">
      <span class="keyed">
        <button
          type="button"
          class="key"
          aria-pressed={tracker.playing}
          aria-label={tracker.playing ? 'stop' : 'play'}
          onclick={() => tracker.togglePlay('row')}
        >
          {#if tracker.playing}<Icon name="stop" />{:else}<Icon name="play" />{/if}
        </button>
        <span class="silk">{tracker.playing ? 'stop' : 'play'}</span>
      </span>
      <span class="keyed">
        <button
          type="button"
          class="key"
          aria-label="loop pattern"
          onclick={() => tracker.play('pattern')}
        >
          <Icon name="loop" />
        </button>
        <span class="silk">loop</span>
      </span>
    </div>

    <div class="group" role="group" aria-label="edit modes">
      <span class="keyed">
        <button
          type="button"
          class="key rec"
          aria-pressed={tracker.editing}
          aria-label="edit mode"
          onclick={() => tracker.toggleEdit()}
        >
          <Icon name="record" />
        </button>
        <span class="silk">edit</span>
      </span>
      <span class="keyed">
        <button
          type="button"
          class="key"
          aria-pressed={tracker.follow}
          aria-label="follow playhead"
          onclick={() => tracker.toggleFollow()}
        >
          <Icon name="follow" />
        </button>
        <span class="silk">follow</span>
      </span>
      <span class="keyed">
        <input
          class="stepwin window"
          type="number"
          min="0"
          max="16"
          value={tracker.editStep}
          aria-label="edit step, rows advanced after each note"
          onchange={(e) => tracker.setEditStep(Number(e.currentTarget.value))}
        />
        <span class="silk">step</span>
      </span>
    </div>

    <!-- Position and tempo are printed on the slab, not boxed: readouts are
         not controls, and a chip promises a control. -->
    <p class="readout silk">
      {songBpm} bpm · frame {tracker.frame} · row {tracker.row} · oct {transport.octave}
    </p>

    <!-- PresetBar mount seam — see the `presetBar` prop above. -->
    <div class="group preset" data-slot="preset-bar">
      {#if presetBar}
        {@render presetBar()}
      {:else}
        <span class="chip t-micro muted">presets land here</span>
      {/if}
    </div>

    <!-- §7.2: a main-thread driver's failure mode IS late writes. The chip
         appears the moment a counter moves and not before: a permanently
         green row of zeros is chrome, but a hidden non-zero is a blind spot. -->
    {#if tracker.drv.late > 0 || tracker.drv.dropped > 0 || tracker.drv.underruns > 0}
      <div class="group" role="group" aria-label="driver diagnostics">
        <span class="chip t-micro">
          <span class="dot {drvTone}" aria-hidden="true"></span>
          drv late {tracker.drv.late} · drop {tracker.drv.dropped} · under {tracker.drv.underruns}
        </span>
      </div>
    {/if}
  </div>

  <div class="work">
    <div class="side">
      <details><summary>Song display</summary>{#if screen}{@render screen()}{/if}</details>
      <OrderList {announce} />
    </div>
    <PatternGrid {announce} />
    <div class="tracker-piano"><p class="piano-hint">{tracker.editing ? 'Tap piano keys to enter notes in the selected channel. Use a hardware keyboard for effect codes.' : 'Select Edit to enter notes, or play the piano to audition.'}</p><KeyBed {announce} /></div>
    <div class="side">
      <InstrumentEditor {announce} />
    </div>
  </div>

  <p class="narrow t-body">
    the pattern grid needs a wider window — around 720 pixels. close the tracker to get the live
    instrument back, or open pulsar on a larger screen to edit.
  </p>

  <details class="help">
    <!-- A "?" cap, not a text link: summaries were the last blue text sitting
         on the aluminium. The name reaches AT through the sr span (aria-label
         on summary is unreliable in VoiceOver); title serves the pointer. -->
    <summary class="key mini" title="keyboard reference">
      <span aria-hidden="true">?</span>
      <span class="sr">keyboard reference</span>
    </summary>
    <p class="t-micro">
      space toggles edit · enter plays from the cursor · shift-enter loops the pattern · escape
      stops · tab moves between channels · 1 writes a note cut, ` writes a release · ctrl-z undoes.
      live shell: z–m lower octave · q–i upper · − and = shift octave · shift-drag knobs for fine
      control. screen readers get cell-level navigation and editing, not a spoken pattern — no
      tracker solves that honestly.
    </p>
  </details>
</section>

<style>
  .tracker {
    display: grid;
    gap: var(--s-2);
    padding: var(--s-3);
    background: var(--enclosure-bg);
    border-radius: var(--r-3);
    box-shadow: var(--sh-inset);
  }

  /* flex-end lines every silkscreen label and the readout up on one printed
     baseline under the caps. */
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--s-1) var(--s-4);
  }

  .group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2);
  }

  .preset {
    margin-inline-start: auto;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--s-1);
    padding: 3px var(--s-2);
    font-size: var(--t-micro-size);
    font-weight: var(--t-micro-weight);
    letter-spacing: var(--t-micro-track);
    color: var(--chip-ink);
    background: var(--chip-bg);
    border: 0;
    border-radius: var(--r-1);
    box-shadow: var(--sh-inset);
    white-space: nowrap;
  }

  .muted {
    color: var(--enclosure-ink-2);
  }

  /* The step count is a glass value window the size of a cap (`.window` in
     tokens.css carries the ground). `appearance: textfield` first: Chrome's
     number spinners eat the box and leave the digit with nowhere to render. */
  .stepwin {
    appearance: textfield;
    width: 26px;
    height: 24px;
    padding: 0;
    text-align: center;
    font-size: var(--t-micro-size);
    font-weight: var(--t-micro-weight);
  }

  @media (pointer: coarse) {
    .stepwin {
      font-size: 16px;
      min-width: 44px;
      min-height: 44px;
    }
  }

  .readout {
    margin: 0;
    padding-block-end: 1px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--r-max);
    background: var(--a-gray);
  }

  .dot.ok {
    background: var(--st-ok);
  }
  .dot.warn {
    background: var(--st-warn);
  }
  .dot.bad {
    background: var(--st-bad);
  }

  /* The left pane is sized by the screen it now hosts: DOT_MIN puts the
     lattice at 384 CSS px, plus the well's padding. */
  .work {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(200px, 300px);
    gap: var(--s-3);
    align-items: start;
  }

  .tracker-piano { grid-column: 1 / -1; grid-row: 2; min-width: 0; }
  .piano-hint { font-size: 12px; line-height: 1.5; margin: 0 0 8px; }
  .bar { position: sticky; top: 0; z-index: 4; background: var(--enclosure-bg); padding-block: 8px; }

  .work :global(.grid-host) { grid-column: 1 / -1; grid-row: 1; }

  .side {
    display: grid;
    gap: var(--s-3);
    align-content: start;
    min-width: 0;
  }

  .narrow {
    display: none;
    max-width: 52ch;
    color: var(--enclosure-ink-2);
    line-height: 1.5;
  }

  .help {
    max-width: 96ch;
    color: var(--enclosure-ink-2);
    line-height: 1.6;
  }

  .help summary {
    list-style: none;
    font-size: var(--t-micro-size);
    font-weight: 700;
  }

  .help summary::-webkit-details-marker {
    display: none;
  }

  .help[open] summary {
    margin-block-end: var(--s-1);
  }

  @media (max-width: 720px) {
    .work {
      display: none;
    }
    .narrow {
      display: block;
    }
    .help {
      display: none;
    }
  }

  button:focus-visible,
  input:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }
</style>
