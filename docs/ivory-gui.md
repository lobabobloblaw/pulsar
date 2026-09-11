# The Ivory GUI

The two GUI candidates the 2026-09 design audit produced, Ivory (built) and
Obsidian (not built), live in `docs/ivory-study/` with their design notes,
self-contained interactive previews, capture receipts and the scripts that made
them. `design-notes.md` there is the rationale this document implements.

Pulsar's face since 2026-09-10: a pale mineral slab on a paper ground, warm
white caps, one deep green display well and one vermilion transport key. The
design study (candidate A of two) fixed the values; this document records
what production keeps, what it changed and why, and what was retired. The
stores, the command layer, the canvas grid, the dot-matrix screen, the bridge
and the frame bus are untouched by the redesign — it is a face, not an engine.

## Component tree

```
<main>
  draft-alert (unchanged behaviour, restyled)
  Enclosure (the slab)
    .head       Brand · ModeSwitch · Settings button · OutputControl
    .settings   (only while expanded) Settings: console model · room · MIDI · audio
    .transport  TransportBar: Play/Stop song · Start/Retry audio · PresetBar (Song) ·
                BPM · ORDER / ROW · state · drv chip
    .live       (tracker closed, or compact) Screen well | KnobRow (three dials)
    .tracker    (tracker open and not compact) TrackerPanel:
                editbar · OrderList · lane M/S caps · PatternGrid + grid-nav ·
                InstrumentEditor
    .keytop     KeyTop: scope caption · − OCTAVE n + · Z–M / Q–I
    .keys       KeyBed (both workspaces)
    .foot       ProjectBar: save state · New/Open/Download · Undo/Redo · PULSAR / 2A03
  LiveRegion
```

Phone order (≤600px): head, settings, transport, keytop, keys, live (screen,
then voice), foot. The `.live` grid stacks to one column at ≤850px. The slab
is `min(100% - 24px, 1120px)` wide in both workspaces (`100% - 8px` at
≤600px), padding 24px (14px at ≤850px). Embedded (`html[data-embedded]`)
the slab fills the frame with no radius, border or shadow, padding 16px
(12px at ≤600px), and the page ground is the slab colour.

### Phone pages

Below App's compact threshold (720px, where the tracker cannot render) the
workspace switch's two segments read **Play** and **Voice** instead of
Instrument and Tracker, and no segment is disabled at any width. Both pages
keep the head, the settings strip and the transport row. Play adds the
keytop, the keybed and the footer; Voice adds the screen well and the voice
section. On Voice the transport row is one line — play key, Start/Retry
audio while the engine is idle or failed, BPM, ORDER / ROW — and the song
picker is not rendered (it stays on Play, where songs are chosen and
played); at ≤600px the screen's pager dots sit in the well's foot caption
between the key range and the owner caption, dots only, with the same group
name, labels, pressed state and 44px coarse target. Both pages fit a 393×700
phone frame (a 393×852 phone with Safari's toolbar inside the viewport).
The page is session state owned by `App.svelte`
(`phonePage`, default Play), not persisted and not in the tracker store;
growing past 720px shows the desktop switch and shrinking back returns to the
chosen page. Switching pages never touches playback: the keybed releases
every hold it owns on unmount (`onDestroy(releaseAll)`), the Screen mounts
fresh on Voice (boot page and TAP A KEY TO START while the engine is idle,
the params page once it runs), and the footer's host bridge (the
`pulsar:project` listener, file input and replace dialog) stays mounted on
Voice through ProjectBar's `quiet` mode. The tracker remains a wide-screen
surface.

## Tokens (`src/design/tokens.css`; the screen slice mirrored in `tokens.ts`)

Every custom-property name a component or canvas reads was kept and given an
Ivory value. `--font-sans` (a system stack; no font asset was added) and
`--t-ui-size: 14px` are new; `--font-ui` stays the self-hosted JetBrains Mono
and `gridMetrics.ts` still reads it with `--t-body-size` (12px) and
`--t-micro-size` (11px). `--grid-header` / `--grid-header-ink` are new: the
pattern renderer paints the lane-name band from them.

