<!--
  pulsar — the transport row (Ivory; absorbs PlayerStrip and the panel's
  transport).

  One row, always visible in both workspaces: the vermilion Play/Stop key, the
  Start/Retry audio cap while the engine is not running, the song picker, the
  BPM readout, the ORDER / ROW readout and the state caption. Playback rides
  the exact wiring the phone player used — the tracker store's `togglePlay`
  and PresetBar's load path — and the tap that starts it is the user gesture
  the audio bridge's resume logic wants anyway.

  The position readout is the one thing here that moves every frame. It is
  written straight to its text node from the frame bus at ≤ 8 Hz and only on
  change, exactly the way `Screen.updatePositionMirror` works, because C2 says
  the frame loop never writes `$state`: a rune write per frame is a reactive
  invalidation that runs for as long as the page is open.

  ===== PresetBar mount (design §5.6 / §6.2) ===================================
  `src/App.svelte` mounts this bar with the LiveRegion route:

      <TransportBar announce={announceText} onStartAudio={startAudio} />

  and the preset bar is mounted HERE, with the same route, inside the
  `data-slot="preset-bar"` seam. A preset that fails to load says so through
  `announce`, and App owns the only live region there is.
-->
<script lang="ts">
  import { song } from '../state/song.svelte'
  import { bpm } from '../state/songModel'
  import { tracker } from '../state/tracker.svelte'
  import { transport } from '../state/transport.svelte'
  import Icon from './Icon.svelte'
  import PresetBar from './tracker/PresetBar.svelte'
  import { useFrame } from './frame'

  interface Props {
    announce?: ((message: string) => void) | undefined
    onStartAudio: () => void
  }
  let { announce, onStartAudio }: Props = $props()

  const frame = useFrame()

  const hasNotes = $derived(
    song.doc.patterns.some((p) => p.rows.some((r) => r.note !== undefined && r.note >= 0)),
  )
  const songBpm = $derived(Math.round(bpm(song.doc.meta) * 10) / 10)

  /** §7.2: a main-thread driver's failure mode IS late writes. The chip
   *  appears the moment a counter moves and not before. */
  const drvShown = $derived(
    tracker.drv.late > 0 || tracker.drv.dropped > 0 || tracker.drv.underruns > 0,
  )
  const drvTone = $derived(
    tracker.drv.dropped > 0 ? 'bad' : tracker.drv.late > 0 || tracker.drv.underruns > 0 ? 'warn' : 'ok',
  )

  function toggle(): void {
    tracker.togglePlay('row')
    // The song page narrates playback; params returns when the row stops it.
    transport.setPage(tracker.playing ? 'song' : 'params')
  }

  /** The ORDER / ROW text node. Written from the frame loop, never read in the
   *  template — so nothing invalidates when the playhead moves. */
  let posEl = $state<HTMLElement | null>(null)
  let lastPosText = ''
  let lastPosAt = 0
  const hex2 = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0')

  $effect(() => {
    const stop = frame.subscribe((now) => {
      if (now - lastPosAt < 125) return
      lastPosAt = now
      const el = posEl
      if (el === null) return
      const p = tracker.position
      const next = p.playing
        ? `${hex2(p.orderIndex)} / ${hex2(p.row)}`
        : `${hex2(tracker.frame)} / ${hex2(tracker.row)}`
      if (next === lastPosText) return
      lastPosText = next
      el.textContent = next
    })
    return stop
  })
</script>

