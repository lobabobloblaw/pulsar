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

`?embed` removes the standalone desk, screws and outside slab border. It fills
the host window with a scrollable instrument. The live view always exposes the
song picker and play/stop. Below 721px an open tracker yields to that view;
resizing back restores the editor over the same song, preset and cursor. No
responsive component owns playback synchronization: App owns the document effect.

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
