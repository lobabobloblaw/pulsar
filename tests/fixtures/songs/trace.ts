/** Register-trace capture and hashing for the five-lane regression gate.
 *
 *  Lives beside `build.ts` for the same reason it does: this tree is the tracker
 *  suites' own harness space, and this is harness code, not a suite.
 *
 *  The hash covers the cycle, the address and the value of every write, in order, so
 *  a reordered, extra, missing or re-valued write all change it. That is what lets
 *  `trackerVrc6Regression.test.ts` claim a five-lane song's timeline is byte-for-byte
 *  what it was before the VRC6 lanes existed.
 */
import { ArrayWriteSink } from '../../../src/audio/timeline/writeSink'
import { TrackerDriver } from '../../../src/tracker/driver/trackerDriver'
import { cycleOfTick } from '../../../src/tracker/driver/tempo'
import { NTSC_CPU_HZ } from '../../../src/audio/core/constants'
import type { Song } from '../../../src/tracker/model/types'

/** Drive `song` for `ticks` ticks from a clock pinned at 0, then stop, and return the
 *  raw trace — including `stop()`'s all-channels-off, which is where a VRC6 silence
 *  sequence would show up if it leaked onto a 2A03-only song. */
export function traceOf(song: Song, ticks: number): ArrayWriteSink {
  const sink = new ArrayWriteSink()
  const driver = new TrackerDriver(sink, { clockRate: NTSC_CPU_HZ, nowCycle: () => 0 }, { song })
  driver.play('song')
  driver.runTo(cycleOfTick(0, ticks - 1, NTSC_CPU_HZ, song.meta.engineSpeed))
  driver.stop()
  return sink
}

/** FNV-1a over the trace, four bytes per field, little-endian. */
export function hashTrace(sink: ArrayWriteSink): number {
  let h = 0x811c9dc5
  for (let i = 0; i < sink.length; i++) {
    h = mix(h, sink.cycles[i])
    h = mix(h, sink.addrs[i])
    h = mix(h, sink.values[i])
  }
  return h >>> 0
}

function mix(hash: number, value: number): number {
  let h = hash
  let v = value
  for (let b = 0; b < 4; b++) {
    h ^= v & 0xff
    h = Math.imul(h, 0x01000193)
    v = Math.floor(v / 256)
  }
  return h
}