<div class="transport player">
  <button
    type="button"
    class="play"
    disabled={!hasNotes && !tracker.playing}
    aria-pressed={tracker.playing}
    onclick={toggle}
  >
    {#if tracker.playing}
      <Icon name="stop" /><span>Stop song</span>
    {:else}
      <Icon name="play" /><span>Play song</span>
    {/if}
  </button>

  {#if transport.audio.state === 'idle' || transport.audio.state === 'error'}
    <button type="button" class="key start" onclick={onStartAudio}>
      {transport.audio.state === 'error' ? 'Retry audio' : 'Start audio'}
    </button>
    {#if transport.audio.state === 'error'}
      <p class="fault" role="status">Audio could not start. Check your connection and retry audio.</p>
    {/if}
  {:else if transport.audio.state === 'starting'}
    <span class="muted">Audio starting…</span>
  {/if}

  <div class="song" data-slot="preset-bar">
    <PresetBar announce={announce} />
  </div>

  <div class="clock">
    <strong class="bpm">{songBpm}</strong>
    <span class="t-micro">BPM</span>
  </div>

  <div class="position">
    <span class="t-micro">Order / Row</span>
    <strong bind:this={posEl}>00 / 00</strong>
  </div>

  <span class="state">{tracker.playing ? 'Playing' : 'Stopped'}</span>
  {#if drvShown}
    <span class="drv" role="group" aria-label="driver diagnostics">
      <span class="dot {drvTone}" aria-hidden="true"></span>
      drv late {tracker.drv.late} · drop {tracker.drv.dropped} · under {tracker.drv.underruns}
    </span>
  {/if}
</div>
{#if !hasNotes}
  <p class="hint">Choose a song to listen, or tap the piano to play.</p>
{/if}

<style>
  .transport {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 20px;
    padding: 20px 0;
  }

  /* Inside the homepage window the rows sit closer: the casing supplies the
     outer margins and a 1440x900 laptop has 756px for the whole instrument. */
  :global([data-embedded]) .transport {
    padding: 14px 0;
  }

  /* The one vermilion object on the slab. Its own style, not a cap: the
     border is the darker vermilion and the 3px drop is what makes it read as
     a key you press rather than a badge. */
  .play {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 49px;
    padding: 9px 14px;
    font-family: var(--font-sans);
    font-size: var(--t-ui-size);
    line-height: 1.2;
    white-space: nowrap;
    color: #fff;
    background: var(--play-bg);
    border: 1px solid var(--play-border);
    border-radius: var(--r-cap);
    box-shadow:
      inset 0 1px rgb(255 255 255 / 0.3),
      0 3px 0 var(--play-drop);
    cursor: pointer;
  }

  .play:active {
    transform: translateY(2px);
    box-shadow: inset 0 1px rgb(255 255 255 / 0.3), 0 1px 0 var(--play-drop);
  }

  .play:disabled {
    opacity: 0.4;
    cursor: default;
    transform: none;
  }

  .play:focus-visible {
    outline: none;
    box-shadow:
      0 3px 0 var(--play-drop),
      var(--focus);
  }

  @media (prefers-contrast: more) {
    .play {
      box-shadow: none;
    }
  }

  /* Start/Retry: a cap with the accent border, so it reads as the thing to
     press next without stealing the play key's fill. */
  .start {
    border-color: var(--enclosure-accent);
  }

  .fault {
    flex-basis: 100%;
    margin: 0;
    font-size: var(--t-body-size);
    line-height: 1.5;
    color: var(--enclosure-ink);
  }

  .muted {
    font-size: var(--t-body-size);
    color: var(--enclosure-ink-2);
  }

  .song {
    flex: 1 1 180px;
    min-width: 0;
  }

  .clock {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .bpm {
    font-family: var(--font-ui);
    font-size: var(--t-bpm-size);
    font-weight: 500;
    line-height: 1;
    letter-spacing: -2px;
    color: var(--enclosure-ink);
  }

  .position {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .position strong {
    font-family: var(--font-ui);
    font-size: var(--t-position-size);
    font-weight: 500;
    line-height: 1;
    color: var(--enclosure-ink);
    white-space: nowrap;
  }

  .state {
    font-size: 11px;
    color: var(--enclosure-ink-2);
  }

  .drv {
    display: inline-flex;
    align-items: center;
    gap: var(--s-1);
    padding: 3px var(--s-2);
    font-family: var(--font-ui);
    font-size: var(--t-caption-size);
    letter-spacing: 1px;
    color: var(--enclosure-ink);
    background: var(--chip-bg);
    border: 1px solid var(--enclosure-hairline);
    border-radius: var(--r-1);
    white-space: nowrap;
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

  .hint {
    margin: 0 0 12px;
    font-size: var(--t-body-size);
    color: var(--enclosure-ink-2);
  }

  @media (pointer: coarse) {
    .play {
      min-height: 49px;
    }
  }

  /* Tablet and phone: the playing/stopped word is carried by the play key's
     own label (Play song / Stop song), so the caption yields its space. */
  @media (max-width: 850px) {
    .state {
      display: none;
    }
  }

  /* The phone: the play key (with the Start/Retry cap or the starting note
     beside it), then the song picker on a row of its own, then the readouts.
     The picker ALWAYS takes its own row, so the cap's arrival or departure
     changes only the first row's width and never the row count — a row
     appearing under a finger moved the keybed 65px mid-tap. The failure
     sentence is the one state that adds a line, and it is a failure. */
  @media (max-width: 600px) {
    .transport {
      gap: 12px 16px;
      padding: 16px 0;
    }
    .song {
      flex-basis: 100%;
    }
    .clock {
      flex: 1 1 auto;
    }
  }

  @media (max-width: 360px) {
    .transport {
      gap: 6px 12px;
      padding: 10px 0;
    }
    .position {
      flex-direction: row;
      align-items: baseline;
      gap: 8px;
      margin-inline-start: auto;
    }
  }
</style>