| role | day | night |
| --- | --- | --- |
| page ground (standalone) | `#efefeb` | `#141614` |
| slab `--enclosure-bg`, face gradient, border | `#deded4`; `120deg #eeefe5 → #deded4 → #cdd0c5`; `#adb0a3` | `#262a24`; `#2f342c → #262a24 → #1e221c`; `#3d423a` |
| ink `--enclosure-ink` | `#252720` | `#eeefe8` |
| muted `--enclosure-ink-2` | `#555849` | `#b3b8ad` |
| line `--enclosure-hairline` | `#b9bcb0` | `#464b43` |
| accent `--enclosure-accent` | `#df4a28` (components only) | same |
| play key fill / border / drop | `#d2401d` / `#9c311b` / `#a33c25` | `#d2401d` / `#9c311b` / `#7a2a16` |
| cap `--chip-bg`, border; field `--field-bg` | `#eeeee6`, `#b9bcb0`; `#eeeee6` | `#353a33`, `#4c524a`; `#1a1d19` |
| keys | white `#e3e4da → #fafaf2`, black `#272b25 → #3f4439`, held `#e7825d`, bed `#929789` | white `#c9ccbf → #e4e6da`, black `#1c201b → #2c312a`, held same, bed `#0f110f` |
| dials `--dial-*` | ring `#343a311c`, cap `#fffffb → #eeeee4 → #c5c8ba`, border `#bbc0ae` | ring `rgb(230 238 232 / 0.14)`, cap `#e2e4d8 → #c9ccbf → #9ea294`, border `#7d8276` |
| screen well | bg `#1e2925`, face `135deg #34463d → #1e2925 70%`, bezel `#272c25`, caption `#d0e6b3` | face `#2e3d35 → #1e2925`, bezel `#4a5148` (scoped rules; lattice unchanged) |
| screen lattice (`SCREEN` in `tokens.ts`) | bg `#1e2925`, dotOff `#2b3730`, ink `#e6f6cb`, dim `#9fb394`, accent `#f48c65` | same |
| grid glass `--grid-*` | bg `#1e2925`, alt `#182019`, beat `#263229`, bar `#2e3d33`, ink `#e6f6cb`, dim `#b7c6b0`, muted `#7c8977`, hairline `#3a493f`, accent `#ffb391`, selection `#3a4d42`, focus `#ec9a71`, header `#28362e` / `#dbe4d4`, well border `#252c26` | same glass; well bezel `#4a5148` (scoped rule) |
| focus | `0 0 0 2px var(--enclosure-bg), 0 0 0 4px var(--enclosure-accent)`; on glass `0 0 0 2px #1e2925, 0 0 0 4px #ffb391` | same |

Type: brand 36px/1 sans 600 tracked −2px (32px on a phone); captions
(`.t-micro`) mono 10px, tracked 1px, uppercase, muted; UI text and buttons
sans 14px sentence case; dial values mono 22px; BPM mono 28px tracked −2px;
ORDER / ROW mono 18px; footer mono 10px.

### Measured contrast (WCAG relative luminance)

The study's muted `#62665b` sits at 4.34:1 on the slab and 3.76:1 on the
face gradient's darkest stop, so production uses `#555849` (5.39:1 on
`#deded4`, 4.66:1 on `#cdd0c5`, 6.26:1 on the cap). Night muted moved from
`#383b33` (3.98:1 on the darkest stop) to `#2e3129` (5.48:1 / 4.61:1 / 7.56:1).
White on the study's vermilion is 4.08:1, so the play key's fill is `#d2401d`
(4.68:1) while the accent itself stays `#df4a28` for non-text use (3.01:1 on
the slab, 3.50:1 on the cap). Ink: 11.16:1 day, 7.49:1 night (9.66 / 6.31 on
the darkest stops). Glass: ink 13.16:1, dim 8.38:1, accent 8.65:1, muted
marks 4.08:1, header ink 9.69:1 on the band. Screen: ink 13.16:1, dim
6.68:1, accent 6.28:1, caption 7.49:1 on the face's lightest stop.
`prefers-contrast: more` drops every gradient and sheen to the flat values.

Night (a dark Ivory, 2026-09-10): ink `#eeefe8` 12.5:1 on the slab, 10.0:1
on the cap, 14.1:1 on the field, 13.6:1 on the face's darkest stop; muted
`#b3b8ad` 7.0:1 / 5.6:1 / 7.9:1 / 7.6:1; white on the play fill 4.7:1; the
key legend `#4d5347` 6.1:1 on the white key's foot (`#e4e6da`) and 4.8:1 on
its shoulder; the screen and grid bezels `#4a5148` 1.8:1 against the slab as
non-text edges. The lattice and the grid glass are byte-identical in both
rooms; `tests/unit/ivoryWiring.test.ts` pins that the night block redefines
every enclosure-facing day token and no glass token.

## What moved and what was retired

- `StatusBar.svelte` → `Settings.svelte` (strip) + the Settings button in the
  head. The console model is a native select over the new
  `transport.setModel`; the room a native select over `transport.setRoom`;
  MIDI a Connect button until the permission is known, printed status after;
  audio printed status (dev builds add transport and fps).
- `PlayerStrip.svelte` and the panel's own transport → `TransportBar.svelte`.
  The ORDER / ROW readout is written from the frame bus through `textContent`
  at ≤8 Hz, never through `$state` (`tests/unit/ivoryWiring.test.ts` pins it).
- The fourth knob → `OutputControl.svelte`, a native range in the head.
  `VOICE_KNOBS` in `src/audio/params.ts` is the dial set; `PHASE1_KNOBS` still
  drives the screen's params page.
- `Meter.svelte` retired; `meterRenderer.ts` stays for the screen's scope page.
- KeyBed's `Lower keys / Upper keys` range buttons and `.bed-scroll` retired;
  the phone bed shows one octave and the keytop's octave caps move it.
- The screws and the grain layers retired. `public/textures/enclosure-grain-512.png`
  stays on disk, unreferenced.
- The screen's viewport-height budget (`SHELL_OVERHEAD`, `canvasHeightBudget`)
  retired; the lattice is sized by the well's inner width alone.
- The grid's overlaid `.grid-navigation` moved out of the canvas into a row
  under the well; the panel's "Song display" disclosure, piano and preset seam
  are gone (the enclosure hosts all three).

## Acceptance

`tools/ivory-capture.mjs` (Playwright, from an absolute path outside the repo)
shoots both workspaces at 1024, 736, 390 and 320px, standalone and `?embed`,
asserts no document overflow, the keybed within the first 500px on phones,
an integer 128-multiple screen canvas and a non-empty accessible name on
every control, and runs the headless selftest with `--selftest`.
