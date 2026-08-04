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
  import { untrack, type Snippet } from 'svelte'
  import { bridge } from '../../audio/bridge'
  import { bpm } from '../../state/songModel'
  import { song } from '../../state/song.svelte'
  import { tracker } from '../../state/tracker.svelte'
  import { transport } from '../../state/transport.svelte'
  import Icon from '../Icon.svelte'
  import InstrumentEditor from './InstrumentEditor.svelte'
  import OrderList from './OrderList.svelte'
  import PatternGrid from './PatternGrid.svelte'

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

  /** The driver holds a COMPILED copy of the document, so an edit made while the
   *  transport is running is inert until the song is handed over again — you type a
   *  note into the row the playhead is about to reach and hear nothing. `song.version`
   *  is bumped by every command, undo and redo, which makes it the one signal to
   *  watch. Stopped, this does nothing: `tracker.play()` already loads on the way in.
   *
   *  `untrack` around the reload keeps the effect's dependency set to exactly the
   *  version counter — `loadSong` reads the whole document, and subscribing to that
   *  would re-run this on every keystroke of an edit it just published. */
  $effect(() => {
    void song.version
    untrack(() => {
      if (!tracker.playing) return
      bridge().loadSong(song.doc)
    })
  })

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
          class="stepwin"
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
      {#if screen}{@render screen()}{/if}
      <OrderList {announce} />
    </div>
    <PatternGrid {announce} />
    <div class="side">
      <InstrumentEditor {announce} />
    </div>
  </div>

  <p class="narrow t-body">
    the pattern grid needs a wider window — around 720 pixels. close the tracker to get the live
    instrument back, or open pulsar on a larger screen to edit.
  </p>

  <details class="help">
    <summary class="t-micro">keyboard reference</summary>
    <p class="t-micro">
      space toggles edit · enter plays from the cursor · shift-enter loops the pattern · escape
      stops · tab moves between channels · 1 writes a note cut, ` writes a release · ctrl-z undoes.
      screen readers get cell-level navigation and editing, not a spoken pattern — no tracker
      solves that honestly.
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

  /* The step count is a value window the size of a cap. `appearance: textfield`
     first: Chrome's number spinners eat the box and leave the digit with
     nowhere to render. */
  .stepwin {
    appearance: textfield;
    width: 26px;
    height: 24px;
    padding: 0;
    text-align: center;
    font-family: var(--font-ui);
    font-size: var(--t-micro-size);
    font-weight: var(--t-micro-weight);
    color: var(--enclosure-ink);
    background: var(--chip-bg);
    border: 0;
    border-radius: var(--r-1);
    box-shadow: var(--sh-inset);
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
    grid-template-columns: minmax(408px, 448px) minmax(0, 1fr) minmax(200px, 260px);
    gap: var(--s-3);
    align-items: start;
  }

  .side {
    display: grid;
    gap: var(--s-3);
    align-content: start;
    min-width: 0;
  }

  /* Three-pane mode is a fixed workbench BAY: the row is exactly the grid's
     height and every pane lives inside it — the order table and the
     instrument editor scroll within the bay rather than stretching the page.
     (A fourteen-frame song once pushed the order pane past the grid and the
     whole instrument scrolled again.) The height is PatternGrid's own clamp,
     kept in lockstep. */
  @media (min-width: 1081px) {
    .work {
      height: clamp(280px, 46vh, 520px);
      align-items: stretch;
    }

    .side {
      min-height: 0;
      align-content: stretch;
    }

    .side:first-child {
      grid-template-rows: auto minmax(0, 1fr);
    }

    .side:last-child {
      overflow-y: auto;
      align-content: start;
    }
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
    width: fit-content;
    color: var(--chip-accent);
    cursor: pointer;
  }

  .help summary:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }

  .help[open] summary {
    margin-block-end: var(--s-1);
  }

  /* Between the phone cutoff and the three-pane width, the work row stacks:
     a grid pane squeezed beside a 408px screen pane is too narrow for five
     lanes, and a full-width grid that scrolls beats a sliver that does not. */
  @media (max-width: 1080px) {
    .work {
      grid-template-columns: minmax(0, 1fr);
    }
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
