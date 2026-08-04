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
      <button
        type="button"
        class="chip action"
        aria-pressed={tracker.playing}
        onclick={() => tracker.togglePlay('row')}
      >
        {tracker.playing ? 'stop' : 'play'}
      </button>
      <button type="button" class="chip action" onclick={() => tracker.play('pattern')}>
        loop pattern
      </button>
      <span class="chip t-micro">{songBpm} bpm</span>
      <span class="chip t-micro">frame {tracker.frame} · row {tracker.row}</span>
    </div>

    <div class="group" role="group" aria-label="edit modes">
      <button
        type="button"
        class="chip action"
        aria-pressed={tracker.editing}
        onclick={() => tracker.toggleEdit()}
      >
        edit
      </button>
      <button
        type="button"
        class="chip action"
        aria-pressed={tracker.follow}
        onclick={() => tracker.toggleFollow()}
      >
        follow
      </button>
      <label class="chip t-micro step">
        step
        <input
          type="number"
          min="0"
          max="16"
          value={tracker.editStep}
          aria-label="edit step, rows advanced after each note"
          onchange={(e) => tracker.setEditStep(Number(e.currentTarget.value))}
        />
      </label>
      <span class="chip t-micro">oct {transport.octave}</span>
    </div>

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
    gap: var(--s-3);
    padding: var(--s-3);
    background: var(--enclosure-bg);
    border-radius: var(--r-3);
    box-shadow: var(--sh-inset);
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-1) var(--s-4);
  }

  .group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-1);
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

  .action {
    color: var(--chip-accent);
    cursor: pointer;
  }

  .action[aria-pressed='true'] {
    color: var(--n-000);
    background: var(--chip-accent);
    box-shadow: none;
  }

  .muted {
    color: var(--enclosure-ink-2);
  }

  .step input {
    /* `appearance: textfield` first: Chrome's number spinners eat a 4ch box and
       leave the digit with nowhere to render. */
    appearance: textfield;
    width: 3ch;
    margin-inline-start: var(--s-1);
    padding: 0 2px;
    text-align: center;
    font-family: var(--font-ui);
    font-size: var(--t-micro-size);
    color: var(--chip-ink);
    background: transparent;
    border: 1px solid var(--grid-hairline);
    border-radius: var(--r-1);
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
