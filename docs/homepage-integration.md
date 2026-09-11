# alexvoigt.com integration

Pulsar remains a separate static app at /pulsar/. Build with:

```sh
pnpm install --frozen-lockfile
pnpm build --base=/pulsar/
pnpm test
```

The homepage's `npm run pulsar:sync` runs the install/build and mirrors only the
runtime and notices into its website checkout. Its existing Cloudflare deploy
script owns publication; a Pulsar source change alone does not update the site.

`?embed` removes the standalone desk and the slab's border, radius and shadow.
It fills the host window with a scrollable instrument. The transport row
(song picker, play/stop, BPM, position) is in the enclosure in both
workspaces. Below 720px the switch pages between Play (keytop, keybed,
footer) and Voice (screen, dials) instead of stacking the instrument two
screens tall; the tracker remains a wide-screen surface, and resizing back
restores the editor over the same song, preset and cursor. No responsive
component owns playback synchronization: App owns the document effect.

## Ivory shell

The face is the Ivory design (`docs/ivory-gui.md`). The head carries the
wordmark, a segmented Instrument / Tracker switch (`nav[aria-label="Workspace"]`,
`aria-pressed`), a Settings button that expands a strip under the head
(console model and room as native selects, MIDI as a Connect button or
printed status, audio status) and the master Output range input
(`aria-label="Master output"`). Under it sits the transport row
(`.transport.player`: Play song / Stop song with `aria-pressed`, Start / Retry
audio while the engine is idle or failed, the Song picker in
`[data-slot="preset-bar"]`, BPM, ORDER / ROW, state). The instrument
workspace is the captioned screen well beside the three voice dials; the
tracker workspace replaces those two modules. The keytop (octave caps) and
the keybed (`[role="toolbar"][aria-label^="keybed"]`) are below either
workspace, and the footer carries the save state, project actions, undo and
redo. Phone order (≤600px): head, settings, transport, keytop, keys, screen,
voice, footer; the keybed shows one octave there and the octave caps move it.

The trusted host delegates `midi` and `autoplay` without requesting device
permission. MIDI access remains a separate user action. Power starts on click;
playing surfaces can start on press. Controls use real 44px touch targets and
text fields use at least 16px on coarse pointers.

The host dispatches `site:dispose` on the frame's window synchronously before
removing it. App releases keyboard/MIDI, its frame loop, tracker and AudioContext.
Standalone navigation uses non-persisted pagehide; a BFCache page retains its
resume behavior. The event is a trusted first-party lifecycle hook, not the
isolated third-party frame SDK.

The homepage is not cross-origin isolated, so the instrument uses postMessage.
It needs no new homepage CSP or isolation headers. Standalone isolated dev and
preview still use SAB. `?selftest` accepts either supported transport;
`?selftest&requireIsolation` additionally requires SAB availability, and `&pm`
forces postMessage even on an isolated page. All cases retain the measured pitch,
clock-anchor and clean-transport checks.

The build targets Chrome/Edge 120, Firefox 128 and Safari 16.4 syntax. Web MIDI
availability is detected at runtime; browsers without it keep touch/pointer and
computer-keyboard input. The host's real-app browser suite covers Chromium,
WebKit and Firefox, desktop windows, phone/tablet portrait and landscape, audio,
resizing and explicit teardown. Physical MIDI and iOS audio interruptions still
need hardware verification.

## Project and interaction contract

Drafts are synchronously serialized to Pulsar's own `pulsar.draft.v1` key after
load/edit/undo/redo and restored before interaction. The format is versioned and
validated with the song parser. Unreadable/future data is retained, competing
window changes are detected before writes, and storage errors show a persistent
banner with project download. New/Open and preset replacement ask before
replacing an edited document. Project files use the existing song JSON format.

The app exposes a narrow `pulsarHost` object for same-origin integration. The
homepage connects project File actions and Edit history, and supplies a download
handler. WebKit's frame-initiated blob download was blocked by the parent
frame-src policy; creating the download in the shell fixes it without permitting
blob frames. Standalone downloads remain local to Pulsar. Native text fields
keep their native undo stack; the grid uses the song command history.

`site:pause` stops playback and held notes when the phone portrait gate covers
the app. Returning upright does not restart playback. First playing gestures
queue only still-held notes until the audio engine is ready; early release,
panic, failure and teardown cancel those notes.

Piano drags hit-test the current key for mouse and touch. Below 600px the
keybed shows one octave and the keytop's octave caps move it; nothing in the
bed scrolls. The tracker workspace stacks editbar, order strip, lane mute/solo
caps, the grid well, a navigation row under the well (rows, scroll/select
mode, channel pan) and the instrument section; the keybed stays under it in
the enclosure. The order strip, the mute/solo caps and the grid carry one lane
per channel the loaded song declares: five for a 2A03 song, eight when it
carries the VRC6 (2 pulse + sawtooth). At the 1120px window this frame opens
at, all eight fit without clipping or horizontal document overflow — measured
2026-09-11, `docs/ivory-gui.md` "Tracker lanes". Touch drags scroll the grid unless Select cells is on; buttons
and wheel input also navigate it. Edit mode routes piano notes into the
selected channel through the same note-writing path as hardware key entry.
Effect-code entry continues to use a hardware keyboard.

Settings holds optional MIDI, room and console controls. Empty documents
invite song selection under the transport row; while a song plays the three
voice dials are disabled and say so, and the master output stays live in the
head. Smaller displays put the piano before the screen and the dials.
The two browser suites in the homepage repository cover normal integration and
the UX recovery/gesture/error journeys. Screenshots and regression receipts for
this pass are under its out/pulsar-remediation directory.
