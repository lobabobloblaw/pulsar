# Pulsar — two GUI candidates

Source reviewed: Pulsar `6bb3bb763281a8502c4060530c69b63765571edd`, including
the current Svelte shell, audio bridge, parameter registry, tracker document,
transport store, project recovery, and all eight soundtrack files. These are
interface proposals, not a deployed replacement or an alternative audio engine.

## A · Ivory

A pale mineral/aluminum enclosure, warm white keycaps, deep green display well,
and one vermilion transport key. The three live controls have generous physical
spacing and explicit values. Output has its own permanent position in the header.
Shallow bevels, consistent light direction, and restrained typography supply the
material character; bitmap artwork is unnecessary.

The instrument is the default workspace. Its display and controls sit alongside
one another, followed by a full-width keyboard. Tracker replaces both upper
sections with the editor. Its horizontal order strip suits short compositions
and makes the five pattern references in each frame visible together.

This is the stronger direction for Pulsar as an approachable musical object.
The design reference is the material restraint and tactile control grouping of
[Teenage Engineering's field system](https://teenage.engineering/products/field-system).
The layout, colors, and identity are original to this proposal.

## B · Obsidian

A graphite enclosure with crisp seams, a smoked display, pale phosphor-like
markings, low-profile keys, and a single signal-red transport accent. The live
controls form a narrow vertical module beside the display. Tracker opens by
default, with an order rail beside the five-channel grid and a macro inspector
below it. The vertical rail becomes a horizontal strip at narrower widths.

This is the stronger direction for sustained composing and editing. It takes
the quiet geometry of [Analogue's hardware](https://www.analogue.co/pocket) and
the functional indication approach of [Nothing's Glyph interface](https://support.nothing.tech/hc/en-us/articles/16770135458193-What-is-the-Glyph-Interface)
as references. Status uses explicit text; this proposal does not copy a branded
light pattern or turn musical data into decoration.

## Architecture contract shared by both candidates

| Pulsar reality | Design consequence | Authoritative source in the Pulsar repository |
| --- | --- | --- |
| Two pulse channels, triangle, noise, DPCM | Five fixed named tracker lanes in canonical order. No generic oscillator rack, filter knobs, ADSR, effects rack, extra synth engines, or per-channel gain faders are implied. **Amended 2026-09-11:** plus the VRC6 expansion's two pulses and its sawtooth — up to **eight** fixed named lanes in canonical order, the five 2A03 ones then `vrc6p1`, `vrc6p2`, `vrc6saw`. A song declares a PREFIX of that list, so a 2A03 song is still a five-lane document. The lanes stay fixed and named; nothing above is loosened. | `src/tracker/model/types.ts`, `src/audio/core/` |
| Live controls are pulse 1 duty, constant level, sweep | Three scoped controls: duty 12.5/25/50/75%; level 0–15; sweep −7…+7. The internal `envDecay` name must still display **Level**, not decay. | `src/audio/params.ts`, `src/state/params.svelte.ts` |
| Master volume affects overall output | A separate output control remains visible in both workspaces, including playback. Production travel remains 0…1 in 0.01 steps, with the existing audio taper. | `src/audio/params.ts` |
| Exactly one timeline owner | Switching workspace does not stop/restart the engine. While a song plays, keys take over the selected tracker lane through the driver. The keybed names that lane; live-scheduler shaping controls become unavailable until playback stops. | `src/audio/bridge.ts:380`, `docs/register-timeline.md` |
| Per-channel patterns referenced by each order frame | Order cells show all five pattern indices. Changing order reads the corresponding pattern for each lane. The main grid preserves note, instrument, hexadecimal volume, and effects; the prototype handles the document's effect-column count. **Amended 2026-09-11:** order cells show one pattern index per lane the SONG declares — five, or eight with the VRC6 — and the strip's edit row gives each of those lanes its own named hex field. Production measured the eight-field row at 835 px, on one row at both the 1120 px slab and the embedded frame (`docs/ivory-gui.md`, "Tracker lanes"). | `src/tracker/model/types.ts` |
| Tempo, speed, engine tick rate, row highlight are distinct | BPM is derived as `24 × tempo / (speed × rowHighlight)`. Tempo and speed remain separate editor controls. Pocket Voltage therefore shows 108 BPM for tempo 144 and speed 8. | `src/tracker/driver/tempo.ts` |
| Shared macro banks, not per-voice ADSR | Inspector exposes volume, arpeggio, pitch, high pitch, duty; sequence slot, sharing count, loop and release points remain visible. Production sequence edits must disclose sharing before modifying the bank. | `src/tracker/model/types.ts`, `src/ui/tracker/InstrumentEditor.svelte` |
| DPCM has key-to-sample assignments | Selecting the DPCM instrument exposes existing note/sample/rate assignments. Do not substitute a wavetable or imply arbitrary sample dragging/import is already supported by the UI. | `DpcmAssignment` in `src/tracker/model/types.ts` |
| Editor state and song history are separate | Cursor, selection, order position, mute/solo, follow and playback must remain in `tracker`; document edits go through `song.run`. Knobs retain `params.set`. Undo must not rewind playback or move the user's viewport. | `src/state/tracker.svelte.ts`, `src/state/song.svelte.ts` |
| QWERTY, pointer and optional MIDI share note input | Native focusable controls, keyboard knob adjustment, labeled octave buttons, pointer hit-testing for glissando, and explicit note-entry scope. The tracker keeps focus custody over its own keyboard commands. | `src/input/keyboard.ts`, `src/ui/KeyBed.svelte`, `src/App.svelte` |
| Current phone scope is instrument/player below 720px | The study retains that boundary. The keyboard moves directly under transport on phones; all octave keys stay reachable. Tracker returns when the available width allows it. | `src/App.svelte` |
| Draft recovery and downloadable JSON projects already exist | Production footer replaces the study controls with Project (New, Open, Download), Undo/Redo and actual saved/modified/recovery status. Preserve replace confirmation and the persistent recovery/download alert. Keep the existing host File/Edit bridge. | `src/ui/ProjectBar.svelte`, `src/state/projectHost.ts`, `src/apps/pulsar/index.ts` in the OS repository |
| Audio starts from a gesture; initialization can fail or resume | Production Start/Retry and failure text belong beside transport. Queue a held first note, cancel early releases, preserve interruption resume. MIDI is explicitly requested in Settings; unsupported browsers retain QWERTY and touch. | `src/App.svelte`, `src/audio/bridge.ts`, `src/ui/StatusBar.svelte` |
| One rendering loop; audio scheduling is independent | Retain `bridge.tick → tracker.pump → frame bus`; no second rendering loop, frame-driven music timing, or per-frame Svelte state writes. Retain canvas for the real pattern grid and live scope. | `src/App.svelte`, `src/ui/frame.ts` |
| SAB and postMessage transports share the same engine | Transport choice and diagnostics belong in Settings, with visible fault status when needed. Never require cross-origin isolation for the design to function. | `src/audio/bridge.ts`, `docs/register-timeline.md` |
| Offline WAV renderer exists, while a shipped export UI is not established by the inspected components | Keep project download distinct from audio export. The candidates do not promise a finished WAV-export workflow. | `src/tracker/offlineRender.ts`, `src/ui/ProjectBar.svelte` |

## Prototype scope and implementation handoff

Both self-contained studies embed the eight actual song documents. They provide
workspace/song/order/channel/instrument/macro selection, mute/solo state, silent
playhead simulation, octave/key interaction, note entry into preview data,
tempo/speed changes with undo, live parameter values and a duty waveform preview.
They do not connect to the AudioWorklet, request MIDI, save drafts, or write to
Pulsar. Macro editing, effect typing, project dialogs and failure/recovery flows
remain integration work for the selected direction; their required behavior is
specified above. The example waveform is a duty diagram, not measured output.

For production, modify the existing Svelte enclosure and component composition;
do not transplant the study's DOM table, local undo snapshots or timer into
Pulsar. Retain the existing stores, command layer, canvas grid, bridge and frame
bus. Add no runtime dependencies. The current engine and register timeline need
no redesign. Console model remains NES/Famicom in Settings; it must not be
conflated with a song's NTSC/PAL region.

Choose A for a performance-led identity, B for a composition-led identity. Both
are designed to carry the complete instrument and editor; the opening workspace
is a preference, not a difference in capability.

## Verification

`verify-studies.mjs` exercises both candidates in a real, muted Chromium browser.
The receipt is `verification.json`; screenshots cover both selected workspaces
at 1024, 736, 390 and 320px. Phone checks assert the tracker remains unavailable
below 720px and the keyboard begins within the first 500px. All 16 viewport
checks must pass with no document-level horizontal overflow. Pattern and order
content may scroll within their own region.

Interaction checks cover all eight songs, five lanes, BPM arithmetic, tempo undo,
touch/pointer note entry and undo, row navigation, macro selection, song switching,
play/stop preview, and live-control availability during song playback. The
rendered desktop and phone layouts were also visually inspected. This validates
the proposals; it is not an audio-engine or production accessibility certification.

No production application files, existing generated mockups, or deployed sites
were changed. No image-generation or Replicate operations were used.
