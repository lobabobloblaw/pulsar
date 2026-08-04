/** Recording and replaying `WriteSink` implementations.
 *
 *  `ArrayWriteSink` is how tests and the golden-trace tooling capture a register
 *  timeline once and replay it into as many engines as they like — the whole point of
 *  having exactly one write interface. It is NOT on the audio thread and is free to
 *  allocate.
 */
import type { NesCycle, RegAddr, WriteSink } from './types'

export class ArrayWriteSink implements WriteSink {
  readonly cycles: number[] = []
  readonly addrs: number[] = []
  readonly values: number[] = []

  get length(): number {
    return this.cycles.length
  }

  write(cycle: NesCycle, addr: RegAddr, value: number): void {
    this.cycles.push(cycle)
    this.addrs.push(addr)
    this.values.push(value & 0xff)
  }

  clear(): void {
    this.cycles.length = 0
    this.addrs.length = 0
    this.values.length = 0
  }

  /** Replay every recorded write, in order, into another sink. */
  replayTo(sink: WriteSink): void {
    for (let i = 0; i < this.cycles.length; i++) {
      sink.write(this.cycles[i], this.addrs[i], this.values[i])
    }
  }

  /** Replay only the writes at or before `limit`, returning how many were replayed
   *  from `from`. Mirrors the transport's `drainUpTo` so tests can interleave
   *  scheduling with rendering. */
  replayUpTo(sink: WriteSink, limit: NesCycle, from: number): number {
    let i = from
    while (i < this.cycles.length && this.cycles[i] <= limit) {
      sink.write(this.cycles[i], this.addrs[i], this.values[i])
      i++
    }
    return i
  }
}

/** Fans one timeline out to several sinks — used to record a trace while it plays. */
export class TeeWriteSink implements WriteSink {
  constructor(
    private readonly a: WriteSink,
    private readonly b: WriteSink,
  ) {}

  write(cycle: NesCycle, addr: RegAddr, value: number): void {
    this.a.write(cycle, addr, value)
    this.b.write(cycle, addr, value)
  }
}
