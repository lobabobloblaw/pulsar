/* pulsar — Web MIDI input (plan C6).
 *
 * Flow, in order:
 *  1. no `requestMIDIAccess` (Safari)      -> `unavailable`, never prompt
 *  2. insecure context                     -> `unavailable`
 *  3. request { sysex: false } LAZILY — on first interaction with the midi chip,
 *     or right after start(). Never on page load: an unprompted permission
 *     dialog on arrival is how a synth loses a user before it makes a sound.
 *  4. granted -> enumerate + attach
 *  5. rejected -> Firefox means the site-permission add-on is missing, which is
 *     a DIFFERENT problem with a different fix, so it gets its own state
 *     (`blocked`); everything else is `denied`
 *  6. hot-plug (`onstatechange`) -> re-enumerate from scratch, re-attach, and
 *     allNotesOff — unplugging mid-note otherwise leaves the note hanging
 *  7. 0x90 with velocity > 0 is a note on; 0x90 with velocity 0 and 0x80 are
 *     note offs (running-status zero-velocity offs are extremely common);
 *     realtime bytes are ignored; omni in Phase 1
 *  8. dispose detaches everything and panics
 *
 * The Web MIDI DOM types are not relied on: they are inconsistently present
 * across TS lib versions, and a structural local type costs less than a
 * dependency.
 */

import type { AudioBridge } from '../audio/bridge'
import { transport, type MidiPort } from '../state/transport.svelte'

interface MidiMessageLike {
  data: Uint8Array | null
}

interface MidiInputLike {
  id: string
  name: string | null
  manufacturer: string | null
  state: string
  onmidimessage: ((e: MidiMessageLike) => void) | null
}

interface MidiAccessLike {
  inputs: ReadonlyMap<string, MidiInputLike>
  onstatechange: ((e: unknown) => void) | null
}

type RequestMidi = (opts?: { sysex?: boolean }) => Promise<MidiAccessLike>

function requestFn(): RequestMidi | null {
  if (typeof navigator === 'undefined') return null
  const fn = (navigator as unknown as { requestMIDIAccess?: RequestMidi }).requestMIDIAccess
  return typeof fn === 'function' ? fn.bind(navigator) : null
}

function isFirefox(): boolean {
  return typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent)
}

export interface MidiController {
  /** Idempotent. Call from a user interaction with the midi chip, or after
   *  bridge.start(). Resolves once the permission outcome is known. */
  ensureAccess(): Promise<void>
  dispose(): void
}

export function createMidi(bridge: AudioBridge, onNote?: (note: number) => void): MidiController {
  const request = requestFn()
  const supported = request !== null && (typeof isSecureContext === 'boolean' ? isSecureContext : true)

  transport.midi = {
    supported,
    permission: supported ? 'unknown' : 'unavailable',
    ports: [],
  }

  let access: MidiAccessLike | null = null
  let pending: Promise<void> | null = null
  let disposed = false
  const attached = new Set<MidiInputLike>()
  /** Notes this module started, so dispose can end exactly those. */
  const sounding = new Set<number>()

  function detachAll(): void {
    for (const input of attached) input.onmidimessage = null
    attached.clear()
  }

  function enumerate(): void {
    if (!access) return
    detachAll()
    const ports: MidiPort[] = []
    for (const input of access.inputs.values()) {
      input.onmidimessage = handleMessage
      attached.add(input)
      ports.push({
        id: input.id,
        name: input.name ?? 'unnamed device',
        manufacturer: input.manufacturer ?? '',
      })
    }
    transport.midi = { ...transport.midi, ports }
  }

  function handleMessage(e: MidiMessageLike): void {
    const d = e.data
    if (!d || d.length < 2) return
    const status = d[0] as number
    if (status >= 0xf8) return // realtime clock/start/stop — not notes
    const type = status & 0xf0
    if (type !== 0x90 && type !== 0x80) return

    const note = d[1] as number
    const velocity = d.length > 2 ? (d[2] as number) : 0

    if (type === 0x90 && velocity > 0) {
      sounding.add(note)
      // Per-source refcount (design §7.2): sound it only if nobody else is, and
      // cut it only when this was the last hand on it.
      if (transport.noteOn(note, 'midi')) bridge.noteOn(note, velocity)
      onNote?.(note)
    } else {
      sounding.delete(note)
      if (transport.noteOff(note, 'midi')) bridge.noteOff(note)
    }
  }

  function onStateChange(): void {
    if (disposed) return
    // Re-enumerate from scratch rather than patching the port list: a device
    // that reconnects gets a fresh input object, and the stale one never fires
    // again. Panic first — the unplugged device cannot send its note-offs.
    bridge.allNotesOff()
    transport.clearNotes()
    sounding.clear()
    enumerate()
  }

  async function ensureAccess(): Promise<void> {
    if (disposed) return
    if (!supported || !request) {
      transport.midi = { ...transport.midi, permission: 'unavailable' }
      return
    }
    if (access) return
    if (pending) return pending

    pending = (async () => {
      try {
        const granted = await request({ sysex: false })
        if (disposed) return
        access = granted
        granted.onstatechange = onStateChange
        transport.midi = { ...transport.midi, permission: 'granted' }
        enumerate()
      } catch {
        if (disposed) return
        transport.midi = {
          ...transport.midi,
          permission: isFirefox() ? 'blocked' : 'denied',
          ports: [],
        }
      } finally {
        pending = null
      }
    })()

    return pending
  }

  function dispose(): void {
    disposed = true
    detachAll()
    if (access) access.onstatechange = null
    access = null
    if (sounding.size > 0) {
      bridge.allNotesOff()
      transport.clearNotes()
      sounding.clear()
    }
  }

  return { ensureAccess, dispose }
}
